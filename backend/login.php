<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

header('Content-Type: application/json');
$servername = "localhost";
$username = "root";
$password = "";
$database = "ionic_app";

$conn = new mysqli($servername, $username, $password, $database);

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

$data = json_decode(file_get_contents("php://input"), true);

if (!isset($data["username"]) || !isset($data["password"])) {
    echo json_encode(["success" => false, "message" => "Benutzername und Passwort sind erforderlich."]);
    exit;
}

$username = $data["username"];
$password = $data["password"];

// Enhanced debugging output
file_put_contents('php://stderr', "Received username: " . $username . "\n");
file_put_contents('php://stderr', "Received password: " . $password . "\n");

$sql = "SELECT * FROM users WHERE username = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    file_put_contents('php://stderr', "Found user in database\n");
    file_put_contents('php://stderr', "Stored hash: " . $user['password'] . "\n");
    
    if (password_verify($password, $user['password'])) {
        file_put_contents('php://stderr', "Password verification successful\n");
        echo json_encode(["success" => true, "message" => "Login successful"]);
    } else {
        file_put_contents('php://stderr', "Password verification failed\n");
        echo json_encode(["success" => false, "message" => "Invalid credentials"]);
    }
} else {
    file_put_contents('php://stderr', "No user found with this username\n");
    echo json_encode(["success" => false, "message" => "Invalid credentials"]);
}

$stmt->close();
$conn->close();
?>