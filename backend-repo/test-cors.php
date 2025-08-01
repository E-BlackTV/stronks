<?php
// Einfache CORS-Test-Datei für IIS Server
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
header('Access-Control-Max-Age: 86400');
header('Access-Control-Allow-Credentials: true');

// Preflight OPTIONS request behandeln
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Test-Antwort
echo json_encode([
    "success" => true,
    "message" => "CORS test successful",
    "method" => $_SERVER['REQUEST_METHOD'],
    "timestamp" => date('Y-m-d H:i:s'),
    "server" => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown'
]);
?> 