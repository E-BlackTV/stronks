<?php
// Clear any previous output
if (ob_get_level()) ob_end_clean();

// Specific origin instead of wildcard
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// Handle preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Set content type
header('Content-Type: application/json');

// Error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0);

try {
    // Database connection
    $conn = new mysqli("localhost", "root", "", "ionic_app");

    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    // Get and validate request data
    $data = json_decode(file_get_contents("php://input"));

    if (!$data || 
        !isset($data->user_id) || 
        !isset($data->investments) || 
        !isset($data->shares) || 
        !isset($data->amount) || 
        !isset($data->purchase_price) ||
        $data->shares <= 0) {  // Added validation for shares
        throw new Exception('Missing or invalid data');
    }

    // Optional: Calculate and verify shares
    $calculated_shares = $data->amount / $data->purchase_price;
    if (abs($calculated_shares - $data->shares) > 0.00001) { // Small difference allowed for floating point
        throw new Exception('Share calculation mismatch');
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

    // Changed to check against amount instead of investments
    if (!$user || $user['accountbalance'] < $data->amount) {
        throw new Exception('Insufficient funds');
    }

    // Start transaction
    $conn->begin_transaction();

    try {
        // Debug logging
        error_log('Received data: ' . print_r($data, true));

        // Insert purchase into depot
        $stmt = $conn->prepare("INSERT INTO depot (user_id, investments, shares, amount, purchase_price) VALUES (?, ?, ?, ?, ?)");
        if (!$stmt) {
            throw new Exception($conn->error);
        }

        // Debug logging
        error_log('Shares value: ' . $data->shares);
        
        $stmt->bind_param("isddd", 
            $data->user_id, 
            $data->investments,
            $data->shares,      // Make sure this is being passed correctly
            $data->amount,
            $data->purchase_price
        );

        if (!$stmt->execute()) {
            throw new Exception($stmt->error);
        }

        // Update account balance - changed to use amount
        $stmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance - ? WHERE id = ?");
        $stmt->bind_param("di", $data->amount, $data->user_id);
        $stmt->execute();

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