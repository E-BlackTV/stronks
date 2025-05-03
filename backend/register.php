<?php
<?php
// CORS Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");

// Preflight OPTIONS abfangen und direkt beenden
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

ini_set('display_errors', 0); // Disable error display in production
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

$servername = "localhost";
$username = "root";
$password = "";
$database = "ionic_app";

// Create connection with proper error handling
$conn = new mysqli($servername, $username, $password, $database);

if ($conn->connect_error) {
    http_response_code(500);
    echo json_encode([
        "success" => false, 
        "message" => "Connection failed: " . $conn->connect_error
    ]);
    exit;
}

// Empfangene Daten auslesen
$data = json_decode(file_get_contents("php://input"), true);
$user = $data["username"];
$pass = $data["password"];

// Überprüfen, ob der Benutzername und das Passwort gesetzt sind
if (empty($user) || empty($pass)) {
    http_response_code(400);
    echo json_encode([
        "success" => false, 
        "message" => "Benutzername und Passwort sind erforderlich."
    ]);
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
    http_response_code(409); // Conflict
    echo json_encode([
        "success" => false, 
        "message" => "Benutzername bereits vergeben."
    ]);
} else {
    // Neuen Benutzer registrieren
    $sql = "INSERT INTO users (username, password) VALUES (?, ?)";
    $stmt = $conn->prepare($sql);
    $stmt->bind_param("ss", $user, $hashed_password);
    
    if ($stmt->execute()) {
        http_response_code(201); // Created
        echo json_encode([
            "success" => true, 
            "message" => "Registrierung erfolgreich."
        ]);
    } else {
        http_response_code(500);
        echo json_encode([
            "success" => false, 
            "message" => "Fehler bei der Registrierung."
        ]);
    }
}

$stmt->close();
$conn->close();
?>
