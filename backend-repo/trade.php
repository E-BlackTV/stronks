<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    require_once 'config.php';
    setCORSHeaders();

    $conn = getDBConnection();
    
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    $input = file_get_contents("php://input");
    $data = json_decode($input);
    
    // Debug-Ausgabe
    error_log("Received data: " . $input);
    
    if (!$data) {
        throw new Exception('Invalid JSON data');
    }
    
    if (!isset($data->user_id) || !isset($data->action) || !isset($data->asset_symbol)) {
        throw new Exception('Missing required parameters: user_id, action, asset_symbol');
    }

    $user_id = (int)$data->user_id;
    $action = $data->action; // 'buy' oder 'sell'
    $asset_symbol = $data->asset_symbol;
    
    // Validierung der Aktion
    if (!in_array($action, ['buy', 'sell'])) {
        throw new Exception('Invalid action. Must be "buy" or "sell"');
    }

    // Aktuellen Asset-Preis abrufen
    $priceStmt = $conn->prepare("SELECT data FROM cached_data WHERE symbol = ? ORDER BY last_updated DESC LIMIT 1");
    $priceStmt->bind_param("s", $asset_symbol);
    $priceStmt->execute();
    $priceResult = $priceStmt->get_result();
    
    if (!$priceResult->num_rows) {
        throw new Exception('Asset price not available for symbol: ' . $asset_symbol);
    }
    
    $priceData = json_decode($priceResult->fetch_assoc()['data'], true);
    $currentPrice = floatval($priceData['chart']['result'][0]['meta']['regularMarketPrice']);

    // Benutzer-Guthaben abrufen
    $userStmt = $conn->prepare("SELECT accountbalance FROM users WHERE id = ?");
    $userStmt->bind_param("i", $user_id);
    $userStmt->execute();
    $userResult = $userStmt->get_result();
    $user = $userResult->fetch_assoc();
    
    if (!$user) {
        throw new Exception('User not found with ID: ' . $user_id);
    }

    $userBalance = floatval($user['accountbalance']);

    // Portfolio-Position abrufen (für Verkauf)
    $portfolioStmt = $conn->prepare("SELECT * FROM portfolio WHERE user_id = ? AND asset_symbol = ?");
    $portfolioStmt->bind_param("is", $user_id, $asset_symbol);
    $portfolioStmt->execute();
    $portfolioResult = $portfolioStmt->get_result();
    $portfolio = $portfolioResult->fetch_assoc();

    $conn->begin_transaction();

    try {
        if ($action === 'buy') {
            // KAUF-LOGIK
            $euroAmount = isset($data->euro_amount) ? floatval($data->euro_amount) : 0;
            $assetQuantity = isset($data->asset_quantity) ? floatval($data->asset_quantity) : 0;
            
            // Berechnung basierend auf Eingabe
            if ($euroAmount > 0) {
                $totalAmount = $euroAmount;
                $quantity = $euroAmount / $currentPrice;
            } elseif ($assetQuantity > 0) {
                $quantity = $assetQuantity;
                $totalAmount = $assetQuantity * $currentPrice;
            } else {
                throw new Exception('Please specify either euro_amount or asset_quantity');
            }

            // Guthaben prüfen
            if ($totalAmount > $userBalance) {
                throw new Exception('Insufficient funds. Available: ' . $userBalance . ', Required: ' . $totalAmount);
            }

            // Portfolio-Eintrag erstellen oder aktualisieren
            if ($portfolio) {
                // Bestehende Position aktualisieren
                $newQuantity = $portfolio['quantity'] + $quantity;
                $newTotalInvested = $portfolio['total_invested'] + $totalAmount;
                $newAvgPrice = $newTotalInvested / $newQuantity;
                
                $updateStmt = $conn->prepare("UPDATE portfolio SET quantity = ?, avg_purchase_price = ?, total_invested = ? WHERE id = ?");
                $updateStmt->bind_param("dddi", $newQuantity, $newAvgPrice, $newTotalInvested, $portfolio['id']);
                $updateStmt->execute();
                $portfolio_id = $portfolio['id'];
            } else {
                // Neue Position erstellen
                $insertStmt = $conn->prepare("INSERT INTO portfolio (user_id, asset_symbol, quantity, avg_purchase_price, total_invested) VALUES (?, ?, ?, ?, ?)");
                $insertStmt->bind_param("isddd", $user_id, $asset_symbol, $quantity, $currentPrice, $totalAmount);
                $insertStmt->execute();
                $portfolio_id = $conn->insert_id;
            }

            // Guthaben abziehen
            $balanceStmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance - ? WHERE id = ?");
            $balanceStmt->bind_param("di", $totalAmount, $user_id);
            $balanceStmt->execute();

        } else {
            // VERKAUF-LOGIK
            $euroAmount = isset($data->euro_amount) ? floatval($data->euro_amount) : 0;
            $assetQuantity = isset($data->asset_quantity) ? floatval($data->asset_quantity) : 0;
            $sellPercentage = isset($data->sell_percentage) ? floatval($data->sell_percentage) : 0;
            
            if (!$portfolio || $portfolio['quantity'] <= 0) {
                throw new Exception('No assets to sell');
            }

            // Berechnung basierend auf Eingabe
            if ($sellPercentage > 0) {
                $quantity = $portfolio['quantity'] * ($sellPercentage / 100);
                $totalAmount = $quantity * $currentPrice;
            } elseif ($euroAmount > 0) {
                $totalAmount = $euroAmount;
                $quantity = $euroAmount / $currentPrice;
            } elseif ($assetQuantity > 0) {
                $quantity = $assetQuantity;
                $totalAmount = $assetQuantity * $currentPrice;
            } else {
                throw new Exception('Please specify euro_amount, asset_quantity, or sell_percentage');
            }

            // Verfügbare Menge prüfen (mit Toleranz für Rundungsfehler)
            if ($quantity > ($portfolio['quantity'] + 0.00000001)) {
                throw new Exception('Insufficient assets to sell. Available: ' . $portfolio['quantity'] . ', Requested: ' . $quantity);
            }

            // Portfolio aktualisieren
            $remainingQuantity = $portfolio['quantity'] - $quantity;
            
            // Wenn die verbleibende Menge sehr klein ist (Rundungsfehler), setze sie auf 0
            if ($remainingQuantity < 0.00000001) {
                $remainingQuantity = 0;
            }
            
            $remainingInvested = $portfolio['total_invested'] * ($remainingQuantity / $portfolio['quantity']);
            
            if ($remainingQuantity > 0) {
                $updateStmt = $conn->prepare("UPDATE portfolio SET quantity = ?, total_invested = ? WHERE id = ?");
                $updateStmt->bind_param("ddi", $remainingQuantity, $remainingInvested, $portfolio['id']);
                $updateStmt->execute();
            } else {
                // Position komplett verkauft - löschen
                $deleteStmt = $conn->prepare("DELETE FROM portfolio WHERE id = ?");
                $deleteStmt->bind_param("i", $portfolio['id']);
                $deleteStmt->execute();
            }

            // Guthaben hinzufügen
            $balanceStmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance + ? WHERE id = ?");
            $balanceStmt->bind_param("di", $totalAmount, $user_id);
            $balanceStmt->execute();
            
            $portfolio_id = $portfolio['id'];
        }

        // Transaktion in Historie eintragen
        $transactionStmt = $conn->prepare("INSERT INTO transactions (user_id, asset_symbol, type, quantity, price_per_unit, total_amount, portfolio_id) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $transactionStmt->bind_param("issdddi", $user_id, $asset_symbol, $action, $quantity, $currentPrice, $totalAmount, $portfolio_id);
        $transactionStmt->execute();

        $conn->commit();

        // Aktualisiertes Portfolio zurückgeben
        $newPortfolioStmt = $conn->prepare("SELECT * FROM portfolio WHERE user_id = ? AND asset_symbol = ?");
        $newPortfolioStmt->bind_param("is", $user_id, $asset_symbol);
        $newPortfolioStmt->execute();
        $newPortfolioResult = $newPortfolioStmt->get_result();
        $newPortfolio = $newPortfolioResult->fetch_assoc();

        // Aktualisiertes Guthaben abrufen
        $newBalanceStmt = $conn->prepare("SELECT accountbalance FROM users WHERE id = ?");
        $newBalanceStmt->bind_param("i", $user_id);
        $newBalanceStmt->execute();
        $newBalanceResult = $newBalanceStmt->get_result();
        $newBalance = $newBalanceResult->fetch_assoc();

        echo json_encode([
            'success' => true,
            'message' => ucfirst($action) . ' erfolgreich',
            'data' => [
                'action' => $action,
                'asset_symbol' => $asset_symbol,
                'quantity' => $quantity,
                'price_per_unit' => $currentPrice,
                'total_amount' => $totalAmount,
                'new_balance' => $newBalance['accountbalance'],
                'portfolio_position' => $newPortfolio
            ]
        ]);

    } catch (Exception $e) {
        $conn->rollback();
        throw $e;
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage()
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}
?> 