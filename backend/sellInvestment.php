<?php

header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$data = json_decode(file_get_contents("php://input"));

if (!isset($data->user_id) || !isset($data->investment_id)) {
    die(json_encode(["success" => false, "message" => "Missing parameters"]));
}

$conn = new mysqli("localhost", "root", "", "ionic_app");

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed"]));
}

try {
    $conn->begin_transaction();

    // Get investment details including amount and purchase_price
    $stmt = $conn->prepare("SELECT amount, purchase_price FROM depot WHERE id = ? AND user_id = ?");
    $stmt->bind_param("ii", $data->investment_id, $data->user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($row = $result->fetch_assoc()) {
        // Convert strings to float with high precision
        $amount = floatval($row['amount']);
        $purchasePrice = floatval($row['purchase_price']);
        
        // Calculate shares with high precision
        $shares = bcdiv($amount, $purchasePrice, 8);
        
        // Get current Bitcoin price from cache
        $priceStmt = $conn->prepare("SELECT data FROM cached_data WHERE symbol = 'BTC-USD' ORDER BY last_updated DESC LIMIT 1");
        $priceStmt->execute();
        $priceResult = $priceStmt->get_result();
        $priceData = json_decode($priceResult->fetch_assoc()['data'], true);
        
        // Get and convert current price
        $currentPrice = floatval($priceData['chart']['result'][0]['meta']['regularMarketPrice']);
        
        // Calculate sell value with high precision
        $sellValue = bcmul($shares, $currentPrice, 8);
        
        // Debug logging
        error_log("Sell calculation: " . print_r([
            'amount' => $amount,
            'purchasePrice' => $purchasePrice,
            'shares' => $shares,
            'currentPrice' => $currentPrice,
            'sellValue' => $sellValue
        ], true));

        // Update user's balance with precise value
        $stmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance + ? WHERE id = ?");
        $stmt->bind_param("di", $sellValue, $data->user_id);
        $stmt->execute();
        
        // Delete the investment
        $stmt = $conn->prepare("DELETE FROM depot WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $data->investment_id, $data->user_id);
        $stmt->execute();
        
        $conn->commit();
        echo json_encode([
            "success" => true, 
            "message" => "Investment sold successfully",
            "debug" => [
                "shares" => $shares,
                "currentPrice" => $currentPrice,
                "sellValue" => $sellValue
            ]
        ]);
    } else {
        throw new Exception("Investment not found");
    }
} catch (Exception $e) {
    $conn->rollback();
    echo json_encode(["success" => false, "message" => $e->getMessage()]);
}

$conn->close();