<?php
require_once('config.php');

// Define RAPIDAPI_KEY and RAPIDAPI_HOST if not already defined
if (!defined('RAPIDAPI_KEY')) {
    define('RAPIDAPI_KEY', 'your-rapidapi-key-here'); // Replace with your actual RapidAPI key
}

if (!defined('RAPIDAPI_HOST')) {
    define('RAPIDAPI_HOST', 'yahoo-finance166.p.rapidapi.com'); // Replace with your actual RapidAPI host
}

// Clear any previous output
if (ob_get_level()) ob_end_clean();

// Specific origin instead of wildcard
header("Access-Control-Allow-Origin: *");
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
$cacheExpiry = 36;

// API-Parameter
$symbol = isset($_GET['symbol']) ? $_GET['symbol'] : 'BTC-USD';
$range = isset($_GET['range']) ? $_GET['range'] : '1d';
$interval = isset($_GET['interval']) ? $_GET['interval'] : '5m';

$period1 = isset($_GET['period1']) ? (int)$_GET['period1'] : strtotime('-1 day');
$period2 = isset($_GET['period2']) ? (int)$_GET['period2'] : time();

$url = "https://query1.finance.yahoo.com/v8/finance/chart/{$symbol}?" .
       "range={$range}&" .
       "interval={$interval}&" .
       "includePrePost=false&" .
       "useYfid=true&" .
       "lang=en-US&" .
       "region=US";

// Create a unique cache key for this combination
$cacheKey = "{$symbol}_{$range}_{$interval}";

// Check cache first
$stmt = $conn->prepare("SELECT data, last_updated FROM cached_data 
    WHERE symbol = ? AND range_period = ? AND interval_period = ?");
$stmt->bind_param("sss", $symbol, $range, $interval);
$stmt->execute();
$result = $stmt->get_result();

if ($result && $result->num_rows > 0) {
    $row = $result->fetch_assoc();
    $lastUpdated = strtotime($row['last_updated']);
    if (time() - $lastUpdated < $cacheExpiry) {
        header('X-Cache: HIT');
        echo $row['data'];
        exit;
    }
}

// Cache miss - fetch from RapidAPI
$url = "https://yahoo-finance166.p.rapidapi.com/api/stock/get-chart";
$params = http_build_query([
    "symbol" => $symbol,
    "region" => "US",
    "range" => $range,
    "interval" => $interval
]);
$fullUrl = $url . "?" . $params;

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
    error_log("RapidAPI call failed: " . curl_error($ch));
    http_response_code(503);
    echo json_encode(["error" => "Service temporarily unavailable"]);
    curl_close($ch);
    exit;
}

$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200) {
    // Store in cache using prepared statement
    $stmt = $conn->prepare("INSERT INTO cached_data 
        (symbol, range_period, interval_period, data, last_updated) 
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
        data = VALUES(data),
        last_updated = NOW()");
    
    $stmt->bind_param("ssss", 
        $symbol,
        $range,
        $interval,
        $response
    );
    
    if (!$stmt->execute()) {
        error_log("Failed to store in cache: " . $stmt->error);
    }
    
    header('X-Cache: MISS');
    echo $response;
} else {
    error_log("RapidAPI returned error: $httpCode");
    http_response_code($httpCode);
    echo json_encode(["error" => "Failed to fetch data"]);
}

$conn->close();
?>