// =============================================================
// ANALIZADOR ESPECTRAL FFT Y GENERADOR DE ONDAS
// Laboratorio de Ondas Mecánicas & Transformada de Fourier
// Tema: Azul Eléctrico (#1625f9) & Verde Menta (#16f9ad)
// =============================================================

let audioCtx = null;
let oscillator = null;
let toneGain = null;
let analyser = null;
let micStream = null;
let micSource = null;
let animationId = null;

// Configuración y Estados
let currentWaveType = 'square';
let currentRangeMode = 'terms-5'; // 5 términos por defecto
let currentFFTSize = 4096;
let isFrozen = false;             // Modo Foto / Pausa
let frozenFreqData = null;
let frozenTimeData = null;

// =============================================================
// SISTEMA DE CURSORES DINÁMICOS (HASTA 5 CURSORES)
// =============================================================
const CURSOR_COLORS = [
    { border: '#1625f9', bg: '#eff6ff', darkBg: 'rgba(22, 37, 249, 0.2)', text: '#1625f9', darkText: '#60a5fa' }, // C1: Azul
    { border: '#059669', bg: '#ecfdf5', darkBg: 'rgba(5, 150, 105, 0.2)', text: '#059669', darkText: '#34d399' }, // C2: Esmeralda
    { border: '#d97706', bg: '#fffbeb', darkBg: 'rgba(217, 119, 6, 0.2)', text: '#d97706', darkText: '#fbbf24' }, // C3: Ámbar
    { border: '#db2777', bg: '#fdf2f8', darkBg: 'rgba(219, 39, 119, 0.2)', text: '#db2777', darkText: '#f472b6' }, // C4: Rosa
    { border: '#7c3aed', bg: '#f5f3ff', darkBg: 'rgba(124, 58, 237, 0.2)', text: '#7c3aed', darkText: '#a78bfa' }  // C5: Púrpura
];

// Lista de IDs de cursores activos (inicialmente solo el Cursor 1)
let activeCursorList = [1];
let activeCursorId = 1; // El cursor actualmente seleccionado para mover

const cursors = {
    1: { active: false, freq: 0, bin: 0, val: 0 },
    2: { active: false, freq: 0, bin: 0, val: 0 },
    3: { active: false, freq: 0, bin: 0, val: 0 },
    4: { active: false, freq: 0, bin: 0, val: 0 },
    5: { active: false, freq: 0, bin: 0, val: 0 }
};

// Referencias del DOM
const freqSlider = document.getElementById('freqSlider');
const freqInput = document.getElementById('freqInput');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const freqRangeSelect = document.getElementById('freqRangeSelect');
const fftSizeSelect = document.getElementById('fftSizeSelect');

const btnStartTone = document.getElementById('btnStartTone');
const btnStopTone = document.getElementById('btnStopTone');
const btnStartMic = document.getElementById('btnStartMic');
const btnStopMic = document.getElementById('btnStopMic');
const micError = document.getElementById('micError');

const emisorLed = document.getElementById('emisor-led');
const receptorLed = document.getElementById('receptor-led');
const audioStatusText = document.getElementById('audioStatusText');
const sampleRateLabel = document.getElementById('sampleRateLabel');
const freezeBadge = document.getElementById('freezeBadge');

const btnToggleDark = document.getElementById('btnToggleDark');
const darkIcon = document.getElementById('darkIcon');

const btnFreeze = document.getElementById('btnFreeze');
const freezeIcon = document.getElementById('freezeIcon');
const freezeText = document.getElementById('freezeText');

const cursorPillsContainer = document.getElementById('cursorPillsContainer');
const btnAddCursor = document.getElementById('btnAddCursor');
const btnSnapPeakRight = document.getElementById('btnSnapPeakRight');
const btnClearCursors = document.getElementById('btnClearCursors');
const cursorReadoutsContainer = document.getElementById('cursorReadoutsContainer');
const deltaFReadout = document.getElementById('deltaFReadout');
const deltaTReadout = document.getElementById('deltaTReadout');

const peakFreqText = document.getElementById('peakFreqText');
const noteText = document.getElementById('noteText');
const resText = document.getElementById('resText');

const midFreqLabel = document.getElementById('midFreqLabel');
const nyquistLabel = document.getElementById('nyquistLabel');

// Canvases y Contextos 2D
const oscCanvas = document.getElementById('oscilloscopeCanvas');
const oscCtx = oscCanvas.getContext('2d');

const spectrumCanvas = document.getElementById('spectrumCanvas');
const spectrumCtx = spectrumCanvas.getContext('2d');
const spectrumTooltip = document.getElementById('spectrumTooltip');

const waterfallCanvas = document.getElementById('waterfallCanvas');
const waterfallCtx = waterfallCanvas.getContext('2d', { willReadFrequently: true });

let hoverX = -1;
let hoverY = -1;

// -------------------------------------------------------------
// GESTIÓN DEL MODO OSCURO (DARK MODE)
// -------------------------------------------------------------
function updateDarkModeUI() {
    const isDark = document.documentElement.classList.contains('dark');
    darkIcon.textContent = isDark ? '☀️' : '🌙';
    renderCursorPills();
    if (isFrozen) drawCurrentFrames();
}

btnToggleDark.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateDarkModeUI();
});

// -------------------------------------------------------------
// SELECTOR DE FORMA DE ONDA (BOTONES CON FIGURAS SVG)
// -------------------------------------------------------------
const waveButtons = document.querySelectorAll('.wave-btn');
waveButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        waveButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentWaveType = btn.dataset.wave;
        if (oscillator) {
            oscillator.type = currentWaveType;
        }
    });
});

// -------------------------------------------------------------
// PALETA TÉRMICA (Para el Waterfall / Espectrograma)
// -------------------------------------------------------------
const colormap = new Uint8ClampedArray(256 * 4);
for (let i = 0; i < 256; i++) {
    colormap[i * 4]     = Math.min(255, i * 2.8);                      // Rojo
    colormap[i * 4 + 1] = Math.min(255, Math.max(0, i - 70) * 2.2); // Verde
    colormap[i * 4 + 2] = Math.min(255, Math.max(0, i - 160) * 4); // Azul
    colormap[i * 4 + 3] = 255;                                    // Alfa
}

// -------------------------------------------------------------
// INICIALIZACIÓN DEL ENTORNO DE AUDIO
// -------------------------------------------------------------
async function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = currentFFTSize;
        analyser.smoothingTimeConstant = 0.55;

        toneGain = audioCtx.createGain();
        toneGain.gain.setValueAtTime(parseFloat(volumeSlider.value) / 100, audioCtx.currentTime);
        toneGain.connect(audioCtx.destination);

        updateLabels();
        audioStatusText.textContent = 'Activo';
        audioStatusText.classList.replace('text-gray-500', 'text-[#16f9ad]');
    }

    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

// -------------------------------------------------------------
// CÁLCULO DINÁMICO DE FRECUENCIA MÁXIMA VISIBLE
// -------------------------------------------------------------
function calculateMaxFrequency() {
    const nyquist = audioCtx ? audioCtx.sampleRate / 2 : 24000;

    if (currentRangeMode.startsWith('terms-')) {
        const numTerms = parseInt(currentRangeMode.split('-')[1], 10);
        
        let f0 = parseFloat(freqInput.value);
        if (isNaN(f0) || f0 <= 0) f0 = 440;

        if (!oscillator && lastDetectedPeak > 25) {
            f0 = lastDetectedPeak;
        }

        const targetMax = (numTerms + 0.35) * f0;
        return Math.min(nyquist, Math.max(200, targetMax));
    }

    if (currentRangeMode === 'full') {
        return nyquist;
    }

    const fixed = parseFloat(currentRangeMode);
    return Math.min(nyquist, isNaN(fixed) ? 5000 : fixed);
}

let lastDetectedPeak = 440;

function updateLabels() {
    const sr = audioCtx ? audioCtx.sampleRate : 48000;
    sampleRateLabel.textContent = `${(sr / 1000).toFixed(1)} kHz`;

    const fftSize = analyser ? analyser.fftSize : currentFFTSize;
    const deltaF = sr / fftSize;
    resText.textContent = `Δf = ${deltaF.toFixed(2)} Hz`;

    const maxF = calculateMaxFrequency();
    midFreqLabel.textContent = `${(maxF / 2000).toFixed(2)} kHz`;
    nyquistLabel.textContent = `${(maxF / 1000).toFixed(2)} kHz`;
}

// -------------------------------------------------------------
// SINCRONIZACIÓN DE FRECUENCIA Y PRESETS
// -------------------------------------------------------------
function setFrequency(val) {
    let num = parseFloat(val);
    if (isNaN(num)) return;
    num = Math.max(20, Math.min(20000, num));

    freqSlider.value = num <= 5000 ? num : 5000;
    freqInput.value = Math.round(num);

    if (oscillator && audioCtx) {
        oscillator.frequency.setTargetAtTime(num, audioCtx.currentTime, 0.01);
    }
    updateLabels();
}

freqSlider.addEventListener('input', (e) => setFrequency(e.target.value));
freqInput.addEventListener('input', (e) => setFrequency(e.target.value));

document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const f = parseFloat(btn.dataset.freq);
        setFrequency(f);
    });
});

volumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    volumeValue.textContent = `${val}%`;
    if (toneGain && audioCtx) {
        toneGain.gain.setTargetAtTime(val / 100, audioCtx.currentTime, 0.01);
    }
});

freqRangeSelect.addEventListener('change', (e) => {
    currentRangeMode = e.target.value;
    updateLabels();
    if (isFrozen) drawCurrentFrames();
});

fftSizeSelect.addEventListener('change', (e) => {
    currentFFTSize = parseInt(e.target.value, 10);
    if (analyser) {
        analyser.fftSize = currentFFTSize;
        updateLabels();
    }
});

// -------------------------------------------------------------
// CONTROL DE PAUSA / FOTO (CONGELAMIENTO DEL ESPECTRO)
// -------------------------------------------------------------
btnFreeze.addEventListener('click', () => {
    isFrozen = !isFrozen;

    if (isFrozen) {
        if (analyser) {
            const bufLen = analyser.frequencyBinCount;
            frozenFreqData = new Uint8Array(bufLen);
            analyser.getByteFrequencyData(frozenFreqData);

            frozenTimeData = new Uint8Array(analyser.fftSize);
            analyser.getByteTimeDomainData(frozenTimeData);
        }

        freezeBadge.classList.remove('hidden');
        btnFreeze.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
        btnFreeze.classList.add('bg-blue-700', 'hover:bg-blue-800');
        freezeIcon.textContent = '▶';
        freezeText.textContent = 'Reanudar En Vivo';
    } else {
        frozenFreqData = null;
        frozenTimeData = null;
        freezeBadge.classList.add('hidden');
        btnFreeze.classList.remove('bg-blue-700', 'hover:bg-blue-800');
        btnFreeze.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
        freezeIcon.textContent = '📸';
        freezeText.textContent = 'Tomar Foto / Pausa';
    }
});

// -------------------------------------------------------------
// GESTIÓN DINÁMICA DE CURSORES (HASTA 5)
// -------------------------------------------------------------
function renderCursorPills() {
    cursorPillsContainer.innerHTML = '';
    const isDark = document.documentElement.classList.contains('dark');

    activeCursorList.forEach(id => {
        const conf = CURSOR_COLORS[id - 1];
        const isSelected = id === activeCursorId;

        const pill = document.createElement('div');
        pill.className = `cursor-pill flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
            isSelected ? 'active ring-2 shadow-sm' : 'opacity-85 hover:opacity-100'
        }`;
        
        pill.style.borderColor = conf.border;
        pill.style.backgroundColor = isDark ? conf.darkBg : conf.bg;
        pill.style.color = isDark ? conf.darkText : conf.text;

        // Clic en la pastilla para seleccionar este cursor como el activo para mover
        pill.addEventListener('click', (e) => {
            if (e.target.dataset.action === 'remove') return;
            activeCursorId = id;
            renderCursorPills();
        });

        // Indicador de color
        const dot = document.createElement('span');
        dot.className = 'w-2 h-2 rounded-full inline-block';
        dot.style.backgroundColor = conf.border;
        pill.appendChild(dot);

        // Texto
        const label = document.createElement('span');
        label.textContent = `C${id}`;
        pill.appendChild(label);

        // Botón de eliminar (si hay más de 1 cursor)
        if (activeCursorList.length > 1) {
            const btnRemove = document.createElement('button');
            btnRemove.innerHTML = '&times;';
            btnRemove.dataset.action = 'remove';
            btnRemove.className = 'ml-1 hover:text-red-500 font-bold text-sm leading-none';
            btnRemove.title = `Eliminar Cursor ${id}`;
            btnRemove.addEventListener('click', (e) => {
                e.stopPropagation();
                removeCursor(id);
            });
            pill.appendChild(btnRemove);
        }

        cursorPillsContainer.appendChild(pill);
    });

    // Deshabilitar botón de agregar si ya se llegó al máximo de 5
    if (activeCursorList.length >= 5) {
        btnAddCursor.disabled = true;
        btnAddCursor.classList.add('opacity-40', 'cursor-not-allowed');
    } else {
        btnAddCursor.disabled = false;
        btnAddCursor.classList.remove('opacity-40', 'cursor-not-allowed');
    }

    updateCursorReadouts();
}

// Agregar cursor (hasta 5)
btnAddCursor.addEventListener('click', () => {
    if (activeCursorList.length >= 5) return;

    // Encontrar el ID más bajo disponible entre 1 y 5
    let newId = 1;
    for (let i = 1; i <= 5; i++) {
        if (!activeCursorList.includes(i)) {
            newId = i;
            break;
        }
    }

    activeCursorList.push(newId);
    activeCursorList.sort((a, b) => a - b);
    activeCursorId = newId; // Seleccionar el recién creado
    cursors[newId] = { active: false, freq: 0, bin: 0, val: 0 };

    renderCursorPills();
});

// Eliminar un cursor
function removeCursor(id) {
    if (activeCursorList.length <= 1) return;

    activeCursorList = activeCursorList.filter(item => item !== id);
    cursors[id].active = false;

    if (activeCursorId === id) {
        activeCursorId = activeCursorList[0];
    }

    renderCursorPills();
    if (isFrozen) drawCurrentFrames();
}

function updateCursorReadouts() {
    cursorReadoutsContainer.innerHTML = '';
    const isDark = document.documentElement.classList.contains('dark');

    const activeItems = [];

    activeCursorList.forEach(id => {
        const cur = cursors[id];
        const conf = CURSOR_COLORS[id - 1];

        const item = document.createElement('div');
        item.className = 'flex items-center gap-1.5';

        const dot = document.createElement('span');
        dot.className = 'w-2 h-2 rounded-full';
        dot.style.backgroundColor = conf.border;

        const text = document.createElement('span');
        if (cur.active) {
            text.innerHTML = `<span class="text-gray-500 dark:text-gray-400 font-sans">C${id}:</span> <b style="color:${isDark ? conf.darkText : conf.text}">${cur.freq.toFixed(1)} Hz</b> <span class="text-[10px] text-gray-400 font-sans">(${frequencyToNote(cur.freq)})</span>`;
            activeItems.push({ id, freq: cur.freq });
        } else {
            text.innerHTML = `<span class="text-gray-500 dark:text-gray-400 font-sans">C${id}:</span> <span class="text-gray-400">-- Hz</span>`;
        }

        item.appendChild(dot);
        item.appendChild(text);
        cursorReadoutsContainer.appendChild(item);
    });

    // Medición de diferencia (entre el cursor actualmente activo y el anterior, o los dos primeros activos)
    if (activeItems.length >= 2) {
        // Tomar los dos primeros o el seleccionado y el anterior
        const f1 = activeItems[0].freq;
        const f2 = activeItems[1].freq;
        const deltaF = Math.abs(f2 - f1);
        deltaFReadout.textContent = `|C${activeItems[1].id} - C${activeItems[0].id}| = ${deltaF.toFixed(1)} Hz`;
        if (deltaF > 0.5) {
            const periodMs = (1000 / deltaF).toFixed(2);
            deltaTReadout.textContent = `(ΔT ≈ ${periodMs} ms)`;
        } else {
            deltaTReadout.textContent = '';
        }
    } else {
        deltaFReadout.textContent = '-- Hz';
        deltaTReadout.textContent = '';
    }
}

// Limpiar cursores
btnClearCursors.addEventListener('click', () => {
    activeCursorList.forEach(id => {
        cursors[id].active = false;
    });
    updateCursorReadouts();
    if (isFrozen) drawCurrentFrames();
});

// Click en el espectro: MUEVE ÚNICAMENTE EL CURSOR SELECCIONADO
spectrumCanvas.addEventListener('click', (e) => {
    const rect = spectrumCanvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const w = spectrumCanvas.width;
    if (w <= 0) return;

    const maxFreq = calculateMaxFrequency();
    const nyquist = audioCtx ? audioCtx.sampleRate / 2 : 24000;
    const bufferLength = analyser ? analyser.frequencyBinCount : currentFFTSize / 2;

    const freqAtClick = (clickX / w) * maxFreq;
    const bin = Math.min(bufferLength - 1, Math.max(0, Math.round((freqAtClick / nyquist) * bufferLength)));

    const data = isFrozen && frozenFreqData ? frozenFreqData : (analyser ? getLiveFreqData() : null);
    const val = data ? data[bin] : 0;

    // Mover exclusivamente el cursor activo seleccionado
    cursors[activeCursorId].active = true;
    cursors[activeCursorId].freq = freqAtClick;
    cursors[activeCursorId].bin = bin;
    cursors[activeCursorId].val = val;

    updateCursorReadouts();
    if (isFrozen) drawCurrentFrames();
});

function getLiveFreqData() {
    if (!analyser) return null;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return data;
}

// -------------------------------------------------------------
// BOTÓN: BUSCAR PICO / CRESTA MÁS CERCANO A LA DERECHA
// -------------------------------------------------------------
btnSnapPeakRight.addEventListener('click', () => {
    const nyquist = audioCtx ? audioCtx.sampleRate / 2 : 24000;
    const bufferLength = analyser ? analyser.frequencyBinCount : currentFFTSize / 2;
    const maxFreq = calculateMaxFrequency();
    const maxVisibleBin = Math.min(bufferLength - 1, Math.floor((maxFreq / nyquist) * bufferLength));

    const data = isFrozen && frozenFreqData ? frozenFreqData : getLiveFreqData();
    if (!data) return;

    let startBin = 2;
    if (cursors[activeCursorId].active) {
        startBin = cursors[activeCursorId].bin + 2;
    }

    if (startBin >= maxVisibleBin - 2) {
        startBin = 2;
    }

    let foundBin = -1;
    for (let i = startBin; i <= maxVisibleBin - 2; i++) {
        const val = data[i];
        if (val > 25 &&
            val >= data[i - 1] && val >= data[i - 2] &&
            val > data[i + 1] && val >= data[i + 2]) {
            foundBin = i;
            break;
        }
    }

    if (foundBin !== -1) {
        const peakF = foundBin * (nyquist / bufferLength);
        cursors[activeCursorId].active = true;
        cursors[activeCursorId].bin = foundBin;
        cursors[activeCursorId].freq = peakF;
        cursors[activeCursorId].val = data[foundBin];
        updateCursorReadouts();
        if (isFrozen) drawCurrentFrames();
    }
});

// -------------------------------------------------------------
// EMISOR (GENERADOR DE TONOS)
// -------------------------------------------------------------
btnStartTone.addEventListener('click', async () => {
    await initAudio();

    if (oscillator) {
        try { oscillator.stop(); } catch(e) {}
        oscillator.disconnect();
    }

    oscillator = audioCtx.createOscillator();
    oscillator.type = currentWaveType;
    oscillator.frequency.setValueAtTime(parseFloat(freqInput.value) || 440, audioCtx.currentTime);

    oscillator.connect(toneGain);
    oscillator.connect(analyser);

    const targetGain = parseFloat(volumeSlider.value) / 100;
    toneGain.gain.cancelScheduledValues(audioCtx.currentTime);
    toneGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    toneGain.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain), audioCtx.currentTime + 0.04);

    oscillator.start();

    btnStartTone.disabled = true;
    btnStartTone.classList.add('opacity-50', 'cursor-not-allowed');
    btnStopTone.disabled = false;
    btnStopTone.classList.remove('bg-gray-200', 'dark:bg-slate-800', 'text-gray-400', 'cursor-not-allowed');
    btnStopTone.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white');

    emisorLed.classList.replace('bg-gray-300', 'bg-[#1625f9]');
    emisorLed.classList.add('shadow-[0_0_8px_rgba(22,37,249,0.8)]');

    updateLabels();
});

btnStopTone.addEventListener('click', () => {
    if (oscillator && audioCtx) {
        toneGain.gain.cancelScheduledValues(audioCtx.currentTime);
        toneGain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
        setTimeout(() => {
            if (oscillator) {
                try { oscillator.stop(); } catch(e) {}
                oscillator.disconnect();
                oscillator = null;
            }
        }, 50);
    }

    btnStartTone.disabled = false;
    btnStartTone.classList.remove('opacity-50', 'cursor-not-allowed');
    btnStopTone.disabled = true;
    btnStopTone.classList.remove('bg-red-500', 'hover:bg-red-600', 'text-white');
    btnStopTone.classList.add('bg-gray-200', 'dark:bg-slate-800', 'text-gray-400', 'cursor-not-allowed');

    emisorLed.classList.replace('bg-[#1625f9]', 'bg-gray-300');
    emisorLed.classList.remove('shadow-[0_0_8px_rgba(22,37,249,0.8)]');
});

// -------------------------------------------------------------
// RECEPTOR (MICRÓFONO)
// -------------------------------------------------------------
btnStartMic.addEventListener('click', async () => {
    await initAudio();
    micError.classList.add('hidden');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        micError.textContent = "El navegador requiere contexto seguro (http://localhost) para el micrófono. Inicia la aplicación con 'iniciar_analizador.bat'.";
        micError.classList.remove('hidden');
        return;
    }

    try {
        micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            },
            video: false
        });

        micSource = audioCtx.createMediaStreamSource(micStream);
        micSource.connect(analyser);

        btnStartMic.classList.add('hidden');
        btnStopMic.classList.remove('hidden');
        btnStopMic.disabled = false;
        btnStopMic.classList.remove('bg-gray-200', 'text-gray-500', 'cursor-not-allowed');
        btnStopMic.classList.add('bg-red-100', 'text-red-700', 'hover:bg-red-200', 'border', 'border-red-300');

        receptorLed.classList.replace('bg-gray-300', 'bg-[#16f9ad]');
        receptorLed.classList.add('shadow-[0_0_8px_rgba(22,249,173,0.9)]');

    } catch (err) {
        console.error("Error al acceder al micrófono:", err);
        micError.textContent = "No se pudo acceder al micrófono. Por favor otorga los permisos en el navegador.";
        micError.classList.remove('hidden');
    }
});

btnStopMic.addEventListener('click', () => {
    if (micStream) {
        micStream.getTracks().forEach(track => track.stop());
        micStream = null;
    }
    if (micSource) {
        micSource.disconnect();
        micSource = null;
    }

    btnStopMic.classList.add('hidden');
    btnStopMic.disabled = true;
    btnStartMic.classList.remove('hidden');

    receptorLed.classList.replace('bg-[#16f9ad]', 'bg-gray-300');
    receptorLed.classList.remove('shadow-[0_0_8px_rgba(22,249,173,0.9)]');
});

// -------------------------------------------------------------
// NOTA MUSICAL
// -------------------------------------------------------------
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function frequencyToNote(freq) {
    if (freq < 20 || freq > 20000) return '--';
    const noteNum = 12 * (Math.log(freq / 440) / Math.log(2));
    const midi = Math.round(noteNum) + 69;
    const noteIndex = (midi % 12 + 12) % 12;
    const octave = Math.floor(midi / 12) - 1;
    const cents = Math.round((noteNum - Math.round(noteNum)) * 100);
    const sign = cents >= 0 ? '+' : '';
    return `${NOTE_NAMES[noteIndex]}${octave} (${sign}${cents}¢)`;
}

// -------------------------------------------------------------
// REDIMENSIONAMIENTO DE CANVASES
// -------------------------------------------------------------
function resizeCanvases() {
    const parentWidth = spectrumCanvas.parentElement.clientWidth;
    if (parentWidth <= 0) return;

    oscCanvas.width = parentWidth;
    oscCanvas.height = 150;

    spectrumCanvas.width = parentWidth;
    spectrumCanvas.height = 220;

    const prevImg = waterfallCanvas.width > 0 ? waterfallCtx.getImageData(0, 0, waterfallCanvas.width, waterfallCanvas.height) : null;
    waterfallCanvas.width = parentWidth;
    waterfallCanvas.height = 200;

    waterfallCtx.fillStyle = '#000000';
    waterfallCtx.fillRect(0, 0, waterfallCanvas.width, waterfallCanvas.height);
    if (prevImg) waterfallCtx.putImageData(prevImg, 0, 0);

    waterfallCtx.imageSmoothingEnabled = false;

    if (!analyser || isFrozen) {
        drawCurrentFrames();
    }
}

window.addEventListener('resize', resizeCanvases);

function drawCurrentFrames() {
    if (isFrozen && frozenFreqData && frozenTimeData) {
        renderFrame(frozenTimeData, frozenFreqData);
    } else {
        drawInitialFrames();
    }
}

function drawInitialFrames() {
    const w = oscCanvas.width;
    const isDark = document.documentElement.classList.contains('dark');

    // Osciloscopio
    oscCtx.fillStyle = '#020617';
    oscCtx.fillRect(0, 0, w, 150);
    oscCtx.strokeStyle = '#1e293b';
    oscCtx.lineWidth = 1;
    oscCtx.beginPath();
    for (let i = 1; i < 6; i++) {
        oscCtx.moveTo(0, (150 / 6) * i);
        oscCtx.lineTo(w, (150 / 6) * i);
    }
    for (let i = 1; i < 10; i++) {
        oscCtx.moveTo((w / 10) * i, 0);
        oscCtx.lineTo((w / 10) * i, 150);
    }
    oscCtx.stroke();

    oscCtx.strokeStyle = '#16f9ad';
    oscCtx.lineWidth = 1.5;
    oscCtx.beginPath();
    oscCtx.moveTo(0, 75);
    oscCtx.lineTo(w, 75);
    oscCtx.stroke();

    // Espectro adaptativo a tema claro/oscuro
    spectrumCtx.fillStyle = isDark ? '#090d16' : '#ffffff';
    spectrumCtx.fillRect(0, 0, w, 220);
    spectrumCtx.strokeStyle = isDark ? '#1e293b' : '#f1f5f9';
    spectrumCtx.lineWidth = 1;
    spectrumCtx.beginPath();
    for (let i = 1; i < 8; i++) {
        spectrumCtx.moveTo(0, (220 / 8) * i);
        spectrumCtx.lineTo(w, (220 / 8) * i);
    }
    for (let i = 1; i < 10; i++) {
        spectrumCtx.moveTo((w / 10) * i, 0);
        spectrumCtx.lineTo((w / 10) * i, 220);
    }
    spectrumCtx.stroke();

    spectrumCtx.strokeStyle = isDark ? '#38bdf8' : '#1625f9';
    spectrumCtx.lineWidth = 2;
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(0, 219);
    spectrumCtx.lineTo(w, 219);
    spectrumCtx.stroke();
}

// -------------------------------------------------------------
// BUCLE PRINCIPAL DE ANIMACIÓN
// -------------------------------------------------------------
function render() {
    animationId = requestAnimationFrame(render);
    if (isFrozen) return;
    if (!analyser || !audioCtx) return;

    const bufferLength = analyser.frequencyBinCount;
    const timeData = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(timeData);

    const freqData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqData);

    renderFrame(timeData, freqData);
}

// -------------------------------------------------------------
// RENDERIZADO DE UN FRAME (EN VIVO O CONGELADO)
// -------------------------------------------------------------
function renderFrame(timeData, freqData) {
    const w = oscCanvas.width;
    const isDark = document.documentElement.classList.contains('dark');
    const sampleRate = audioCtx ? audioCtx.sampleRate : 48000;
    const nyquist = sampleRate / 2;
    const bufferLength = freqData.length;
    const maxFreq = calculateMaxFrequency();
    const visibleBins = Math.min(bufferLength, Math.max(1, Math.floor((maxFreq / nyquist) * bufferLength)));

    // =========================================================
    // 1. DIBUJAR OSCILOSCOPIO
    // =========================================================
    const hOsc = oscCanvas.height;
    oscCtx.fillStyle = '#020617';
    oscCtx.fillRect(0, 0, w, hOsc);

    oscCtx.strokeStyle = '#1e293b';
    oscCtx.lineWidth = 1;
    oscCtx.beginPath();
    for (let i = 1; i < 6; i++) {
        oscCtx.moveTo(0, (hOsc / 6) * i);
        oscCtx.lineTo(w, (hOsc / 6) * i);
    }
    for (let i = 1; i < 10; i++) {
        oscCtx.moveTo((w / 10) * i, 0);
        oscCtx.lineTo((w / 10) * i, hOsc);
    }
    oscCtx.stroke();

    let triggerOffset = 0;
    for (let i = 0; i < timeData.length / 2; i++) {
        if (timeData[i] < 128 && timeData[i + 1] >= 128) {
            triggerOffset = i;
            break;
        }
    }

    oscCtx.strokeStyle = '#16f9ad';
    oscCtx.lineWidth = 2;
    oscCtx.beginPath();
    const sliceWidth = w / (timeData.length / 4);
    let xOsc = 0;
    for (let i = triggerOffset; i < timeData.length && xOsc < w; i++) {
        const v = timeData[i] / 128.0;
        const y = (v * hOsc) / 2;
        if (xOsc === 0) oscCtx.moveTo(xOsc, y);
        else oscCtx.lineTo(xOsc, y);
        xOsc += sliceWidth;
    }
    oscCtx.stroke();

    // =========================================================
    // 2. DIBUJAR ESPECTRO FFT
    // =========================================================
    const hSpec = spectrumCanvas.height;
    spectrumCtx.fillStyle = isDark ? '#090d16' : '#ffffff';
    spectrumCtx.fillRect(0, 0, w, hSpec);

    spectrumCtx.strokeStyle = isDark ? '#1e293b' : '#f1f5f9';
    spectrumCtx.lineWidth = 1;
    spectrumCtx.beginPath();
    for (let i = 1; i < 8; i++) {
        spectrumCtx.moveTo(0, (hSpec / 8) * i);
        spectrumCtx.lineTo(w, (hSpec / 8) * i);
    }
    for (let i = 1; i < 10; i++) {
        spectrumCtx.moveTo((w / 10) * i, 0);
        spectrumCtx.lineTo((w / 10) * i, hSpec);
    }
    spectrumCtx.stroke();

    // Guías de armónicos f0, 2f0, ... en modo términos
    let f0 = parseFloat(freqInput.value) || 440;
    if (!oscillator && lastDetectedPeak > 25) f0 = lastDetectedPeak;

    if (currentRangeMode.startsWith('terms-')) {
        const numTerms = parseInt(currentRangeMode.split('-')[1], 10);
        spectrumCtx.save();
        spectrumCtx.lineWidth = 1;
        spectrumCtx.setLineDash([4, 4]);

        for (let k = 1; k <= numTerms; k++) {
            const harmFreq = k * f0;
            const harmX = (harmFreq / maxFreq) * w;
            if (harmX > 0 && harmX < w) {
                spectrumCtx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.25)' : 'rgba(22, 37, 249, 0.25)';
                spectrumCtx.beginPath();
                spectrumCtx.moveTo(harmX, 0);
                spectrumCtx.lineTo(harmX, hSpec);
                spectrumCtx.stroke();

                spectrumCtx.fillStyle = isDark ? '#38bdf8' : '#1625f9';
                spectrumCtx.font = '10px Inter, sans-serif';
                spectrumCtx.fillText(`${k}f₀`, Math.min(w - 24, harmX + 3), 15);
            }
        }
        spectrumCtx.restore();
    }

    // Pico máximo
    let maxVal = 0;
    let maxIndex = 0;
    for (let i = 1; i < visibleBins; i++) {
        if (freqData[i] > maxVal) {
            maxVal = freqData[i];
            maxIndex = i;
        }
    }

    const peakFrequency = maxIndex * (nyquist / bufferLength);
    if (maxVal > 25) {
        lastDetectedPeak = peakFrequency;
        peakFreqText.textContent = `${peakFrequency.toFixed(1)} Hz`;
        noteText.textContent = frequencyToNote(peakFrequency);
    } else {
        peakFreqText.textContent = `-- Hz`;
        noteText.textContent = `--`;
    }

    // Área bajo la curva
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(0, hSpec);
    for (let x = 0; x < w; x++) {
        const binIndex = Math.floor((x / w) * visibleBins);
        const v = freqData[binIndex] / 255.0;
        const y = hSpec - (v * (hSpec - 12));
        spectrumCtx.lineTo(x, y);
    }
    spectrumCtx.lineTo(w, hSpec);
    spectrumCtx.closePath();
    spectrumCtx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(22, 37, 249, 0.07)';
    spectrumCtx.fill();

    // Curva del espectro
    spectrumCtx.beginPath();
    spectrumCtx.lineWidth = 2;
    spectrumCtx.strokeStyle = isDark ? '#38bdf8' : '#1625f9';
    for (let x = 0; x < w; x++) {
        const binIndex = Math.floor((x / w) * visibleBins);
        const v = freqData[binIndex] / 255.0;
        const y = hSpec - (v * (hSpec - 12));
        if (x === 0) spectrumCtx.moveTo(x, y);
        else spectrumCtx.lineTo(x, y);
    }
    spectrumCtx.stroke();

    if (maxVal > 25 && visibleBins > 0) {
        const peakX = (maxIndex / visibleBins) * w;
        const peakY = hSpec - ((maxVal / 255.0) * (hSpec - 12));
        spectrumCtx.fillStyle = '#16f9ad';
        spectrumCtx.strokeStyle = '#059669';
        spectrumCtx.lineWidth = 1.5;
        spectrumCtx.beginPath();
        spectrumCtx.arc(peakX, peakY, 4.5, 0, Math.PI * 2);
        spectrumCtx.fill();
        spectrumCtx.stroke();
    }

    // DIBUJAR TODOS LOS CURSORES ACTIVOS (HASTA 5)
    activeCursorList.forEach(id => {
        const conf = CURSOR_COLORS[id - 1];
        drawCursor(id, conf.border, '#ffffff', w, hSpec, maxFreq, visibleBins, freqData, id === activeCursorId);
    });

    // Cursor / Mira interactiva del ratón
    if (hoverX >= 0 && hoverX <= w) {
        spectrumCtx.strokeStyle = isDark ? '#64748b' : '#94a3b8';
        spectrumCtx.lineWidth = 1;
        spectrumCtx.setLineDash([3, 3]);
        spectrumCtx.beginPath();
        spectrumCtx.moveTo(hoverX, 0);
        spectrumCtx.lineTo(hoverX, hSpec);
        spectrumCtx.stroke();
        spectrumCtx.setLineDash([]);
    }

    // =========================================================
    // 3. DIBUJAR WATERFALL
    // =========================================================
    if (!isFrozen) {
        const hWat = waterfallCanvas.height;
        waterfallCtx.drawImage(waterfallCanvas, 0, 0, w, hWat - 1, 0, 1, w, hWat - 1);

        const imgData = waterfallCtx.createImageData(w, 1);
        for (let x = 0; x < w; x++) {
            const binIndex = Math.floor((x / w) * visibleBins);
            const val = freqData[binIndex];
            imgData.data[x * 4]     = colormap[val * 4];
            imgData.data[x * 4 + 1] = colormap[val * 4 + 1];
            imgData.data[x * 4 + 2] = colormap[val * 4 + 2];
            imgData.data[x * 4 + 3] = 255;
        }
        waterfallCtx.putImageData(imgData, 0, 0);
    }
}

// -------------------------------------------------------------
// DIBUJADO DE CURSOR INDIVIDUAL
// -------------------------------------------------------------
function drawCursor(id, color, textColor, w, hSpec, maxFreq, visibleBins, freqData, isSelected) {
    const cur = cursors[id];
    if (!cur.active) return;

    const x = (cur.freq / maxFreq) * w;
    if (x < 0 || x > w) return;

    spectrumCtx.save();
    spectrumCtx.strokeStyle = color;
    spectrumCtx.lineWidth = isSelected ? 2 : 1.5;
    spectrumCtx.setLineDash(isSelected ? [5, 2] : [3, 3]);
    spectrumCtx.beginPath();
    spectrumCtx.moveTo(x, 0);
    spectrumCtx.lineTo(x, hSpec);
    spectrumCtx.stroke();
    spectrumCtx.restore();

    const bin = Math.min(visibleBins - 1, Math.max(0, Math.round((x / w) * visibleBins)));
    const val = freqData ? freqData[bin] : cur.val;
    const y = hSpec - ((val / 255.0) * (hSpec - 12));

    spectrumCtx.fillStyle = color;
    spectrumCtx.beginPath();
    spectrumCtx.arc(x, y, isSelected ? 6 : 4.5, 0, Math.PI * 2);
    spectrumCtx.fill();
    spectrumCtx.strokeStyle = '#ffffff';
    spectrumCtx.lineWidth = 1.5;
    spectrumCtx.stroke();

    const label = `C${id}: ${cur.freq.toFixed(1)} Hz`;
    spectrumCtx.font = `${isSelected ? 'bold' : 'normal'} 10px monospace`;
    const textWidth = spectrumCtx.measureText(label).width;
    const labelX = Math.max(5, Math.min(w - textWidth - 14, x + (id % 2 === 1 ? -textWidth - 12 : 8)));
    const labelY = Math.max(20, Math.min(hSpec - 15, y - 8));

    spectrumCtx.fillStyle = color;
    spectrumCtx.fillRect(labelX - 4, labelY - 11, textWidth + 8, 16);
    spectrumCtx.fillStyle = textColor;
    spectrumCtx.fillText(label, labelX, labelY);
}

// -------------------------------------------------------------
// EVENTOS DE INTERACCIÓN TOOLTIP
// -------------------------------------------------------------
spectrumCanvas.addEventListener('mousemove', (e) => {
    const rect = spectrumCanvas.getBoundingClientRect();
    hoverX = e.clientX - rect.left;
    hoverY = e.clientY - rect.top;

    const w = spectrumCanvas.width;
    const maxFreq = calculateMaxFrequency();
    const freqAtCursor = (hoverX / w) * maxFreq;

    spectrumTooltip.style.display = 'block';
    spectrumTooltip.style.left = `${hoverX}px`;
    spectrumTooltip.style.top = `${hoverY}px`;
    spectrumTooltip.textContent = `${freqAtCursor.toFixed(1)} Hz | ${frequencyToNote(freqAtCursor)}`;
});

spectrumCanvas.addEventListener('mouseleave', () => {
    hoverX = -1;
    hoverY = -1;
    spectrumTooltip.style.display = 'none';
});

// Inicialización de cursores y canvases
renderCursorPills();
resizeCanvases();
render();