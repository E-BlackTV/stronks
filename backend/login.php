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

// SQL-Abfrage vorbereiten
$sql = "SELECT password FROM users WHERE username = ?";
$stmt = $conn->prepare($sql);
$stmt->bind_param("s", $username);
$stmt->execute();
$result = $stmt->get_result();

if ($result->num_rows > 0) {
    $user = $result->fetch_assoc();
    $hashed_password = $user['password']; // Passwort-Hash aus der Datenbank
    //zum testen
    //echo json_encode(["success" => true, "message" => "Login erfolgreich", "dbpasswort"=>$hashed_password, "password"=>$password, "valid"=>password_hash($password, PASSWORD_BCRYPT)]);
    //die();
    // Passwort überprüfen
    if (password_verify($password, $hashed_password)) {
        echo json_encode(["success" => true, "message" => "Login erfolgreich"]);
    } else {
        echo json_encode(["success" => false, "message" => "Ungültige Anmeldedaten"]);
    }
} else {
    echo json_encode(["success" => false, "message" => "Benutzer nicht gefunden"]);
}

$stmt->close();
$conn->close();
?>
