<?php
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

$stmt = $conn->prepare("SELECT accountbalance FROM users WHERE id = ?");
$stmt->bind_param("i", $user_id);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if ($user) {
    echo json_encode([
        "success" => true,
        "balance" => (float)$user['accountbalance']
    ]);
} else {
    echo json_encode([
        "success" => false,
        "message" => "User not found"
    ]);
}

$conn->close();
?>