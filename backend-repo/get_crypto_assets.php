<?php
header('Content-Type: application/json');
require_once 'config.php';
setCORSHeaders();

$conn = getDBConnection();

if ($conn->connect_error) {
    echo json_encode(['success' => false, 'message' => 'DB error']);
    exit;
}

// Hole alle Crypto-Assets (du kannst die Symbol-Liste anpassen)
$symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD', 'DOGE-USD', 'BNB-USD', 'ADA-USD', 'XRP-USD', 'AVAX-USD', 'DOT-USD', 'MATIC-USD'];
$assets = [];

foreach ($symbols as $symbol) {
    $stmt = $conn->prepare("SELECT data FROM cached_data WHERE symbol = ? AND range_period = '1d' AND interval_period = '5m' ORDER BY last_updated DESC LIMIT 1");
    $stmt->bind_param("s", $symbol);
    $stmt->execute();
    $result = $stmt->get_result();
    if ($row = $result->fetch_assoc()) {
        $data = json_decode($row['data'], true);
        $meta = $data['chart']['result'][0]['meta'] ?? null;
        if ($meta) {
            $assets[] = [
                'symbol' => $symbol,
                'name' => $meta['shortName'] ?? $symbol,
                'price' => $meta['regularMarketPrice'] ?? null
            ];
        }
    }
}

echo json_encode(['success' => true, 'assets' => $assets]);
$conn->close();
?>