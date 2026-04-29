(function() {
    // ==================== HELPER & CONFIG ====================
    const getEl = (id) => document.getElementById(id);

    // ==================== VISUAL EFFECTS ====================
    function startGachaEffect(textElement) {
        const card = getEl('card-question');
        const badgeCategory = getEl('category');
        card.classList.add('gacha-animating');

        // PERBAIKAN DI SINI:
        // Jika data DB belum masuk, pakai default manual agar warna tetap muncul
        let catNames = window.allCategoryNames;
        if (!catNames || catNames.length === 0) {
            catNames = ['Kehidupan', 'Diri Sendiri', 'Masa Lalu', 'Hubungan', 'Kesempatan', 'Tantangan'];
        }

        const pool = window.gachaPool || ['Mengocok...', 'Tunggu...', 'Siap-siap...'];

        return setInterval(() => {
            textElement.innerText = pool[Math.floor(Math.random() * pool.length)];

            const randomCat = catNames[Math.floor(Math.random() * catNames.length)];

            // Helper capitalizeWords harus ada di ui.js (atau buat manual di sini)
            badgeCategory.innerText = randomCat.replace(/\b\w/g, l => l.toUpperCase());

            updateCardTheme(randomCat);

        }, 80);
    }

    // Helper kecil untuk mempercantik teks (misal: "diri sendiri" jadi "Diri Sendiri")
    function capitalizeWords(str) {
        return str.replace(/\b\w/g, l => l.toUpperCase());
    }

    function stopGachaEffect(intervalId) {
        clearInterval(intervalId);
        const card = getEl('card-question');
        if (card) card.classList.remove('gacha-animating');
    }

    function updateCardTheme(categoryStr) {
        const card = getEl('card-question');
        const lowerCat = categoryStr.toLowerCase();

        // Reset base class
        card.className = 'content-card'; // Hapus semua class warna dulu

        // LOGIKA DINAMIS:
        // 1. Cek Bonus (Hardcoded karena spesial)
        if (lowerCat.includes('kesempatan') || lowerCat.includes('tantangan') || lowerCat === 'bonus') {
            card.classList.add('card-bonus');
        }
        // 2. Kategori Lain -> Ubah jadi format class CSS
        // Contoh: "Diri Sendiri" -> "card-diri-sendiri"
        else {
            const classSlug = 'card-' + lowerCat.replace(/\s+/g, '-'); // Ganti spasi dengan strip
            card.classList.add(classSlug);

            // Note: Jika class CSS-nya belum dibuat di main.css,
            // dia akan otomatis putih (ikut default content-card)
        }
    }

    // ==================== TRIGGERS ====================
    function checkTrigger(text) {
        if (text.includes("Pilih kategori pertanyaan")) {
            if (window.setSelectionMode) window.setSelectionMode(true);
            const btn = getEl('btn-next');
            if (!btn.classList.contains('bomb-active')) {
                btn.innerText = "Pilih Kategori";
                btn.classList.add('btn-action-mode');
            }
        }
    }

    function resetButtonState() {
        const btn = getEl('btn-next');

        // Hapus semua indikator mode khusus
        btn.innerText = 'Ambil Pertanyaan';
        btn.classList.remove('btn-action-mode'); // Hapus class pulse kuning
        btn.classList.remove('bomb-active');     // Hapus class bom merah (jaga-jaga)
        btn.style.backgroundColor = "";
        btn.style.transform = "";

        // Reset state global via Engine setter
        if (window.setSelectionMode) window.setSelectionMode(false);
    }

    function confirmReset() {
        if (typeof playSfx === 'function') playSfx('start');

        // Reset Engine State
        window.questionHistory = {}; // Ini akan dihandle engine lewat logic reset internal sebenernya
        localStorage.removeItem('icebreaker_history');

        // Reset UI Components
        updateCardTheme('default');

        // PANGGIL FUNGSI RESET BUTTON YANG BARU KITA PERBAIKI DI ATAS
        resetButtonState();

        // Panggil fungsi reset di Engine (untuk logic internal)
        if (window.confirmResetEngine) window.confirmResetEngine(); // Kita rename dikit nanti di engine biar ga bingung

        // Tutup semua modal
        closeResetModal();

        // Feedback Visual
        getEl('question').innerText = 'Pertanyaan di-reset! Silakan mulai lagi.';
        getEl('category').innerText = 'Pilih';
        getEl('total-info').innerText = 'Sisa';

        // Tarik data baru
        if (window.fetchGachaPool) window.fetchGachaPool();
        if (window.fetchAllCategories) window.fetchAllCategories();
    }

    // ==================== MODALS & STATS ====================
    function toggleModal(modalId, show = true) {
        const el = getEl(modalId);
        if (show) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
            if (typeof playSfx === 'function') playSfx('close');
        }
    }

    // Modal Pilihan (Single Select) - shortcut angka
    // GANTI FUNGSI openModal DENGAN VERSI INI:
    async function openCategoryModal() {
        if (typeof playSfx === 'function') playSfx('click');

        const modal = getEl('modal-category');
        const container = getEl('category-btn-container');

        modal.classList.remove('hidden');
        container.innerHTML = '<p style="grid-column: 1 / -1; color:#94a3b8;">Memuat topik...</p>';

        try {
            const history = window.getQuestionHistory ? window.getQuestionHistory() : {};
            const activeCats = window.getActiveCategories ? window.getActiveCategories() : [];
            const isInit = window.getIsCategoryInitialized ? window.getIsCategoryInitialized() : false;

            // 1. AMBIL DAFTAR INDUK (Berisi 'Pertemanan' walau isinya 0)
            // Kalau belum siap, fallback ke array manual
            const allKnownCategories = window.getAllCategoryNames ? window.getAllCategoryNames() : [];

            const response = await fetch('get_data.php', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ excluded: history, action: 'get_stats' })
            });

            const res = await response.json();
            const stats = res.stats || {};

            // === LOGIKA URUTAN ===
            const mainOrder = ['kehidupan', 'diri sendiri', 'masa lalu', 'hubungan'];
            const bonusExclusion = ['kesempatan', 'tantangan'];

            // 2. TENTUKAN SUMBER DATA UNTUK LOOPING
            // Gabungkan mainOrder dengan kategori dinamis dari allKnownCategories
            // Filter agar tidak double dan membuang bonus
            const dynamicOrder = allKnownCategories.filter(key =>
                !mainOrder.includes(key) && !bonusExclusion.includes(key)
            );

            const finalOrder = [...mainOrder, ...dynamicOrder];

            // === RENDER ===
            container.innerHTML = '';

            finalOrder.forEach(catKey => {
                // Ambil jumlah sisa. Jika tidak ada di stats (karena habis), otomatis jadi 0.
                const count = stats[catKey] || 0;

                const btn = document.createElement('button');
                const displayName = catKey.replace(/\b\w/g, l => l.toUpperCase());

                btn.innerText = displayName;
                btn.className = 'btn-cat';

                const slug = catKey.replace(/\s+/g, '-').toLowerCase();
                btn.classList.add(`cat-${slug}`);
                btn.style.backgroundColor = `var(--cat-${slug}, var(--cat-default))`;

                btn.onclick = () => {
                    if (window.fetchByCategory) window.fetchByCategory(catKey);
                };

                // === LOGIKA DISABLE ===
                let isDisabled = false;
                let statusText = "";

                if (count <= 0) {
                    isDisabled = true;
                    statusText = "(Habis)";
                }
                else if (isInit && !activeCats.includes(catKey)) {
                    isDisabled = true;
                    statusText = "(Non-aktif)";
                }

                if (isDisabled) {
                    btn.disabled = true;
                    btn.title = statusText;
                    btn.style.opacity = "0.4";
                    btn.style.cursor = "not-allowed";
                    // btn.innerText += ` ${statusText}`; // Opsional
                } else {
                    btn.disabled = false;
                    btn.title = `Sisa: ${count}`;
                    btn.style.opacity = "1";
                    btn.style.cursor = "pointer";
                }

                container.appendChild(btn);
            });

        } catch (e) {
            console.error(e);
            container.innerHTML = '<p style="grid-column: 1 / -1; color:red;">Gagal memuat.</p>';
        }
    }

    // Modal Statistik & Toggle
    async function openStatsModal() {
        toggleModal('modal-stats', true);
        const container = getEl('stats-list-container');
        container.innerHTML = '<p style="text-align:center;">Memuat data...</p>';

        try {
            const history = window.getQuestionHistory ? window.getQuestionHistory() : {};

            const response = await fetch('get_data.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ excluded: history, action: 'get_stats' })
            });

            const result = await response.json();

            if (result.success && result.stats) {
                renderStatsList(result.stats, container);
            } else {
                container.innerText = 'Gagal memuat data.';
            }
        } catch (e) {
            container.innerText = 'Error koneksi.';
        }
    }

    // ==================== SOURCE MODAL LOGIC ====================
    let isSourceLoaded = false; // Flag biar ga fetch berulang-ulang

    async function openSourceModal() {
        const modal = getEl('modal-source');
        const listContainer = getEl('source-list-container');

        modal.classList.remove('hidden');

        // Cek jika sudah pernah diload, ga usah fetch lagi biar cepet
        if (isSourceLoaded) return;

        listContainer.innerHTML = '<li style="text-align:center; color:#94a3b8;">Memuat sumber...</li>';

        try {
            const response = await fetch('get_data.php', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ action: 'get_sources' })
            });

            const result = await response.json();

            if (result.success && result.sources) {
                listContainer.innerHTML = ''; // Bersihkan loading

                result.sources.forEach(src => {
                    const li = document.createElement('li');

                    // Format HTML: <strong>Nama Tabel:</strong> Deskripsi
                    li.innerHTML = `<strong>${src.name}:</strong> ${src.desc}`;

                    listContainer.appendChild(li);
                });

                // Tandai sudah loaded, jadi nanti pas buka lagi ga perlu fetch
                isSourceLoaded = true;
            }
        } catch (e) {
            console.error(e);
            listContainer.innerHTML = '<li style="color:red;">Gagal memuat info.</li>';
        }
    }

    function renderStatsList(stats, container) {
        container.innerHTML = '';
        const ul = document.createElement('ul');
        ul.className = 'stats-list';

        // 1. SUMBER DATA & URUTAN
        const allKnown = window.getAllCategoryNames ? window.getAllCategoryNames() : Object.keys(stats);
  
        const mainOrder = ['kehidupan', 'diri sendiri', 'masa lalu', 'hubungan'];
        const bonusOrder = ['kesempatan', 'tantangan'];
        const dynamicOrder = allKnown.filter(key => !mainOrder.includes(key) && !bonusOrder.includes(key));
        const finalOrder = [...mainOrder, ...dynamicOrder, ...bonusOrder];
  
        // 2. STATE (MODIFIKASI DI SINI)
        let activeCats = window.getActiveCategories ? window.getActiveCategories() : [];
        const isInit = window.getIsCategoryInitialized ? window.getIsCategoryInitialized() : false;

        if (!isInit) {
            // CEK LOCAL STORAGE DULU
            const savedConfig = localStorage.getItem('icebreaker_active_cats');
  
            if (savedConfig) {
                // Jika ada simpanan, pakai itu
                try {
                    activeCats = JSON.parse(savedConfig);
                } catch (e) {
                    // Jika error parsing, fallback ke default (semua aktif yang ada isinya)
                    activeCats = finalOrder.filter(k => (stats[k] || 0) > 0);
                }
            } else {
                // Jika tidak ada simpanan, aktifkan semua yang ada isinya
                activeCats = finalOrder.filter(k => (stats[k] || 0) > 0);
            }

            // Update Engine State
            if (window.setActiveCategories) window.setActiveCategories(activeCats);
        }

        let totalSisaVisual = 0;

        finalOrder.forEach(cat => {
            const count = stats[cat] || 0;
            const isBonus = cat === 'kesempatan' || cat === 'tantangan';
            const isChecked = activeCats.includes(cat); // Cek status checked berdasarkan activeCats

            if (isChecked && !isBonus) totalSisaVisual += count;

            const li = document.createElement('li');
            li.className = 'stats-item';
  
            let countText = `${count} pertanyaan tersisa`;
            if (isBonus) {
                countText = `<span style="color:var(--cat-bonus); font-weight:bold;">∞ (Tak Terbatas)</span>`;
            } else if (count <= 0) {
                countText = `<span style="color:#ef4444; font-weight:bold;">Habis</span>`;
            }

            const displayName = cat.replace(/\b\w/g, l => l.toUpperCase());

            // LOGIKA DISABLE & FORCE OFF
            const isSwitchDisabled = (count <= 0 && !isBonus);
  
            // JIKA Switch Disabled (Habis), visualnya OFF.
            // TAPI, secara data (isChecked) kita biarkan sesuai history user,
            // supaya kalau nanti pertanyaan diisi lagi, otomatis nyala.
            // Visual check di checkbox:
            const isVisualChecked = isSwitchDisabled ? false : isChecked;
  
            const switchStyle = isSwitchDisabled ? 'opacity: 0.5; cursor: not-allowed;' : 'cursor: pointer;';
            const sliderStyle = isSwitchDisabled ? 'cursor: not-allowed;' : '';
            const textStyle = isSwitchDisabled ? 'opacity: 0.5;' : '';

            li.innerHTML = `
                <div class="stats-info" style="${textStyle}">
                    <span class="stats-name">${displayName}</span>
                    <span class="stats-count">${countText}</span>
                </div>
                <label class="switch" style="${switchStyle}">
                    <input type="checkbox" class="cat-toggle" data-cat="${cat}"
                        ${isVisualChecked ? 'checked' : ''}
                        ${isSwitchDisabled ? 'disabled' : ''}>
  
                    <span class="slider" style="${sliderStyle}"></span>
                </label>
            `;
            ul.appendChild(li);
        });

        container.appendChild(ul);
        getEl('total-info').innerText = `Sisa: ${totalSisaVisual}`;
  
        // CEK GAME OVER AWAL (SILENT MODE)
        // Kita panggil ini agar tombol 'Ambil Pertanyaan' langsung disable jika konfigurasi yang di-load menghasilkan 0 sisa.
        // false = JANGAN mainkan suara.
        checkGameOverState(totalSisaVisual, false);

        setupToggleListeners(stats, totalSisaVisual, [...activeCats]);
    }

    function setupToggleListeners(stats, currentTotal, currentActiveList) {
        document.querySelectorAll('.cat-toggle').forEach(toggle => {
            toggle.addEventListener('change', function () {
                const catName = this.dataset.cat;
                const count = stats[catName] || 0;
                const isBonusCat = catName === 'kesempatan' || catName === 'tantangan';
  
                if (this.checked) {
                    if (!currentActiveList.includes(catName)) {
                        currentActiveList.push(catName);
                        if (!isBonusCat) currentTotal += count;
                    }
                } else {
                    const idx = currentActiveList.indexOf(catName);
                    if (idx > -1) {
                        currentActiveList.splice(idx, 1);
                        if (!isBonusCat) currentTotal -= count;
                    }
                }
  
                // 1. Update State ke Engine
                if (window.setActiveCategories) {
                    window.setActiveCategories(currentActiveList);
                }

                // 2. SIMPAN KE LOCAL STORAGE
                localStorage.setItem('icebreaker_active_cats', JSON.stringify(currentActiveList));
  
                // Update UI Sisa
                getEl('total-info').innerText = `Sisa: ${currentTotal}`;
  
                // Cek Game Over (Play Sound = TRUE karena ini akibat klik user)
                checkGameOverState(currentTotal, true);
            });
        });
    }

    function checkGameOverState(total) {
        const btn = getEl('btn-next');
        const qElement = getEl('question');
        const isGameOver = window.getGameOverStatus ? window.getGameOverStatus() : false;

        if (total > 0) {
            if (isGameOver) {
                qElement.innerText = "Klik tombol di bawah untuk lanjut.";
                updateCardTheme('default');
                if (window.setGameOverStatus) window.setGameOverStatus(false);
            }
            btn.classList.remove('btn-disabled-permanent');
            btn.disabled = false;
            if (btn.innerText === 'Selesai') btn.innerText = 'Ambil Pertanyaan';
        } else {
            if (!isGameOver) {
                if (window.setGameOverStatus) window.setGameOverStatus(true);
                btn.classList.add('btn-disabled-permanent');
                btn.innerText = 'Selesai';
                btn.disabled = true;
                qElement.innerText = "Pertanyaan habis atau kategori utama non-aktif.";
                updateCardTheme('default');
                if (typeof playSfx === 'function') playSfx('over');
            }
        }
    }

    // ==================== AUTHENTICATION (Server-Side) ====================
    async function checkPassword() {
        const input = getEl('auth-input');
        const modal = getEl('modal-auth');
        const userText = input.value;

        try {
            // Kirim password ke server
            const response = await fetch('login.php', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: userText })
            });

            const result = await response.json();

            if (result.success) {
                // 1. Sembunyikan Modal
                modal.classList.add('hidden');

                // 2. Aktifkan Audio
                if (typeof audioCtx !== 'undefined' && audioCtx.state === 'suspended') audioCtx.resume();
                if (typeof playSfx === 'function') playSfx('start');

                // 3. BUKA GEMBOK UI & TARIK DATA (Fungsi Baru)
                enableGameUI();

            } else {
                triggerErrorAnimation(input);
            }
        } catch (e) {
            console.error("Login Error:", e);
            triggerErrorAnimation(input);
        }
    }

    // FUNGSI BARU: Mengaktifkan UI & Tarik Data Awal
    function enableGameUI() {
        const btn = getEl('btn-next');
        if (btn) btn.disabled = false;

        const badgeContainer = getEl('badge-container');
        if (badgeContainer) badgeContainer.classList.remove('ui-disabled');

        const badgeWrapper = document.querySelector('.badge-wrapper');
        if (badgeWrapper) badgeWrapper.classList.remove('ui-disabled');

        // PRE-FETCH DATA: Tarik data setelah login sukses!
        if (window.fetchGachaPool) window.fetchGachaPool();

        // TAMBAHKAN INI: Tarik data kategori juga
        if (window.fetchAllCategories) window.fetchAllCategories();
    }

    function triggerErrorAnimation(input) {
        if (typeof playSfx === 'function') playSfx('wrong');
        input.classList.remove('input-error');
        void input.offsetWidth;
        input.classList.add('input-error');
        input.value = '';
        input.placeholder = 'Password Salah!';
        setTimeout(() => {
            input.classList.remove('input-error');
            input.placeholder = 'Password...';
        }, 500);
    }

    function initFloatingEmojis() {
        const container = getEl('emoji-container');
        const emojis = ['🎉', '🧊', '🔥', '💡', '🎲', '✨', '🎈', '❤️', '😎'];

        setInterval(() => {
            const span = document.createElement('span');
            span.classList.add('emoji');
            span.innerText = emojis[Math.floor(Math.random() * emojis.length)];
            span.style.left = Math.random() * 100 + '%';
            span.style.fontSize = (Math.random() * 2 + 1) + 'rem';
            span.style.animationDuration = (Math.random() * 10 + 5) + 's';
            container.appendChild(span);
            setTimeout(() => { span.remove(); }, 15000);
        }, 800);
    }

    const authInput = getEl('auth-input');
    if (authInput) {
        authInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') checkPassword();
        });
    }

    // ==================== SECRET TRIGGER: FOOTER 3X TAP ====================
    const footer = document.querySelector('footer');
    let tapCount = 0;
    let tapTimer = null;

    if (footer) {
        footer.style.userSelect = 'none'; // Biar ga ke-blok pas klik cepet

        footer.addEventListener('click', (e) => {
            // Mencegah zoom di beberapa browser mobile saat double tap
            e.preventDefault();

            tapCount++;

            // Jika tap pertama, mulai timer reset
            if (tapCount === 1) {
                tapTimer = setTimeout(() => {
                    tapCount = 0; // Reset jika terlalu lama ga ngetuk lagi
                }, 800); // Batas waktu 800ms untuk 3 ketukan
            }

            // Jika mencapai 3 tap
            if (tapCount === 3) {
                clearTimeout(tapTimer); // Hapus timer reset
                tapCount = 0; // Reset hitungan

                // AKSI: Buka Modal Category
                if (window.openModal) window.openModal();
            }
        });
    }

    // ==================== INISIALISASI LANGSUNG ====================
    if (typeof initFloatingEmojis === 'function') initFloatingEmojis();

    // ==================== EXPOSE GLOBAL ====================
    window.openModal = openCategoryModal;
    window.closeModal = () => toggleModal('modal-category', false);

    window.openResetModal = () => toggleModal('modal-reset', true);
    window.closeResetModal = () => toggleModal('modal-reset', false);

    window.openSourceModal = openSourceModal;
    window.closeSourceModal = () => toggleModal('modal-source', false);

    window.openStatsModal = openStatsModal;
    window.closeStatsModal = () => toggleModal('modal-stats', false);

    window.checkPassword = checkPassword;

    window.startGachaEffect = startGachaEffect;
    window.stopGachaEffect = stopGachaEffect;

    window.updateCardTheme = updateCardTheme;
    window.checkTrigger = checkTrigger;

    window.resetButtonState = resetButtonState;
    window.confirmReset = confirmReset;
    window.confirmResetEngine = internalEngineReset;

})();