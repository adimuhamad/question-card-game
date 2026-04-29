<?php
session_start();
header('Content-Type: application/json');

// GANTI PASSWORD DI SINI (Server-side)
// Ini adalah hash SHA256 dari password kamu.
// Kamu bisa ganti string di bawah ini dengan password plain text jika mau simpel:
// if ($pass === 'rahasia123') ...
$SERVER_PASS_HASH = "cb7cdd6078a2330d1c9e86ecafc21e06c619b1ae6e928b376404d1661864cebf";

$input = json_decode(file_get_contents('php://input'), true);
$pass = isset($input['password']) ? $input['password'] : '';

// Cek Hash di Server
if (hash('sha256', $pass) === $SERVER_PASS_HASH) {
    // Login Berhasil
    $_SESSION['is_logged_in'] = true;
    session_regenerate_id(true); // Mencegah session fixation
    echo json_encode(['success' => true]);
} else {
    // Login Gagal
    echo json_encode(['success' => false]);
}
?>