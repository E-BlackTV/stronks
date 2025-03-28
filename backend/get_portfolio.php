<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET");
header("Access-Control-Allow-Headers: Content-Type");
header('Content-Type: application/json');

$servername = "localhost";
$username = "root";
$password = "";
$database = "ionic_app";

$conn = new mysqli($servername, $username, $password, $database);

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