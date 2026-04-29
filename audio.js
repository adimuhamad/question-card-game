(function() {
    // ==================== CONFIG ====================
    // Kita pisahkan base path biar penulisannya lebih ringkas
    const SOUND_PATH = 'sound/';

    const soundConfig = {
        start:   { file: 'start.mp3',   volume: 1.5 },
        click:   { file: 'click.mp3',   volume: 1.0 },
        close:   { file: 'close.mp3',   volume: 3.0 },
        shuffle: { file: 'shuffle.mp3', volume: 3.0, loop: true },
        ding:    { file: 'ding.mp3',    volume: 0.5 },
        tada:    { file: 'tada.mp3',    volume: 0.5 },
        timer:   { file: 'timer.mp3',   volume: 1.0, loop: true },
        boom:    { file: 'boom.mp3',    volume: 2.0 },
        wrong:   { file: 'wrong.mp3',   volume: 2.0 },
        over:    { file: 'over.mp3',    volume: 1.5 }
    };

    // ==================== STATE & CONTEXT ====================
    // Menggunakan window.AudioContext atau fallback untuk browser lama
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();

    const buffers = {};       // Tempat menyimpan file suara yang sudah di-load
    const activeSources = {}; // Tempat menyimpan suara looping yang sedang aktif

    // ==================== LOADER ====================
    async function loadSounds() {
        for (const [name, config] of Object.entries(soundConfig)) {
            try {
                // Fetch file audio
                const response = await fetch(SOUND_PATH + config.file);
                const arrayBuffer = await response.arrayBuffer();

                // Decode dan simpan ke memory
                const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
                buffers[name] = audioBuffer;
            } catch (e) {
                console.warn(`Gagal memuat suara: ${name}`, e);
            }
        }
    }

    // Mulai load suara di background
    loadSounds();

    // ==================== PLAYBACK LOGIC ====================

    // Fungsi ini menangani kebijakan browser yang memblokir auto-play audio
    function resumeContext() {
        if (ctx.state === 'suspended') {
            ctx.resume().catch(e => console.error("Gagal resume audio:", e));
        }
    }

    function playSfx(name) {
        // Pastikan buffer ada dan konteks audio aktif
        if (!buffers[name]) return;
        resumeContext();

        const config = soundConfig[name];

        // Buat source (sumber suara) dan gain (pengatur volume)
        const source = ctx.createBufferSource();
        source.buffer = buffers[name];

        const gainNode = ctx.createGain();
        gainNode.gain.value = config.volume;

        // Sambungkan: Source -> Volume -> Speaker
        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        // Logika untuk suara yang looping (seperti timer/shuffle)
        if (config.loop) {
            source.loop = true;
            // Jika sudah ada suara loop yang sama jalan, matikan dulu
            if (activeSources[name]) {
                stopSfx(name);
            }
            activeSources[name] = source;
        }

        source.start(0);
    }

    function stopSfx(name) {
        // Hentikan suara jika sedang berjalan (biasanya untuk loop)
        if (activeSources[name]) {
            try {
                activeSources[name].stop();
            } catch (e) {
                // Abaikan error jika source sudah berhenti sendiri
            }
            delete activeSources[name];
        }
    }

    // ==================== EVENT LISTENERS ====================
    // Aktifkan Audio Context saat user pertama kali klik di mana saja
    document.body.addEventListener('click', resumeContext, { once: true });

    // ==================== EXPOSE GLOBALS ====================
    // Kita perlu "mengeluarkan" fungsi ini agar bisa dipanggil oleh engine.js & ui.js
    window.playSfx = playSfx;
    window.stopSfx = stopSfx;
    window.audioCtx = ctx; // Dibutuhkan oleh ui.js untuk cek state di modal auth

})();