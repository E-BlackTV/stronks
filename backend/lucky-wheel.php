<?php
// Error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    $conn = new mysqli("localhost", "root", "", "ionic_app");

    if ($conn->connect_error) {
        throw new Exception("Connection failed: " . $conn->connect_error);
    }

    // Enable Prepared Statements
    $conn->set_charset('utf8mb4');

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $action = $_GET['action'] ?? '';
        
        if ($action === 'spin_wheel') {
            $input = file_get_contents("php://input");
            $data = json_decode($input, true);
            
            // Log for debugging
            error_log("Received data: " . $input);
            
            // Validate input data
            if (!isset($data['user_id']) || !isset($data['prize_value'])) {
                throw new Exception('Invalid parameters: user_id and prize_value required');
            }

            $userId = filter_var($data['user_id'], FILTER_VALIDATE_INT);
            $prizeValue = filter_var($data['prize_value'], FILTER_VALIDATE_FLOAT);
            
            if (!$userId || !$prizeValue) {
                throw new Exception('Invalid user_id or prize_value');
            }

            // Begin transaction
            $conn->begin_transaction();

            try {
                // Add prize value to user's balance in users table
                $stmt = $conn->prepare("UPDATE users SET accountbalance = accountbalance + ? WHERE id = ?");
                if (!$stmt) {
                    throw new Exception("Prepare failed: " . $conn->error);
                }
                
                $stmt->bind_param("di", $prizeValue, $userId);
                
                if (!$stmt->execute()) {
                    throw new Exception("Execute failed: " . $stmt->error);
                }

                // Check if update was successful
                if ($stmt->affected_rows === 0) {
                    throw new Exception("User not found or no changes made");
                }

                // Update or insert spin record in lucky_wheel_spins table
                $stmt2 = $conn->prepare("INSERT INTO lucky_wheel_spins (user_id, last_spin) VALUES (?, NOW()) ON DUPLICATE KEY UPDATE last_spin = NOW()");
                if (!$stmt2) {
                    throw new Exception("Prepare failed for lucky_wheel_spins: " . $conn->error);
                }
                
                $stmt2->bind_param("i", $userId);
                
                if (!$stmt2->execute()) {
                    throw new Exception("Execute failed for lucky_wheel_spins: " . $stmt2->error);
                }

                $conn->commit();

                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    "success" => true,
                    "message" => "Gewinn erfolgreich hinzugefügt!",
                    "prize_value" => $prizeValue,
                    "user_id" => $userId
                ]);

            } catch (Exception $e) {
                $conn->rollback();
                throw $e;
            }
        } else {
            throw new Exception('Invalid action: ' . $action);
        }
    } elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $action = $_GET['action'] ?? '';
        
        if ($action === 'check_spin') {
            $userId = filter_var($_GET['user_id'] ?? '', FILTER_VALIDATE_INT);
            
            if (!$userId) {
                throw new Exception('Invalid user_id parameter');
            }

            // Check if user exists and get last spin time
            $stmt = $conn->prepare("
                SELECT lws.last_spin, 
                       TIMESTAMPDIFF(HOUR, lws.last_spin, NOW()) as hours_since_spin
                FROM lucky_wheel_spins lws 
                WHERE lws.user_id = ?
            ");
            
            if (!$stmt) {
                throw new Exception("Prepare failed: " . $conn->error);
            }
            
            $stmt->bind_param("i", $userId);
            
            if (!$stmt->execute()) {
                throw new Exception("Execute failed: " . $stmt->error);
            }
            
            $result = $stmt->get_result();
            $row = $result->fetch_assoc();
            
            $lastSpin = $row ? $row['last_spin'] : null;
            $hoursSinceLastSpin = $row ? $row['hours_since_spin'] : null;
            $now = new DateTime();
            
            if ($lastSpin && $hoursSinceLastSpin !== null) {
                $lastSpinTime = new DateTime($lastSpin);
                
                if ($hoursSinceLastSpin < 24) {
                    // Calculate next available spin time
                    $nextSpinTime = clone $lastSpinTime;
                    $nextSpinTime->add(new DateInterval('PT24H'));
                    
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        "success" => true,
                        "can_spin" => false,
                        "last_spin" => $lastSpin,
                        "next_spin" => $nextSpinTime->format('Y-m-d H:i:s'),
                        "hours_remaining" => 24 - $hoursSinceLastSpin,
                        "message" => "Sie müssen noch " . (24 - $hoursSinceLastSpin) . " Stunden warten"
                    ]);
                } else {
                    header('Content-Type: application/json; charset=utf-8');
                    echo json_encode([
                        "success" => true,
                        "can_spin" => true,
                        "last_spin" => $lastSpin,
                        "message" => "Sie können jetzt spinnen!"
                    ]);
                }
            } else {
                // User has never spun before
                header('Content-Type: application/json; charset=utf-8');
                echo json_encode([
                    "success" => true,
                    "can_spin" => true,
                    "last_spin" => null,
                    "message" => "Willkommen! Sie können jetzt spinnen!"
                ]);
            }
        } else {
            throw new Exception('Invalid action: ' . $action);
        }
    } else {
        throw new Exception('Only GET and POST methods allowed');
    }

} catch (Exception $e) {
    error_log("Lucky wheel error: " . $e->getMessage());
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false, 
        'message' => 'Fehler: ' . $e->getMessage(),
        'debug' => [
            'method' => $_SERVER['REQUEST_METHOD'],
            'action' => $_GET['action'] ?? 'none',
            'input' => file_get_contents("php://input")
        ]
    ]);
} finally {
    if (isset($conn)) {
        $conn->close();
    }
}