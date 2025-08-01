<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    require_once 'config.php';
    setCORSHeaders();

    $conn = getDBConnection();
    
    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    $user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
    
    if (!$user_id) {
        throw new Exception('User ID required');
    }

    // Portfolio-Positionen abrufen
    $portfolioStmt = $conn->prepare("
        SELECT p.*, a.name as asset_name, a.type as asset_type
        FROM portfolio p
        JOIN assets a ON p.asset_symbol = a.symbol
        WHERE p.user_id = ? AND p.quantity > 0
        ORDER BY p.total_invested DESC
    ");
    $portfolioStmt->bind_param("i", $user_id);
    $portfolioStmt->execute();
    $portfolioResult = $portfolioStmt->get_result();
    
    $portfolio = [];
    $total_invested = 0;
    $total_value = 0;
    
    while ($row = $portfolioResult->fetch_assoc()) {
        // Aktuellen Preis abrufen
        $priceStmt = $conn->prepare("SELECT data FROM cached_data WHERE symbol = ? ORDER BY last_updated DESC LIMIT 1");
        $priceStmt->bind_param("s", $row['asset_symbol']);
        $priceStmt->execute();
        $priceResult = $priceStmt->get_result();
        
        $current_price = 0;
        if ($priceResult->num_rows > 0) {
            $priceData = json_decode($priceResult->fetch_assoc()['data'], true);
            $current_price = floatval($priceData['chart']['result'][0]['meta']['regularMarketPrice']);
        }
        
        // Aktuelle Werte berechnen
        $current_value = $row['quantity'] * $current_price;
        $profit_loss = $current_value - $row['total_invested'];
        $profit_loss_percent = $row['total_invested'] > 0 ? ($profit_loss / $row['total_invested']) * 100 : 0;
        
        $portfolio[] = [
            'id' => $row['id'],
            'asset_symbol' => $row['asset_symbol'],
            'quantity' => $row['quantity'],
            'total_invested' => $row['total_invested'],
            'current_price' => $current_price,
            'current_value' => $current_value,
            'profit_loss' => $profit_loss,
            'profit_loss_percent' => $profit_loss_percent
        ];
        
        $total_invested += $row['total_invested'];
        $total_value += $current_value;
    }
    
    // Gesamte Gewinne/Verluste berechnen
    $total_profit_loss = $total_value - $total_invested;
    $total_profit_loss_percent = $total_invested > 0 ? ($total_profit_loss / $total_invested) * 100 : 0;
    
    // Bargeld aus users.accountbalance holen
    $balance_query = "SELECT accountbalance FROM users WHERE id = ?";
    $balance_stmt = $conn->prepare($balance_query);
    $balance_stmt->bind_param("i", $user_id);
    $balance_stmt->execute();
    $balance_result = $balance_stmt->get_result();
    $balance_row = $balance_result->fetch_assoc();
    $cash_balance = $balance_row ? $balance_row['accountbalance'] : 0;
    
    // Gesamten Portfoliowert = Bargeld + Portfolio-Wert
    $total_portfolio_value = $cash_balance + $total_value;
    
    echo json_encode([
        'success' => true,
        'portfolio' => $portfolio,
        'summary' => [
            'total_invested' => $total_invested,
            'total_value' => $total_value,
            'total_profit_loss' => $total_profit_loss,
            'total_profit_loss_percent' => $total_profit_loss_percent,
            'cash_balance' => $cash_balance,
            'total_portfolio_value' => $total_portfolio_value
        ]
    ]);

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