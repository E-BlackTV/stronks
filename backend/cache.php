<?php
require_once('config.php');

// Clear any previous output
if (ob_get_level()) ob_end_clean();

// Specific origin instead of wildcard
header("Access-Control-Allow-Origin: http://localhost:4200");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-RapidAPI-Key");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Set content type for all responses
header('Content-Type: application/json');

// Enable error reporting
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// cache.php

// Datenbank-Zugangsdaten
$servername = "localhost";
$username = "root";
$password = "";
$database = "ionic_app";

// Create database connection
$conn = new mysqli($servername, $username, $password, $database);

// Check connection
if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed: " . $conn->connect_error]));
}

// Cache-Ablaufzeit in Sekunden (z. B. 3600 = 1 Stunde)
$cacheExpiry = 3600000;

// API-Parameter
$symbol = "BTC-USD";
$range = "1y";
$interval = "1mo";
$region = "EUROPE";

// Prüfen, ob frische Cache-Daten vorliegen
$sql = "SELECT data, last_updated FROM cached_data WHERE symbol = '$symbol'";
$result = $conn->query($sql);
$useCache = false;
if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $lastUpdated = strtotime($row['last_updated']);
    if (time() - $lastUpdated < $cacheExpiry) {
        // Cache hit
        error_log("Cache hit for symbol: $symbol");
        header('Content-Type: application/json');
        header('Cache-Control: public, max-age=' . $cacheExpiry);
        header('X-Cache: HIT');
        echo $row['data'];
        exit;
    }
    error_log("Cache expired for symbol: $symbol");
}

// Cache miss - fetch from API
error_log("Cache miss for symbol: $symbol");
$url = "https://yahoo-finance166.p.rapidapi.com/api/stock/get-chart";
$params = http_build_query([
    "symbol" => $symbol,
    "region" => $region,
    "range" => $range,
    "interval" => $interval
]);
$fullUrl = $url . "?" . $params;

// Debug: Log all headers
error_log("Received headers: " . print_r(getallheaders(), true));
 
$headers = [
    'X-RapidAPI-Key: ' . RAPIDAPI_KEY,
    'X-RapidAPI-Host: ' . RAPIDAPI_HOST
];

$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $fullUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
curl_setopt($ch, CURLOPT_TIMEOUT, 10);
$response = curl_exec($ch);

if (curl_errno($ch)) {
    error_log("API call failed: " . curl_error($ch));
    http_response_code(503);
    echo json_encode(["error" => "Service temporarily unavailable"]);
    curl_close($ch);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200) {
    error_log("API returned non-200 status code: $httpCode with response: $response");
    http_response_code($httpCode);
    echo json_encode(["error" => "Upstream API error"]);
    exit;
}

// Neues Ergebnis in die Datenbank speichern
$escapedResponse = $conn->real_escape_string($response);
$now = date("Y-m-d H:i:s");

if ($result && $result->num_rows > 0) {
    // Vorhandenen Cache aktualisieren
    $sql = "UPDATE cached_data SET data='$escapedResponse', last_updated='$now' WHERE symbol='$symbol'";
} else {
    // Neuen Cache-Eintrag anlegen
    $sql = "INSERT INTO cached_data (symbol, data, last_updated) VALUES ('$symbol', '$escapedResponse', '$now')";
}
$conn->query($sql);
$conn->close();

header('Content-Type: application/json');
echo $response;
exit;
?>