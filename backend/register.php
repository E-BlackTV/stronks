<?php
session_start();

header('Content-Type: application/json');

// Preflight OPTIONS handler
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

ini_set('display_errors', 0); // Disable error display in production
error_reporting(E_ALL);

$servername = "localhost";
$username = "root";
$password = "";
$database = "ionic_app";

// Create connection
$conn = new mysqli($servername, $username, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "Connection failed: " . $conn->connect_error
    ]);
    exit;
}

// Parse input data
$data = json_decode(file_get_contents("php://input"), true);
$user = $data["username"];
$pass = $data["password"];

// Validate input
if (empty($user) || empty($pass)) {
    http_response_code(400);
    echo json_encode([
        "success" => false, 
        "message" => "Benutzername und Passwort sind erforderlich."
    ]);
    exit;
}

// Hash password
$hashed_password = password_hash($pass, PASSWORD_BCRYPT);

// Check if user exists
$sql = "SELECT * FROM users WHERE username = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $user);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    http_response_code(409);
    echo json_encode([
        "success" => false, 
        "message" => "Benutzername bereits vergeben."
    ]);
} else {
    // Register new user with default balance
    $sql = "INSERT INTO users (username, password, accountbalance) VALUES (?, ?, ?)";
    $stmt = $conn->prepare($sql);
    $default_balance = 10000.00;
    $stmt->bind_param("ssd", $user, $hashed_password, $default_balance);
    
    if ($stmt->execute()) {
        // Log the user in upon registration
        $_SESSION['user_id'] = $conn->insert_id;
        $_SESSION['username'] = $user;
        $_SESSION['balance'] = $default_balance;
        http_response_code(201);
        echo json_encode([
            "success" => true, 
            "message" => "Registrierung erfolgreich."
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false, 
            "message" => "Fehler bei der Registrierung: " . $conn->error
        ]);
    }
}

$stmt->close();
$conn->close();
?>
