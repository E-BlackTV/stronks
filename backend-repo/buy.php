<?php
// Clear any previous output
if (ob_get_level()) ob_end_clean();

// Error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // Database connection
    require_once 'config.php';
    setCORSHeaders();

    $conn = getDBConnection();

    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    // Get and validate request data
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || 
        !isset($data->user_id) || 
        !isset($data->asset_symbol) || 
        !isset($data->quantity) || 
        !isset($data->amount) || 
        !isset($data->current_price) ||
        $data->quantity <= 0) {
        throw new Exception('Missing or invalid data');
    }

    // Check account balance
    $stmt = $conn->prepare("SELECT accountbalance FROM users WHERE id = ?");
    if (!$stmt) {
        throw new Exception($conn->error);
    }
    
    $stmt->bind_param("i", $data->user_id);
    $stmt->execute();
    $result = $stmt->get_result();
    $user = $result->fetch_assoc();

    if (!$user || $user['accountbalance'] < $data->amount) {
        throw new Exception('Insufficient funds');
    }

    // Start transaction
    $conn->begin_transaction();

    try {
        // Debug logging
        error_log('Received data: ' . print_r($data, true));

        // Check if asset exists in assets table
        $assetStmt = $conn->prepare("SELECT * FROM assets WHERE symbol = ?");
        $assetStmt->bind_param("s", $data->asset_symbol);
        $assetStmt->execute();
        $assetResult = $assetStmt->get_result();
        
        if ($assetResult->num_rows === 0) {
            // Asset doesn't exist, create it
            $insertAssetStmt = $conn->prepare("INSERT INTO assets (symbol, name, type) VALUES (?, ?, 'crypto')");
            $assetName = str_replace('-USD', '', $data->asset_symbol);
            $insertAssetStmt->bind_param("ss", $data->asset_symbol, $assetName);
            $insertAssetStmt->execute();
        }

        // Check if user already has this asset in portfolio
        $portfolioStmt = $conn->prepare("SELECT * FROM portfolio WHERE user_id = ? AND asset_symbol = ?");
        $portfolioStmt->bind_param("is", $data->user_id, $data->asset_symbol);
        $portfolioStmt->execute();
        $portfolioResult = $portfolioStmt->get_result();
        $existingPortfolio = $portfolioResult->fetch_assoc();

        if ($existingPortfolio) {
            // Update existing portfolio position
            $newQuantity = $existingPortfolio['quantity'] + $data->quantity;
            $newTotalInvested = $existingPortfolio['total_invested'] + $data->amount;
            $newAvgPrice = $newTotalInvested / $newQuantity;
            
            $updateStmt = $conn->prepare("UPDATE portfolio SET quantity = ?, avg_purchase_price = ?, total_invested = ? WHERE id = ?");
            $updateStmt->bind_param("dddi", $newQuantity, $newAvgPrice, $newTotalInvested, $existingPortfolio['id']);
            $updateStmt->execute();
            $portfolio_id = $existingPortfolio['id'];
        } else {
            // Create new portfolio position
            $insertStmt = $conn->prepare("INSERT INTO portfolio (user_id, asset_symbol, quantity, avg_purchase_price, total_invested) VALUES (?, ?, ?, ?, ?)");
            $insertStmt->bind_param("isddd", $data->user_id, $data->asset_symbol, $data->quantity, $data->current_price, $data->amount);
            $insertStmt->execute();
            $portfolio_id = $conn->insert_id;
        }

        // Update account balance
        $stmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance - ? WHERE id = ?");
        $stmt->bind_param("di", $data->amount, $data->user_id);
        $stmt->execute();

        // Insert transaction record
        $transactionStmt = $conn->prepare("INSERT INTO transactions (user_id, asset_symbol, type, quantity, price_per_unit, total_amount, portfolio_id) VALUES (?, ?, 'buy', ?, ?, ?, ?)");
        $transactionStmt->bind_param("issddi", $data->user_id, $data->asset_symbol, $data->quantity, $data->current_price, $data->amount, $portfolio_id);
        $transactionStmt->execute();

        $conn->commit();
        echo json_encode([
            'success' => true,
            'message' => 'Kauf erfolgreich'
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