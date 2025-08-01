<?php
require_once 'config.php';
setCORSHeaders();

$conn = getDBConnection();

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

$user_id = isset($_GET['user_id']) ? (int)$_GET['user_id'] : 0;

if (!$user_id) {
    die(json_encode(["success" => false, "message" => "Invalid user ID"]));
}

$stmt = $conn->prepare("SELECT * FROM depot WHERE user_id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();

$investments = [];
while ($row = $result->fetch_assoc()) {
    // Convert string values to float for precise calculations
    $investments[] = $row;
}

echo json_encode([
    "success" => true,
    "investments" => $investments
]);

$conn->close();