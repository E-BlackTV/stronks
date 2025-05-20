<?php
// Load configuration
$configPath = __DIR__ . '/../config.json';
if (!file_exists($configPath)) {
    http_response_code(500);
    error_log('config.json not found at: ' . $configPath);
    echo json_encode(['error' => 'Configuration file missing']);
    exit;
}

$cfg = json_decode(file_get_contents($configPath), true);
if (!$cfg) {
    http_response_code(500);
    error_log('Invalid JSON in config.json: ' . json_last_error_msg());
    echo json_encode(['error' => 'Invalid configuration']);
    exit;
}

// Define API credentials from config
define('RAPIDAPI_KEY', $cfg['rapidApiKey']);  //Wahrscheinlich liegt es daran dass er keine Daten bekommt
define('RAPIDAPI_HOST', $cfg['rapidApiHost']);// -------""---------- Config.json + environment.ts anschauen.!!!

// Enable error logging
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);
error_log("Starting cache.php request");

// CORS headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Credentials: true");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, X-RapidAPI-Key");
header('Content-Type: application/json');

// Clear output buffer
if (ob_get_level()) ob_end_clean();

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Database connection
$servername = "localhost";
$username = "root";
$password = "";
$database = "ionic_app";

$conn = new mysqli($servername, $username, $password, $database);

if ($conn->connect_error) {
    error_log("Database connection failed: " . $conn->connect_error);
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Database connection failed",
        "error" => $conn->connect_error
    ]);
    exit;
}

// Cache-Ablaufzeit in Sekunden (z. B. 3600 = 1 Stunde)
$cacheExpiry = 3600;

// Get and validate parameters
$symbol = isset($_GET['symbol']) ? $_GET['symbol'] : 'BTC-USD';
// Ensure the symbol is properly formatted for crypto
if (strpos($symbol, 'BTC') !== false && strpos($symbol, '-USD') === false) {
    $symbol = 'BTC-USD';
}

$range = isset($_GET['range']) ? $_GET['range'] : '1d';
$interval = isset($_GET['interval']) ? $_GET['interval'] : '5m';

$period1 = isset($_GET['period1']) ? (int)$_GET['period1'] : strtotime('-1 day');
$period2 = isset($_GET['period2']) ? (int)$_GET['period2'] : time();

error_log("Requested: symbol=$symbol, range=$range, interval=$interval");

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
    "interval" => $interval,
    "includePrePost" => "false",
    "useYfid" => "true",
    "lang" => "en-US"
]);

$fullUrl = $url . "?" . $params;

$headers = [
    'X-RapidAPI-Key: ' . RAPIDAPI_KEY,
    'X-RapidAPI-Host: ' . RAPIDAPI_HOST
];

// Debug logging
error_log("Requesting URL: " . $url . "?" . $params);
error_log("Using Symbol: " . $symbol);

$ch = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL => $url . "?" . $params,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_ENCODING => "",
    CURLOPT_MAXREDIRS => 10,
    CURLOPT_TIMEOUT => 30,
    CURLOPT_HTTP_VERSION => CURL_HTTP_VERSION_1_1,
    CURLOPT_CUSTOMREQUEST => "GET",
    CURLOPT_HTTPHEADER => [
        "X-RapidAPI-Host: " . RAPIDAPI_HOST,
        "X-RapidAPI-Key: " . RAPIDAPI_KEY
    ],
    CURLOPT_SSL_VERIFYPEER => false // Only for development
]);

$response = curl_exec($ch);
$err = curl_error($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

curl_close($ch);

if ($err) {
    error_log("cURL Error: " . $err);
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "API request failed",
        "error" => $err
    ]);
    exit;
}

if ($httpCode !== 200) {
    error_log("API returned non-200 status: $httpCode");
    error_log("Response: " . $response);
    http_response_code($httpCode);
    echo json_encode([
        "success" => false,
        "message" => "API request failed",
        "status" => $httpCode,
        "response" => json_decode($response)
    ]);
    exit;
}

// Validate JSON response
$data = json_decode($response);
if (json_last_error() !== JSON_ERROR_NONE) {
    error_log("Invalid JSON response: " . json_last_error_msg());
    http_response_code(500);
    echo json_encode([
        "success" => false,
        "message" => "Invalid API response",
        "error" => json_last_error_msg()
    ]);
    exit;
}

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

$conn->close();
?>