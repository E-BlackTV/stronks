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

// Erstelle eine Verbindung zur Datenbank
$conn = new mysqli($servername, $username, $password, $database);

// Überprüfe die Verbindung
if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

// Empfangene Daten auslesen
$data = json_decode(file_get_contents("php://input"), true);
$user = $data["username"];
$pass = $data["password"];

// Überprüfen, ob der Benutzername und das Passwort gesetzt sind
if (empty($user) || empty($pass)) {
    echo json_encode(["success" => false, "message" => "Benutzername und Passwort sind erforderlich."]);
    exit;
}
// Passwort hashen
$hashed_password = password_hash($pass, PASSWORD_BCRYPT);

// Überprüfen, ob der Benutzer bereits existiert
$sql = "SELECT * FROM users WHERE username = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $user);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    echo json_encode(["success" => false, "message" => "Benutzername bereits vergeben."]);
} else {
    // Neuen Benutzer registrieren
    $sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $user, $hashed_password);
    
    if ($stmt->execute()) {
        echo json_encode(["success" => true, "message" => "Registrierung erfolgreich."]);
    } else {
        echo json_encode(["success" => false, "message" => "Fehler bei der Registrierung."]);
    }
}

$stmt->close();
$conn->close();
?>
