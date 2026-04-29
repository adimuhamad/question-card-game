(function() {
    // ==================== STATE MANAGEMENT ====================
    const gameState = {
        isSelectionMode: false,
        isGameOver: false,
        isBombNext: false,
        isCategoryInitialized: false, // Flag penting: False = Semua, True = Custom
        history: JSON.parse(localStorage.getItem('icebreaker_history')) || {},
        gachaPool: [],
        activeCategories: [],
        lastSource: '',
        timerInterval: null,
        allCategoryNames: []
    };

    const getEl = (id) => document.getElementById(id);

    // ==================== EVENT LISTENERS ====================
    document.addEventListener('DOMContentLoaded', () => {

    });

    document.addEventListener('keydown', function (event) {
        const isAuthOpen = !getEl('modal-auth').classList.contains('hidden');
        if (isAuthOpen) return;

        const isModalOpen =
            !getEl('modal-category').classList.contains('hidden') ||
            !getEl('modal-reset').classList.contains('hidden') ||
            !getEl('modal-source').classList.contains('hidden') ||
            !getEl('modal-stats').classList.contains('hidden');

        if (event.code === 'Space' || event.code === 'Enter') {
            if (event.code === 'Space') event.preventDefault();
            if (!isModalOpen) handleMainButton();
        }

        if (event.code === 'Escape') {
            ['modal-category', 'modal-reset', 'modal-source', 'modal-stats'].forEach(id => {
                getEl(id).classList.add('hidden');
            });
            if (window.playSfx) window.playSfx('close');
        }

        // === LOGIKA SHORTCUT BARU (ANGKA 1-9) ===
        // Hanya jalan jika Modal Kategori SEDANG TERBUKA
        if (!getEl('modal-category').classList.contains('hidden')) {
            const key = parseInt(event.key);

            // Cek apakah yang ditekan angka 1 sampai 9
            if (!isNaN(key) && key >= 1 && key <= 9) {
                // Ambil semua tombol kategori yang sedang tampil di layar
                const btns = document.querySelectorAll('#category-btn-container button');

                // Ambil tombol sesuai urutan (Array mulai dari 0, jadi kurangi 1)
                const targetBtn = btns[key - 1];

                if (targetBtn) {
                    // CEK APAKAH TOMBOL DISABLE? (Bypass Protection)
                    if (targetBtn.disabled) {
                        if (window.playSfx) window.playSfx('wrong'); // Kasih feedback error
                        return; // Stop! Jangan ambil pertanyaan.
                    }

                    // Jika aman, klik tombolnya secara programatis
                    // Ini otomatis menjalankan fungsi fetchByCategory('kategori') yang nempel di tombol itu
                    if (window.playSfx) window.playSfx('click');
                    targetBtn.click();
                }
            }
        }
    });

    // ==================== MAIN FUNCTIONS ====================
    function handleMainButton() {
        const btn = getEl('btn-next');

        if (btn.classList.contains('bomb-active')) {
            if (window.playSfx) window.playSfx('click');
            stopBombManual();
            return;
        }

        if (window.playSfx) window.playSfx('click');
        if (gameState.isGameOver) return;

        if (gameState.isSelectionMode) {
            if (window.openModal) window.openModal();
        } else {
            fetchQuestionData();
        }
    }

    // --- TAMBAHKAN FUNGSI BARU INI DI BAGIAN BAWAH (FETCH LOGIC) ---
    async function fetchAllCategories() {
        try {
            // Kita minta stats TANPA history (excluded: {}) agar dapat SEMUA kategori
            const response = await fetch('get_data.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ excluded: {}, action: 'get_stats' })
            });

            const result = await response.json();
            if (result.success && result.stats) {
                // Simpan nama-nama kategori (misal: ['kehidupan', 'pertemanan', ...])
                allCategoryNames = Object.keys(result.stats);
            }
        } catch (e) {
            console.error("Gagal init kategori:", e);
        }
    }

    async function fetchGachaPool() {
        try {
            const response = await fetch('get_data.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ excluded: gameState.history, action: 'get_gacha_pool' })
            });
            const result = await response.json();
            if (result.success) gameState.gachaPool = result.pool;
        } catch (e) {
            gameState.gachaPool = ['Siap-siap...', 'Mengocok...', 'Apa ya...', 'Tunggu...'];
        }
    }

    async function fetchQuestionData(specificCategory = null) {
        const btn = getEl('btn-next');
        const qElement = getEl('question');
        const cElement = getEl('category');
        const tElement = getEl('total-info');
        const sElement = getEl('source-info');

        // Validasi Kategori Custom
        if (gameState.isCategoryInitialized && gameState.activeCategories.length === 0 && !specificCategory) {
            qElement.innerText = "Pilih minimal satu kategori di menu 'Pilih'.";
            if (window.updateCardTheme) window.updateCardTheme('default');
            return;
        }

        // 1. UI Loading TAHAP AWAL (Tanpa Animasi Gacha Dulu)
        btn.disabled = true;
        btn.innerText = 'Menghubungkan...'; // Tanda sedang cek ke server

        try {
            // 2. REQUEST KE SERVER DULUAN
            const fetchRequest = await fetch('get_data.php', {
                method: 'POST',
                credentials: 'include', // Wajib bawa tiket session
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    excluded: gameState.history,
                    kategori: specificCategory,
                    last_source: gameState.lastSource,
                    allowed_categories: (gameState.isCategoryInitialized && !specificCategory) ? gameState.activeCategories : null
                })
            });

            // 3. SECURITY CHECKPOINT (Disini kuncinya!)
            // Jika server bilang 401 (Gak kenal/Session habis), langsung reload.
            // Animasi gacha BELUM jalan sama sekali di titik ini.
            if (fetchRequest.status === 401) {
                location.reload();
                return;
            }

            // Jika error lain (misal server down 500)
            if (!fetchRequest.ok) {
                throw new Error("Server Error");
            }

            // 4. DATA SUDAH AMAN -> BARU MULAI ANIMASI (Reward buat user valid)
            const result = await fetchRequest.json();

            // Mulai efek gacha & sound
            if (window.playSfx) window.playSfx('shuffle');
            let gachaInterval;

            // Kita pakai data pool lokal untuk animasi
            window.gachaPool = gameState.gachaPool;
            if (window.startGachaEffect) gachaInterval = window.startGachaEffect(qElement);

            btn.innerText = specificCategory ? 'Mencari...' : 'Mengambil...';

            // 5. ARTIFICIAL DELAY (Agar animasi sempat terlihat & dinikmati)
            // Karena datanya sebenernya udah dapet di langkah no 4, kita tahan sebentar biar seru.
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Stop Animasi
            if (window.stopGachaEffect) window.stopGachaEffect(gachaInterval);
            if (window.stopSfx) window.stopSfx('shuffle');

            // 6. TAMPILKAN HASIL
            if (result.success) {
                handleSuccessData(result, qElement, cElement, sElement, tElement, btn);
            } else {
                handleErrorData(result, qElement, tElement, btn);
            }

        } catch (error) {
            console.error(error);
            qElement.innerText = 'Terjadi kesalahan koneksi.';
            // Pastikan animasi mati kalau ada error di tengah jalan
            if (typeof gachaInterval !== 'undefined' && window.stopGachaEffect) window.stopGachaEffect(gachaInterval);
            if (window.stopSfx) window.stopSfx('shuffle');
        } finally {
            // Reset tombol
            if (!gameState.isGameOver && !btn.classList.contains('bomb-active')) {
                btn.disabled = false;
                if (!gameState.isSelectionMode && window.resetButtonState) window.resetButtonState();
            }
        }
    }

    function handleSuccessData(result, qElement, cElement, sElement, tElement, btn) {
        const data = result.data;
        const kategori = data.kategori.toLowerCase();

        gameState.lastSource = data.asal_tabel;

        if (window.updateCardTheme) window.updateCardTheme(kategori);
        cElement.innerText = data.kategori;
        qElement.innerText = data.pertanyaan;
        sElement.innerText = `${data.asal_tabel}`;
        tElement.innerText = `Sisa: ${result.total_sisa}`;

        if (gameState.isGameOver) {
            gameState.isGameOver = false;
            btn.classList.remove('btn-disabled-permanent');
        }

        const isBonus = kategori.includes('kesempatan') || kategori.includes('tantangan') || data.asal_tabel === 'Bonus';
        if (window.playSfx) window.playSfx(isBonus ? 'tada' : 'ding');

        if (data.asal_tabel !== 'Bonus') {
            if (!gameState.history[data.asal_tabel]) gameState.history[data.asal_tabel] = [];

            const idVal = parseInt(data.id);
            if (!gameState.history[data.asal_tabel].includes(idVal)) {
                gameState.history[data.asal_tabel].push(idVal);
                localStorage.setItem('icebreaker_history', JSON.stringify(gameState.history));
            }
        }

        if (gameState.gachaPool.length < 5) fetchGachaPool();
        if (window.checkTrigger) window.checkTrigger(data.pertanyaan);

        if (gameState.isBombNext) {
            startBombTimer(10);
            gameState.isBombNext = false;
        } else if (data.pertanyaan.includes('Jawab pertanyaan dengan cepat')) {
            gameState.isBombNext = true;
        }
    }

    function handleErrorData(result, qElement, tElement, btn) {
        qElement.innerText = result.message;
        if (window.updateCardTheme) window.updateCardTheme('default');

        if (result.game_over) {
            gameState.isGameOver = true;
            tElement.innerText = 'Sisa: 0';
            btn.innerText = 'Selesai';
            btn.classList.add('btn-disabled-permanent');
            btn.classList.remove('bomb-active');
            if (window.playSfx) window.playSfx('over');
        }
    }

    // ==================== LOGIC BOMB ====================
    function startBombTimer(seconds) {
        const btn = getEl('btn-next');
        btn.disabled = false;
        btn.classList.remove('btn-disabled-permanent');
        btn.classList.add('bomb-active');
        btn.style.backgroundColor = '#ef4444';

        let timeLeft = seconds;
        btn.innerText = `TIMER: ${timeLeft}`;
        if (window.playSfx) window.playSfx('timer');

        gameState.timerInterval = setInterval(() => {
            timeLeft--;
            btn.innerText = `TIMER: ${timeLeft}`;

            if (timeLeft <= 3) {
                btn.style.transform = timeLeft % 2 === 0 ? 'scale(1.05)' : 'scale(0.95)';
            }

            if (timeLeft <= 0) {
                clearInterval(gameState.timerInterval);
                explodeBomb(btn);
            }
        }, 1000);
    }

    function explodeBomb(btn) {
        if (window.stopSfx) window.stopSfx('timer');
        if (window.playSfx) window.playSfx('boom');
        btn.innerText = 'WAKTU HABIS! 💥';
        btn.disabled = true;

        if (navigator.vibrate) navigator.vibrate([500, 100, 500]);
        setTimeout(() => resetBombUI(), 3000);
    }

    function stopBombManual() {
        if (gameState.timerInterval) clearInterval(gameState.timerInterval);
        if (window.stopSfx) window.stopSfx('timer');
        resetBombUI();
    }

    function resetBombUI() {
        const btn = getEl('btn-next');
        btn.classList.remove('bomb-active');
        btn.disabled = false;
        btn.style.backgroundColor = '';
        btn.style.transform = '';
        if (window.resetButtonState) window.resetButtonState();
    }

    // ==================== EXPOSE & HELPER ====================

    function fetchByCategory(categoryName) {
        if (window.closeModal) window.closeModal();
        gameState.isSelectionMode = false;
        fetchQuestionData(categoryName);
        if (window.resetButtonState) window.resetButtonState();
    }

    function internalEngineReset() { // Dulu namanya confirmReset
        gameState.history = {};
        localStorage.removeItem('icebreaker_history');
        gameState.isGameOver = false;
        gameState.lastSource = '';
        gameState.activeCategories = [];
        gameState.isCategoryInitialized = false;
        gameState.isBombNext = false; // Reset bom juga

        // Reset UI Button via Window (karena logic button ada di UI.js sekarang)
        if (window.resetButtonState) window.resetButtonState();
    }

    // Fungsi Jembatan Baru untuk UI.js
    function setActiveCategories(categories) {
        // Update list
        gameState.activeCategories = categories;
        // Tandai bahwa user sudah melakukan filter, jadi fetch selanjutnya akan pakai filter ini
        gameState.isCategoryInitialized = true;
    }

    window.setSelectionMode = (val) => { gameState.isSelectionMode = val; };
    window.getGameOverStatus = () => gameState.isGameOver;
    window.setGameOverStatus = (val) => { gameState.isGameOver = val; };
    window.getQuestionHistory = () => gameState.history;

    // EXPOSE GETTER untuk UI
    window.getActiveCategories = () => gameState.activeCategories;
    window.getIsCategoryInitialized = () => gameState.isCategoryInitialized;
    window.getAllCategoryNames = () => allCategoryNames;

    window.handleMainButton = handleMainButton;
    window.fetchByCategory = fetchByCategory;
    window.resetButtonState = resetButtonState;
    window.confirmReset = confirmReset;
    window.confirmResetEngine = internalEngineReset;
    window.fetchGachaPool = fetchGachaPool;
    window.fetchAllCategories = fetchAllCategories;

    // EXPOSE SETTER BARU
    window.setActiveCategories = setActiveCategories;

})();