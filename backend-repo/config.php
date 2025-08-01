<?php
// Datenbank-Konfiguration für Plesk Server
// ERsetze diese Werte mit deinen echten Plesk-Datenbankdaten!
define('DB_HOST', 'localhost');
define('DB_USER', 'ionic_user'); // Ersetze mit deinem DB-Username aus Plesk
define('DB_PASS', 'y$2d6Om64'); // Ersetze mit deinem DB-Password aus Plesk
define('DB_NAME', 'web053');     // Ersetze mit deinem DB-Namen aus Plesk

// Hilfsfunktion für Datenbankverbindung
function getDBConnection() {
    $conn = new mysqli(DB_HOST, DB_USER, DB_PASS, DB_NAME);
    
    if ($conn->connect_error) {
        die(json_encode([
            "success" => false, 
            "message" => "Database connection failed: " . $conn->connect_error
        ]));
    }
    
    return $conn;
}

// CORS-Headers für alle API-Endpunkte (IIS-kompatibel)
function setCORSHeaders() {
    // Nur setzen wenn noch nicht gesetzt
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
        header('Access-Control-Max-Age: 86400');
        header('Access-Control-Allow-Credentials: true');
    }
    
    // Preflight OPTIONS request behandeln
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit(0);
    }
}
?>