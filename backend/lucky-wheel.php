<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST, GET, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header('Content-Type: application/json');

// CORS Check
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

$conn = new mysqli("localhost", "root", "", "ionic_app");

if ($conn->connect_error) {
    die(json_encode(["success" => false, "message" => "Connection failed"]));
}

// Enable Prepared Statements
$conn->set_charset('utf8mb4');

// Create table if not exists
$createTable = "CREATE TABLE IF NOT EXISTS lucky_wheel_spins (
    user_id INT PRIMARY KEY,
    last_spin DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
)";
$conn->query($createTable);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userId = $_GET['user_id'];
    
    // Debug output
    error_log("Checking spin for user: " . $userId);
    
    $stmt = $conn->prepare("SELECT last_spin FROM lucky_wheel_spins WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $lastSpin = strtotime($row['last_spin']);
        $timeDiff = time() - $lastSpin;
        $canSpin = $timeDiff >= 86400;
        
        // Debug output
        error_log("Last spin: " . date('Y-m-d H:i:s', $lastSpin));
        error_log("Time diff: " . $timeDiff);
        error_log("Can spin: " . ($canSpin ? "yes" : "no"));
    } else {
        $canSpin = true;
        error_log("No previous spin found - can spin: yes");
    }
    
    echo json_encode([
        "success" => true,
        "canSpin" => $canSpin,
        "debug" => [
            "userId" => $userId,
            "hasLastSpin" => ($result->num_rows > 0),
            "lastSpin" => isset($lastSpin) ? date('Y-m-d H:i:s', $lastSpin) : null,
            "timeDiff" => isset($timeDiff) ? $timeDiff : null
        ]
    ]);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents("php://input"), true);
    
    // Validate input data
    if (!isset($data['user_id']) || !isset($data['timestamp']) || !isset($data['action'])) {
        die(json_encode(['success' => false, 'message' => 'Invalid parameters']));
    }

    $userId = filter_var($data['user_id'], FILTER_VALIDATE_INT);
    if (!$userId) {
        die(json_encode(['success' => false, 'message' => 'Invalid user ID']));
    }

    // Check timestamp (not older than 5 seconds)
    if (time() - ($data['timestamp'] / 1000) > 5) {
        die(json_encode(['success' => false, 'message' => 'Request timeout']));
    }
    
    // Check if user can spin
    $stmt = $conn->prepare("SELECT last_spin FROM lucky_wheel_spins WHERE user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();
    $result = $stmt->get_result();
    
    if ($result->num_rows > 0) {
        $row = $result->fetch_assoc();
        $lastSpin = strtotime($row['last_spin']);
        if ((time() - $lastSpin) < 86400) {
            echo json_encode(["success" => false, "message" => "You can only spin once per day!"]);
            exit;
        }
    }

    // Begin transaction
    $conn->begin_transaction();

    try {
        $prizes = [
            ['value' => 100, 'probability' => 5],
            ['value' => 5, 'probability' => 20],
            ['value' => 25, 'probability' => 10],
            ['value' => 10, 'probability' => 20],
            ['value' => 50, 'probability' => 5],
            ['value' => 15, 'probability' => 15],
            ['value' => 30, 'probability' => 10],
            ['value' => 20, 'probability' => 15]
        ];

        // Select prize
        $rand = mt_rand(1, 100);
        $currentProb = 0;
        $selectedPrize = null;
        $prizeIndex = 0;

        foreach ($prizes as $index => $prize) {
            $currentProb += $prize['probability'];
            if ($rand <= $currentProb) {
                $selectedPrize = $prize['value'];
                $prizeIndex = $index;
                break;
            }
        }

        // Calculate wheel position first
        $degreesPerSection = 360 / count($prizes);
        $targetDegrees = ($prizeIndex * $degreesPerSection);
        $finalDegrees = (5 * 360) + $targetDegrees + ($degreesPerSection / 2);

        // Send response before updating balance
        echo json_encode([
            "success" => true,
            "prize" => $selectedPrize,
            "degrees" => $finalDegrees,
            "message" => "Congratulations! You won {$selectedPrize}€!"
        ]);
        
        // Flush the output buffer to send response immediately
        ob_flush();
        flush();

        // Add delay to match animation
        sleep(5);

        // Update user balance
        $stmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance + ? WHERE id = ?");
        $stmt->bind_param("di", $selectedPrize, $userId);
        if (!$stmt->execute()) {
            throw new Exception("Failed to update balance");
        }

        // Record spin time
        $stmt = $conn->prepare("INSERT INTO lucky_wheel_spins (user_id, last_spin) 
                              VALUES (?, NOW()) ON DUPLICATE KEY UPDATE last_spin = NOW()");
        $stmt->bind_param("i", $userId);
        if (!$stmt->execute()) {
            throw new Exception("Failed to record spin time");
        }

        $conn->commit();

    } catch (Exception $e) {
        $conn->rollback();
        error_log($e->getMessage());
    }
}

$conn->close();