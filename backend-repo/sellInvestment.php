<?php
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';
setCORSHeaders();

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->user_id) || !isset($data->portfolio_id) || !isset($data->sell_percentage)) {
    die(json_encode(["success" => false, "message" => "Missing parameters"]));
}

$conn = getDBConnection();

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed"]));
}

try {
    $conn->begin_transaction();

    // Get portfolio details
    $stmt = $conn->prepare("SELECT * FROM portfolio WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $data->portfolio_id, $data->user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        $quantity = floatval($row['quantity']);
        $totalInvested = floatval($row['total_invested']);
        $assetSymbol = $row['asset_symbol'];
        
        // Calculate sell quantity based on percentage
        $sellQuantity = $quantity * ($data->sell_percentage / 100);
        $sellInvested = $totalInvested * ($data->sell_percentage / 100);
        
        // Get current price from cache
        $priceStmt = $conn->prepare("SELECT data FROM cached_data WHERE symbol = ? ORDER BY last_updated DESC LIMIT 1");
        $priceStmt->bind_param("s", $assetSymbol);
        $priceStmt->execute();
        $priceResult = $priceStmt->get_result();
        
        if ($priceResult->num_rows === 0) {
            throw new Exception("Current price not available");
        }
        
        $priceData = json_decode($priceResult->fetch_assoc()['data'], true);
        $currentPrice = floatval($priceData['chart']['result'][0]['meta']['regularMarketPrice']);
        
        // Calculate sell value
        $sellValue = $sellQuantity * $currentPrice;
        
        // Update user's balance
        $stmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance + ? WHERE id = ?");
        $stmt->bind_param("di", $sellValue, $data->user_id);
        $stmt->execute();
        
        // Update or delete portfolio position
        $remainingQuantity = $quantity - $sellQuantity;
        $remainingInvested = $totalInvested - $sellInvested;
        
        if ($remainingQuantity > 0) {
            // Update portfolio position
            $updateStmt = $conn->prepare("UPDATE portfolio SET quantity = ?, total_invested = ? WHERE id = ?");
            $updateStmt->bind_param("ddi", $remainingQuantity, $remainingInvested, $data->portfolio_id);
            $updateStmt->execute();
        } else {
            // Delete portfolio position completely
            $deleteStmt = $conn->prepare("DELETE FROM portfolio WHERE id = ?");
            $deleteStmt->bind_param("i", $data->portfolio_id);
            $deleteStmt->execute();
        }
        
        // Insert transaction record
        $transactionStmt = $conn->prepare("INSERT INTO transactions (user_id, asset_symbol, type, quantity, price_per_unit, total_amount, portfolio_id) VALUES (?, ?, 'sell', ?, ?, ?, ?)");
        $transactionStmt->bind_param("issddi", $data->user_id, $assetSymbol, $sellQuantity, $currentPrice, $sellValue, $data->portfolio_id);
        $transactionStmt->execute();
        
        $conn->commit();
        echo json_encode([
            "success" => true, 
            "message" => "Investment sold successfully",
            "data" => [
                "sellQuantity" => $sellQuantity,
                "currentPrice" => $currentPrice,
                "sellValue" => $sellValue,
                "remainingQuantity" => $remainingQuantity
            ]
        ]);
    } else {
        throw new Exception("Portfolio position not found");
    }
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

$conn->close();
?>