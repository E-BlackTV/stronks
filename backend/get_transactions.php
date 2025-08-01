<?php
require_once 'config.php';
setCORSHeaders();

$conn = getDBConnection();

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 50;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;

if (!$user_id) {
    die(json_encode(["success" => false, "message" => "Invalid user ID"]));
}

try {
    // Transaktionen abrufen
    $stmt = $conn->prepare("
        SELECT t.*, a.name as asset_name, a.type as asset_type
        FROM transactions t
        JOIN assets a ON t.asset_symbol = a.symbol
        WHERE t.user_id = ?
        ORDER BY t.transaction_date DESC
        LIMIT ? OFFSET ?
    ");
    $stmt->bind_param("iii", $user_id, $limit, $offset);
    $stmt->execute();
    $result = $stmt->get_result();

    $transactions = [];
    while ($row = $result->fetch_assoc()) {
        $transaction = [
            'id' => $row['id'],
            'asset_symbol' => $row['asset_symbol'],
            'asset_name' => $row['asset_name'],
            'asset_type' => $row['asset_type'],
            'type' => $row['type'],
            'quantity' => floatval($row['quantity']),
            'price_per_unit' => floatval($row['price_per_unit']),
            'total_amount' => floatval($row['total_amount']),
            'transaction_date' => $row['transaction_date'],
            'formatted_date' => date('d.m.Y H:i', strtotime($row['transaction_date']))
        ];
        
        $transactions[] = $transaction;
    }

    // Gesamtanzahl der Transaktionen für Pagination
    $countStmt = $conn->prepare("SELECT COUNT(*) as total FROM transactions WHERE user_id = ?");
    $countStmt->bind_param("i", $user_id);
    $countStmt->execute();
    $countResult = $countStmt->get_result();
    $totalCount = $countResult->fetch_assoc()['total'];

    echo json_encode([
        "success" => true,
        "transactions" => $transactions,
        "pagination" => [
            "total" => (int)$totalCount,
            "limit" => $limit,
            "offset" => $offset,
            "has_more" => ($offset + $limit) < $totalCount
        ]
    ]);

} catch (Exception $e) {
    echo json_encode([
        "success" => false,
        "message" => $e->getMessage()
    ]);
}

$conn->close();
?> 