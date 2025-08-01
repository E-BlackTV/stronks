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

// Clear output buffer
if (ob_get_level()) ob_end_clean();

// Database connection
require_once 'config.php';
setCORSHeaders();

$conn = getDBConnection();

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

// Cache-Ablaufzeit in Sekunden (z. B. 3600 = 1 Stunde)
$cacheExpiry = 36000000;

// Liste aller zu cachenden Symbole
$symbols = [
    'BTC-USD', 'ETH-USD', 'SOL-USD', // Kryptowährungen
    'TSLA', 'AAPL', 'MSFT', 'AMZN',  // Aktien
    // beliebig erweiterbar
];

$rangeIntervalMap = [
    '1d'   => ['5m', '15m'],
    '1wk'  => ['5m', '15m', '30m', '1h'],
    '1y'   => ['1d', '1wk', '1mo'],
    '5y'   => ['1wk', '1mo'],
];

foreach ($symbols as $symbol) {
    foreach ($rangeIntervalMap as $range => $intervals) {
        foreach ($intervals as $interval) {
            error_log("Processing: $symbol | $range | $interval");

            // Prüfe Cache
            $stmt = $conn->prepare("SELECT data, last_updated FROM cached_data 
                WHERE symbol = ? AND range_period = ? AND interval_period = ?");
            $stmt->bind_param("sss", $symbol, $range, $interval);
            $stmt->execute();
            $result = $stmt->get_result();

            $cacheHit = false;
            if ($result && $result->num_rows > 0) {
                $row = $result->fetch_assoc();
                $lastUpdated = strtotime($row['last_updated']);
                if (time() - $lastUpdated < $cacheExpiry) {
                    header('X-Cache: HIT');
                    echo $row['data'];
                    exit;
                }
            }

            // Hole Daten von RapidAPI
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
                CURLOPT_SSL_VERIFYPEER => false // Nur für Entwicklung
            ]);

            $response = curl_exec($ch);
            $err = curl_error($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($err || $httpCode !== 200) {
                error_log("API error for $symbol | $range | $interval: $err, HTTP $httpCode");
                continue;
            }

            // Prüfe JSON
            $data = json_decode($response);
            if (json_last_error() !== JSON_ERROR_NONE) {
                error_log("Invalid JSON for $symbol | $range | $interval: " . json_last_error_msg());
                continue;
            }

            // In DB speichern
            $stmt = $conn->prepare("INSERT INTO cached_data 
                (symbol, range_period, interval_period, data, last_updated) 
                VALUES (?, ?, ?, ?, NOW())
                ON DUPLICATE KEY UPDATE 
                data = VALUES(data),
                last_updated = NOW()");
            $stmt->bind_param("ssss", $symbol, $range, $interval, $response);
            if (!$stmt->execute()) {
                error_log("DB error for $symbol | $range | $interval: " . $stmt->error);
            } else {
                error_log("Cache MISS/Update for $symbol | $range | $interval");
            }
        }
    }
}

$conn->close();
echo json_encode(["success" => true, "message" => "Alle Symbole verarbeitet!"]);
?>