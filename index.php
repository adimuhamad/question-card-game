<?php
// Mulai session untuk bisa mengakses data session yang ada
session_start();
// Hapus semua variabel session
session_unset();
// Hancurkan session sepenuhnya (Logout paksa saat refresh)
session_destroy();
// Kontrol versi program
$ver = '3';
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Bahan Ngobrol</title>
    <meta name="theme-color" content="#4f46e5">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600&display=swap" rel="stylesheet">
    <link rel="apple-touch-icon" href="icon-192.png">
    <link rel="stylesheet" href="main.css?v=<?= $ver; ?>">
    <link rel="stylesheet" href="component.css?v=<?= $ver; ?>">
</head>
<body>

    <header>Bahan Ngobrol</header>
    <div class="floating-emojis" id="emoji-container"></div>

    <div class="container">
        <div class="badge-wrapper ui-disabled" id="badge-container">
            <span class="badge badge-clickable" id="total-info" onclick="openResetModal()">Sisa</span>
            <span class="badge badge-clickable" id="category" onclick="openStatsModal()">Pilih</span>
            <span class="badge badge-clickable" id="source-info" onclick="openSourceModal()">Sumber</span>
        </div>

        <div class="content-card" id="card-question">
            <h1 id="question">Klik tombol di bawah untuk mulai.</h1>
        </div>

        <button type="button" id="btn-next" onclick="handleMainButton()" disabled>Ambil Pertanyaan</button>
    </div>

    <footer>&copy; Adhiya Project</footer>

    <div id="modal-auth" class="modal-overlay">
        <div class="modal-content">
            <h3>Restricted Access</h3>
            <p>Masukkan password untuk memulai</p>
            <form onsubmit="event.preventDefault(); checkPassword();" autocomplete="off">
                <div style="opacity: 0; position: absolute; height: 0; width: 0; overflow: hidden;">
                    <input type="text" name="fake_user_trap" tabindex="-1">
                    <input type="password" name="fake_pass_trap" tabindex="-1">
                </div>
                <input type="text" id="auth-input" class="password-mask"
                       placeholder="Password..."
                       autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
                       name="field_<?php echo bin2hex(random_bytes(5)); ?>" required>
                <button type="submit">Masuk</button>
            </form>
        </div>
    </div>

    <div id="modal-category" class="modal-overlay hidden">
        <div class="modal-content">
            <h3>Pilih Kategori</h3>
            <div class="category-buttons" id="category-btn-container"></div>
            <button onclick="closeModal()" class="btn-cancel">Batal</button>
        </div>
    </div>

    <div id="modal-reset" class="modal-overlay hidden">
        <div class="modal-content">
            <h3>Reset Pertanyaan?</h3>
            <div class="category-buttons">
                <button type="button" onclick="confirmReset()" class="btn-cat cat-masa-lalu">Ya, Reset</button>
                <button type="button" onclick="closeResetModal()" class="btn-cancel">Batal</button>
            </div>
        </div>
    </div>

    <div id="modal-stats" class="modal-overlay hidden">
        <div class="modal-content">
            <h3>Daftar Kategori</h3>
            <div id="stats-list-container"></div>
            <button type="button" onclick="closeStatsModal()" class="btn-cancel">Tutup</button>
        </div>
    </div>

    <div id="modal-source" class="modal-overlay hidden">
        <div class="modal-content">
            <h3>Daftar Sumber</h3>
            <p>Pertanyaan diambil secara acak dari database:</p>
            <ul class="source-list" id="source-list-container"></ul>
            <button onclick="closeSourceModal()" class="btn-cancel">Tutup</button>
        </div>
    </div>

    <script src="audio.js?v=<?= $ver; ?>" defer></script>
    <script src="ui.js?v=<?= $ver; ?>" defer></script>
    <script src="engine.js?v=<?= $ver; ?>" defer></script>

</body>
</html>