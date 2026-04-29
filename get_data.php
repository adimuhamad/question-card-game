<?php
session_start(); // Baris wajib

// CEK SESSION: Jika belum login, tolak akses!
if (!isset($_SESSION['is_logged_in']) || $_SESSION['is_logged_in'] !== true) {
    http_response_code(401); // Kode error "Unauthorized"
    echo json_encode(['success' => false, 'message' => 'Akses ditolak. Silakan login ulang.']);
    exit;
}

header('Content-Type: application/json');

/* ==================== 1. KONFIGURASI SUMBER DATA ==================== */
// Format Baru: 'Nama UI' => ['tabel' => 'nama_tabel_db', 'desc' => 'Deskripsinya']
$tableConfig = [
    'Tabel 1' => [
        'table' => 'data_satu',
        'desc'  => 'Yuk ngobrol edisi pertama'
    ],
    'Tabel 2' => [
        'table' => 'data_dua',
        'desc'  => 'Yuk ngobrol edisi kedua'
    ],
    'Tabel 3' => [
        'table' => 'data_tiga',
        'desc'  => 'Yuk ngobrol edisi ketiga'
    ],
    'Custom'  => [
        'table' => 'data_custom',
        'desc'  => 'Pertanyaan bikinan sendiri'
    ]
];

// Tabel Bonus (Terpisah)
$bonusConfig = [
    'table' => 'data_bonus',
    'desc'  => 'Kesempatan dan Tantangan seru'
];

/* ==================== PERSIAPAN INPUT ==================== */
$input = json_decode(file_get_contents('php://input'), true);
// ... (Bagian $excludedIds, $filterKategori, dll biarkan sama) ...
$excludedIds = isset($input['excluded']) ? $input['excluded'] : [];
$filterKategori = isset($input['kategori']) ? $input['kategori'] : null;
$allowedCategories = isset($input['allowed_categories']) ? $input['allowed_categories'] : null;
$lastSource = isset($input['last_source']) ? $input['last_source'] : '';
$action = isset($input['action']) ? $input['action'] : 'get_question';

/* ==================== HELPER FUNCTION (Update Dikit) ==================== */
function buildExcludeClause($tableName, $excludedMap) {
    // Kita perlu mapping balik dari nama tabel ke index excludedMap
    // Karena excludedMap kuncinya pakai 'Tabel 1', 'Bonus', dll.

    // (Logika ini sebenernya bisa disederhanakan, tapi biar aman pakai logika lama yang disesuaikan)
    // Kita cari KEY di $excludedMap yang cocok
    return " "; // Default return kalau logika di bawah kompleks, nanti ditangani di query utama
    // CATATAN: Fungsi helper lama kamu pakai hardcode array $dbMap.
    // Sebaiknya kita hapus fungsi helper lama dan masukkan logikanya langsung di loop query agar dinamis.
}
// KITA HAPUS FUNCTION buildExcludeClause LAMA, KITA GANTI LOGIKA DI BAWAH LEBIH RAPI

try {
    $db = new PDO('sqlite:data_base.db');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    /* ==================== ACTION BARU: GET SOURCES ==================== */
    if ($action === 'get_sources') {
        $sources = [];

        // Masukkan tabel utama
        foreach ($tableConfig as $uiName => $info) {
            $sources[] = [
                'name' => $uiName,
                'desc' => $info['desc']
            ];
        }

        // Masukkan bonus
        $sources[] = [
            'name' => 'Bonus',
            'desc' => $bonusConfig['desc']
        ];

        echo json_encode(['success' => true, 'sources' => $sources]);
        exit;
    }

    /* ==================== ACTION: GACHA POOL (Updated Loop) ==================== */
    if ($action === 'get_gacha_pool') {
        $queries = [];

        // Loop config baru
        foreach ($tableConfig as $uiName => $info) {
            $tbl = $info['table'];
            // Logika Exclude Manual (Simple)
            $excludeSql = "";
            if (isset($excludedIds[$uiName]) && !empty($excludedIds[$uiName])) {
                $ids = implode(',', array_map('intval', $excludedIds[$uiName]));
                $excludeSql = " WHERE rowid NOT IN ($ids) ";
            }
            $queries[] = "SELECT pertanyaan FROM $tbl $excludeSql";
        }
        // Tambah Bonus
        $queries[] = "SELECT pertanyaan FROM " . $bonusConfig['table'];

        $finalQuery = "SELECT pertanyaan FROM (" . implode(" UNION ALL ", $queries) . ") ORDER BY RANDOM() LIMIT 30";

        $stmt = $db->query($finalQuery);
        echo json_encode(['success' => true, 'pool' => $stmt->fetchAll(PDO::FETCH_COLUMN)]);
        exit;
    }

    /* ==================== ACTION: STATS (Updated Loop) ==================== */
    if ($action === 'get_stats') {
        $queries = [];

        foreach ($tableConfig as $uiName => $info) {
            $tbl = $info['table'];
            // Exclude logic
            $excludeSql = "";
            if (isset($excludedIds[$uiName]) && !empty($excludedIds[$uiName])) {
                $ids = implode(',', array_map('intval', $excludedIds[$uiName]));
                $excludeSql = " WHERE rowid NOT IN ($ids) ";
            }
            $queries[] = "SELECT kategori FROM $tbl $excludeSql";
        }
        // Bonus
        $queries[] = "SELECT kategori FROM " . $bonusConfig['table'];

        $finalQuery = "SELECT lower(kategori) AS nama_kategori, COUNT(*) AS total
                       FROM (" . implode(" UNION ALL ", $queries) . ")
                       GROUP BY lower(kategori)";

        $stmt = $db->query($finalQuery);
        echo json_encode(['success' => true, 'stats' => $stmt->fetchAll(PDO::FETCH_KEY_PAIR)]);
        exit;
    }

    /* ==================== ACTION: GET QUESTION (Updated Loop) ==================== */

    // 1. Bangun Query Utama
    $unionsData = [];
    $unionsCount = [];

    // Loop Tabel Utama
    foreach ($tableConfig as $uiName => $info) {
        $tbl = $info['table'];

        $excludeSql = "";
        if (isset($excludedIds[$uiName]) && !empty($excludedIds[$uiName])) {
            $ids = implode(',', array_map('intval', $excludedIds[$uiName]));
            $excludeSql = " WHERE rowid NOT IN ($ids) ";
        }

        $unionsData[] = "SELECT rowid, kategori, pertanyaan, '$uiName' AS asal_tabel FROM $tbl $excludeSql";
        $unionsCount[] = "SELECT kategori FROM $tbl $excludeSql";
    }

    // Logic Bonus (Weighting)
    $shouldIncludeBonus = true;
    if ($allowedCategories && !empty($allowedCategories)) {
        $standardCats = array_diff($allowedCategories, ['kesempatan', 'tantangan']);
        if (empty($standardCats)) $unionsData = []; // Reset jika user cuma mau bonus
    }

    $tblBonus = $bonusConfig['table'];
    // Masukkan Bonus ke Query
    if ($filterKategori || empty($unionsData)) {
        $unionsData[] = "SELECT rowid, kategori, pertanyaan, 'Bonus' as asal_tabel FROM $tblBonus";
    } else if ($lastSource !== 'Bonus') {
        // Multiplier agar bonus sering muncul
        $multiplier = count($tableConfig) + 1;
        for ($i = 0; $i < $multiplier; $i++) {
            $unionsData[] = "SELECT rowid, kategori, pertanyaan, 'Bonus' as asal_tabel FROM $tblBonus";
        }
    }

    $sqlCoreData = implode(" UNION ALL ", $unionsData);
    $sqlCoreCount = implode(" UNION ALL ", $unionsCount);

    // Filter Logic (Sama seperti sebelumnya)
    $whereClauses = [];
    $params = [];

    if ($filterKategori) {
        $whereClauses[] = "LOWER(kategori) LIKE ?";
        $params[] = '%' . strtolower($filterKategori) . '%';
    } else if ($allowedCategories !== null && is_array($allowedCategories)) {
        if (empty($allowedCategories)) {
            echo json_encode(['success' => false, 'game_over' => false, 'message' => 'Semua kategori dimatikan.', 'total_sisa' => 0]);
            exit;
        }
        $inQuery = implode(',', array_fill(0, count($allowedCategories), '?'));
        $whereClauses[] = "LOWER(kategori) IN ($inQuery)";
        foreach ($allowedCategories as $cat) $params[] = strtolower($cat);
    }

    $sqlWhere = !empty($whereClauses) ? " WHERE " . implode(" AND ", $whereClauses) : "";

    // Count Query
    // Note: Params untuk count harus sama dengan params data filter
    $stmtCount = $db->prepare("SELECT COUNT(*) FROM ($sqlCoreCount) $sqlWhere");
    $stmtCount->execute($params);
    $totalRows = $stmtCount->fetchColumn();

    // Data Query
    $query = "SELECT rowid AS id, kategori, pertanyaan, asal_tabel
              FROM ($sqlCoreData) $sqlWhere
              ORDER BY RANDOM() LIMIT 1";

    $stmt = $db->prepare($query);
    $stmt->execute($params);
    $result = $stmt->fetch(PDO::FETCH_ASSOC);

    $isGameOver = ($totalRows <= 0);

    if ($result && !$isGameOver) {
        $displaySisa = $totalRows;
        if ($result['asal_tabel'] !== 'Bonus' && $displaySisa > 0) {
            $displaySisa--;
        }

        echo json_encode([
            'success' => true,
            'data' => $result,
            'total_sisa' => $displaySisa
        ]);
    } else {
        echo json_encode([
            'success' => false,
            'game_over' => true,
            'message' => 'Pertanyaan habis atau kategori utama non-aktif.',
            'total_sisa' => 0
        ]);
    }

} catch (PDOException $e) {
    // Log error di server saja (error_log), jangan tampilkan ke user
    error_log($e->getMessage());
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan sistem.']);
}
?>