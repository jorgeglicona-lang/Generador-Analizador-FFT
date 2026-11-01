// =============================================================
// DISEÑADOR DE ONDAS & SINTETIZADOR DE FOURIER
// Laboratorio de Ondas Mecánicas & Acústica
// Soporte de Dibujo Manual y Funciones Matemáticas f(t)
// =============================================================

const SAMPLES = 512;
const HARMONICS_COUNT = 32;

// Vector de muestras del ciclo único de onda (-1.0 a +1.0)
let waveSamples = new Float32Array(SAMPLES);
let isDrawing = false;
let lastDrawIndex = -1;
let lastDrawVal = 0;
let currentMode = 'draw'; // 'draw' o 'function'

// Variables de Web Audio
let audioCtx = null;
let oscillator = null;
let gainNode = null;
let isPlaying = false;

// Referencias del DOM
const tabModeDraw = document.getElementById('tabModeDraw');
const tabModeFunction = document.getElementById('tabModeFunction');
const drawControlsPanel = document.getElementById('drawControlsPanel');
const functionControlsPanel = document.getElementById('functionControlsPanel');

const functionInput = document.getElementById('functionInput');
const btnApplyFunction = document.getElementById('btnApplyFunction');
const functionError = document.getElementById('functionError');

const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d');

const multiCycleCanvas = document.getElementById('multiCycleCanvas');
const multiCycleCtx = multiCycleCanvas.getContext('2d');

const harmonicsCanvas = document.getElementById('harmonicsCanvas');
const harmonicsCtx = harmonicsCanvas.getContext('2d');

const btnPlayWave = document.getElementById('btnPlayWave');
const btnStopWave = document.getElementById('btnStopWave');
const playFreqSlider = document.getElementById('playFreqSlider');
const playFreqInput = document.getElementById('playFreqInput');
const playVolumeSlider = document.getElementById('playVolumeSlider');
const playVolumeValue = document.getElementById('playVolumeValue');

const btnToggleDark = document.getElementById('btnToggleDark');
const darkIcon = document.getElementById('darkIcon');

// -------------------------------------------------------------
// GESTIÓN DE PESTAÑAS (DIBUJAR A MANO VS POR FUNCIÓN)
// -------------------------------------------------------------
function setMode(mode) {
    currentMode = mode;
    if (mode === 'draw') {
        tabModeDraw.className = "px-4 py-2 text-xs sm:text-sm font-bold rounded-lg border-2 border-[#1625f9] bg-blue-50 dark:bg-blue-950/60 text-[#1625f9] dark:text-[#16f9ad] transition-all flex items-center gap-1.5 shadow-sm";
        tabModeFunction.className = "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5";
        drawControlsPanel.classList.remove('hidden');
        functionControlsPanel.classList.add('hidden');
    } else {
        tabModeFunction.className = "px-4 py-2 text-xs sm:text-sm font-bold rounded-lg border-2 border-[#1625f9] bg-blue-50 dark:bg-blue-950/60 text-[#1625f9] dark:text-[#16f9ad] transition-all flex items-center gap-1.5 shadow-sm";
        tabModeDraw.className = "px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center gap-1.5";
        drawControlsPanel.classList.add('hidden');
        functionControlsPanel.classList.remove('hidden');
        evaluateAndApplyFunction();
    }
}

tabModeDraw.addEventListener('click', () => setMode('draw'));
tabModeFunction.addEventListener('click', () => setMode('function'));

// -------------------------------------------------------------
// EVALUADOR SEGURO DE FUNCIONES MATEMÁTICAS f(t)
// -------------------------------------------------------------
function compileExpression(expr) {
    let sanitized = expr.toLowerCase();
    sanitized = sanitized.replace(/\^/g, '**');
    sanitized = sanitized.replace(/\bpi\b/g, 'Math.PI');
    sanitized = sanitized.replace(/\bsin\b/g, 'Math.sin');
    sanitized = sanitized.replace(/\bcos\b/g, 'Math.cos');
    sanitized = sanitized.replace(/\btan\b/g, 'Math.tan');
    sanitized = sanitized.replace(/\babs\b/g, 'Math.abs');
    sanitized = sanitized.replace(/\bexp\b/g, 'Math.exp');
    sanitized = sanitized.replace(/\bsqrt\b/g, 'Math.sqrt');
    sanitized = sanitized.replace(/\bpow\b/g, 'Math.pow');
    sanitized = sanitized.replace(/\bsign\b/g, 'Math.sign');

    // Función segura con scope Math
    return new Function('t', 'Math', `
        try {
            return (${sanitized});
        } catch(e) {
            return NaN;
        }
    `);
}

function evaluateAndApplyFunction() {
    const rawExpr = functionInput.value.trim();
    if (!rawExpr) return;

    try {
        const fn = compileExpression(rawExpr);
        const temp = new Float32Array(SAMPLES);
        let maxAbs = 0.0001;

        for (let i = 0; i < SAMPLES; i++) {
            const t = i / SAMPLES;
            let val = fn(t, Math);

            if (isNaN(val) || !isFinite(val)) {
                val = 0;
            }

            temp[i] = val;
            if (Math.abs(val) > maxAbs) {
                maxAbs = Math.abs(val);
            }
        }

        // Normalizar para que encaje limpiamente en el rango [-0.95, +0.95]
        const normFactor = maxAbs > 1.0 ? (0.95 / maxAbs) : (maxAbs < 0.2 ? 0.95 / maxAbs : 0.95);
        for (let i = 0; i < SAMPLES; i++) {
            waveSamples[i] = Math.max(-1.0, Math.min(1.0, temp[i] * normFactor));
        }

        functionError.classList.add('hidden');
        onWaveformChanged();

    } catch (err) {
        functionError.textContent = `Error en la expresión matemática: ${err.message}`;
        functionError.classList.remove('hidden');
    }
}

btnApplyFunction.addEventListener('click', evaluateAndApplyFunction);
functionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') evaluateAndApplyFunction();
});

// Presets de funciones matemáticas
document.querySelectorAll('.fn-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        functionInput.value = btn.dataset.expr;
        evaluateAndApplyFunction();
    });
});

// -------------------------------------------------------------
// GESTIÓN DE MODO OSCURO
// -------------------------------------------------------------
function updateDarkModeUI() {
    const isDark = document.documentElement.classList.contains('dark');
    darkIcon.textContent = isDark ? '☀️' : '🌙';
    redrawAll();
}

btnToggleDark.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateDarkModeUI();
});

// -------------------------------------------------------------
// PLANTILLAS MANUALES DE FORMAS DE ONDA
// -------------------------------------------------------------
function loadTemplate(type) {
    for (let i = 0; i < SAMPLES; i++) {
        const t = i / SAMPLES;
        switch (type) {
            case 'sine':
                waveSamples[i] = Math.sin(2 * Math.PI * t);
                break;
            case 'square':
                waveSamples[i] = t < 0.5 ? 0.85 : -0.85;
                break;
            case 'triangle':
                waveSamples[i] = t < 0.5 ? (4 * t - 1) : (3 - 4 * t);
                break;
            case 'sawtooth':
                waveSamples[i] = 2 * t - 1;
                break;
            case 'pulse':
                waveSamples[i] = t < 0.15 ? 0.9 : -0.2;
                break;
            case 'clear':
                waveSamples[i] = 0;
                break;
        }
    }
    onWaveformChanged();
}

document.querySelectorAll('.template-btn').forEach(btn => {
    btn.addEventListener('click', () => loadTemplate(btn.dataset.type));
});

document.getElementById('btnClearDraw').addEventListener('click', () => loadTemplate('clear'));

document.getElementById('btnSmooth').addEventListener('click', () => {
    const temp = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
        const prev = waveSamples[(i - 1 + SAMPLES) % SAMPLES];
        const curr = waveSamples[i];
        const next = waveSamples[(i + 1) % SAMPLES];
        temp[i] = 0.25 * prev + 0.5 * curr + 0.25 * next;
    }
    waveSamples = temp;
    onWaveformChanged();
});

// -------------------------------------------------------------
// INTERACCIÓN DE DIBUJO CON EL RATÓN / TOQUE
// -------------------------------------------------------------
function getCanvasPos(e) {
    const rect = drawCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const x = Math.max(0, Math.min(drawCanvas.width, clientX - rect.left));
    const y = Math.max(0, Math.min(drawCanvas.height, clientY - rect.top));

    const sampleIndex = Math.floor((x / drawCanvas.width) * SAMPLES);
    const val = 1.0 - (y / drawCanvas.height) * 2.0;

    return { index: Math.min(SAMPLES - 1, Math.max(0, sampleIndex)), val: Math.max(-1.0, Math.min(1.0, val)) };
}

function handleDrawMove(e) {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);

    if (lastDrawIndex === -1) {
        waveSamples[pos.index] = pos.val;
    } else {
        const startIndex = Math.min(lastDrawIndex, pos.index);
        const endIndex = Math.max(lastDrawIndex, pos.index);
        const startVal = lastDrawIndex < pos.index ? lastDrawVal : pos.val;
        const endVal = lastDrawIndex < pos.index ? pos.val : lastDrawVal;
        const count = endIndex - startIndex;

        if (count === 0) {
            waveSamples[pos.index] = pos.val;
        } else {
            for (let i = startIndex; i <= endIndex; i++) {
                const fraction = (i - startIndex) / count;
                waveSamples[i] = startVal + (endVal - startVal) * fraction;
            }
        }
    }

    lastDrawIndex = pos.index;
    lastDrawVal = pos.val;

    onWaveformChanged();
}

drawCanvas.addEventListener('mousedown', (e) => {
    isDrawing = true;
    lastDrawIndex = -1;
    handleDrawMove(e);
});

window.addEventListener('mousemove', handleDrawMove);

window.addEventListener('mouseup', () => {
    isDrawing = false;
    lastDrawIndex = -1;
});

drawCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    isDrawing = true;
    lastDrawIndex = -1;
    handleDrawMove(e);
}, { passive: false });

window.addEventListener('touchmove', (e) => {
    if (isDrawing) {
        e.preventDefault();
        handleDrawMove(e);
    }
}, { passive: false });

window.addEventListener('touchend', () => {
    isDrawing = false;
    lastDrawIndex = -1;
});

// -------------------------------------------------------------
// TRANSFORMADA DISCRETA DE FOURIER (SERIE DE FOURIER)
// -------------------------------------------------------------
function calculateFourierCoefficients() {
    const real = new Float32Array(HARMONICS_COUNT + 1);
    const imag = new Float32Array(HARMONICS_COUNT + 1);
    const magnitudes = new Float32Array(HARMONICS_COUNT + 1);

    real[0] = 0;
    imag[0] = 0;

    const twoOverN = 2.0 / SAMPLES;

    for (let n = 1; n <= HARMONICS_COUNT; n++) {
        let an = 0;
        let bn = 0;
        const angleStep = (2.0 * Math.PI * n) / SAMPLES;

        for (let k = 0; k < SAMPLES; k++) {
            const angle = angleStep * k;
            an += waveSamples[k] * Math.cos(angle);
            bn += waveSamples[k] * Math.sin(angle);
        }

        real[n] = an * twoOverN;
        imag[n] = bn * twoOverN;
        magnitudes[n] = Math.sqrt(real[n] * real[n] + imag[n] * imag[n]);
    }

    return { real, imag, magnitudes };
}

function onWaveformChanged() {
    redrawAll();
    if (isPlaying && audioCtx && oscillator) {
        updateAudioWave();
    }
}

// -------------------------------------------------------------
// SÍNTESIS DE AUDIO (Web Audio API)
// -------------------------------------------------------------
async function initAudio() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(parseFloat(playVolumeSlider.value) / 100, audioCtx.currentTime);
        gainNode.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
    }
}

function updateAudioWave() {
    if (!audioCtx || !oscillator) return;

    const { real, imag } = calculateFourierCoefficients();

    let hasEnergy = false;
    for (let n = 1; n <= HARMONICS_COUNT; n++) {
        if (Math.abs(real[n]) > 0.0001 || Math.abs(imag[n]) > 0.0001) {
            hasEnergy = true;
            break;
        }
    }

    if (!hasEnergy) {
        real[1] = 0.0001;
    }

    try {
        const customWave = audioCtx.createPeriodicWave(real, imag, { disableNormalization: false });
        oscillator.setPeriodicWave(customWave);
    } catch (err) {
        console.error("Error al actualizar la onda periódica:", err);
    }
}

btnPlayWave.addEventListener('click', async () => {
    await initAudio();

    if (oscillator) {
        try { oscillator.stop(); } catch(e) {}
        oscillator.disconnect();
    }

    oscillator = audioCtx.createOscillator();
    oscillator.frequency.setValueAtTime(parseFloat(playFreqInput.value) || 440, audioCtx.currentTime);

    updateAudioWave();
    oscillator.connect(gainNode);

    const targetGain = parseFloat(playVolumeSlider.value) / 100;
    gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(Math.max(0.001, targetGain), audioCtx.currentTime + 0.04);

    oscillator.start();
    isPlaying = true;

    btnPlayWave.disabled = true;
    btnPlayWave.classList.add('opacity-50', 'cursor-not-allowed');
    btnStopWave.disabled = false;
    btnStopWave.classList.remove('bg-slate-200', 'dark:bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
    btnStopWave.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white');
});

btnStopWave.addEventListener('click', () => {
    if (oscillator && audioCtx) {
        gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.04);
        setTimeout(() => {
            if (oscillator) {
                try { oscillator.stop(); } catch(e) {}
                oscillator.disconnect();
                oscillator = null;
            }
        }, 50);
    }

    isPlaying = false;
    btnPlayWave.disabled = false;
    btnPlayWave.classList.remove('opacity-50', 'cursor-not-allowed');
    btnStopWave.disabled = true;
    btnStopWave.classList.remove('bg-red-500', 'hover:bg-red-600', 'text-white');
    btnStopWave.classList.add('bg-slate-200', 'dark:bg-slate-800', 'text-slate-400', 'cursor-not-allowed');
});

function setPlaybackFrequency(f) {
    let num = parseFloat(f);
    if (isNaN(num)) return;
    num = Math.max(50, Math.min(2000, num));

    playFreqSlider.value = num <= 1500 ? num : 1500;
    playFreqInput.value = Math.round(num);

    if (oscillator && audioCtx) {
        oscillator.frequency.setTargetAtTime(num, audioCtx.currentTime, 0.01);
    }
}

playFreqSlider.addEventListener('input', (e) => setPlaybackFrequency(e.target.value));
playFreqInput.addEventListener('input', (e) => setPlaybackFrequency(e.target.value));

document.querySelectorAll('.freq-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => setPlaybackFrequency(btn.dataset.freq));
});

playVolumeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    playVolumeValue.textContent = `${val}%`;
    if (gainNode && audioCtx) {
        gainNode.gain.setTargetAtTime(val / 100, audioCtx.currentTime, 0.01);
    }
});

// -------------------------------------------------------------
// DIBUJADO DE GRÁFICOS Y CANVASES
// -------------------------------------------------------------
function resizeCanvases() {
    const drawW = drawCanvas.parentElement.clientWidth;
    if (drawW <= 0) return;

    drawCanvas.width = drawW;
    drawCanvas.height = 220;

    multiCycleCanvas.width = multiCycleCanvas.parentElement.clientWidth;
    multiCycleCanvas.height = 140;

    harmonicsCanvas.width = harmonicsCanvas.parentElement.clientWidth;
    harmonicsCanvas.height = 180;

    redrawAll();
}

window.addEventListener('resize', resizeCanvases);

function redrawAll() {
    drawCycleCanvas();
    drawMultiCycle();
    drawHarmonics();
}

// 1. LIENZO PRINCIPAL (1 CICLO)
function drawCycleCanvas() {
    const w = drawCanvas.width;
    const h = drawCanvas.height;
    const isDark = document.documentElement.classList.contains('dark');

    drawCtx.fillStyle = isDark ? '#090d16' : '#ffffff';
    drawCtx.fillRect(0, 0, w, h);

    drawCtx.strokeStyle = isDark ? '#1e293b' : '#f1f5f9';
    drawCtx.lineWidth = 1;
    drawCtx.beginPath();
    for (let i = 1; i < 8; i++) {
        drawCtx.moveTo(0, (h / 8) * i);
        drawCtx.lineTo(w, (h / 8) * i);
    }
    for (let i = 1; i < 16; i++) {
        drawCtx.moveTo((w / 16) * i, 0);
        drawCtx.lineTo((w / 16) * i, h);
    }
    drawCtx.stroke();

    // Línea central cero
    drawCtx.strokeStyle = isDark ? '#334155' : '#cbd5e1';
    drawCtx.lineWidth = 1.5;
    drawCtx.beginPath();
    drawCtx.moveTo(0, h / 2);
    drawCtx.lineTo(w, h / 2);
    drawCtx.stroke();

    // Etiquetas
    drawCtx.fillStyle = isDark ? '#64748b' : '#94a3b8';
    drawCtx.font = '10px monospace';
    drawCtx.fillText('+1.0', 6, 14);
    drawCtx.fillText(' 0.0', 6, h / 2 - 4);
    drawCtx.fillText('-1.0', 6, h - 6);

    // Área bajo la curva
    drawCtx.beginPath();
    drawCtx.moveTo(0, h / 2);
    for (let i = 0; i < SAMPLES; i++) {
        const x = (i / (SAMPLES - 1)) * w;
        const y = (1.0 - waveSamples[i]) * 0.5 * h;
        drawCtx.lineTo(x, y);
    }
    drawCtx.lineTo(w, h / 2);
    drawCtx.closePath();
    drawCtx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.12)' : 'rgba(22, 37, 249, 0.08)';
    drawCtx.fill();

    // Trazo de la onda
    drawCtx.beginPath();
    drawCtx.lineWidth = 3;
    drawCtx.strokeStyle = isDark ? '#38bdf8' : '#1625f9';
    for (let i = 0; i < SAMPLES; i++) {
        const x = (i / (SAMPLES - 1)) * w;
        const y = (1.0 - waveSamples[i]) * 0.5 * h;
        if (i === 0) drawCtx.moveTo(x, y);
        else drawCtx.lineTo(x, y);
    }
    drawCtx.stroke();
}

// 2. PREVISUALIZACIÓN MULTI-CICLO (3 CICLOS)
function drawMultiCycle() {
    const w = multiCycleCanvas.width;
    const h = multiCycleCanvas.height;

    multiCycleCtx.fillStyle = '#020617';
    multiCycleCtx.fillRect(0, 0, w, h);

    multiCycleCtx.strokeStyle = '#1e293b';
    multiCycleCtx.lineWidth = 1;
    multiCycleCtx.beginPath();
    for (let i = 1; i < 4; i++) {
        multiCycleCtx.moveTo(0, (h / 4) * i);
        multiCycleCtx.lineTo(w, (h / 4) * i);
    }
    for (let i = 1; i <= 3; i++) {
        multiCycleCtx.moveTo((w / 3) * i, 0);
        multiCycleCtx.lineTo((w / 3) * i, h);
    }
    multiCycleCtx.stroke();

    multiCycleCtx.strokeStyle = '#16f9ad';
    multiCycleCtx.lineWidth = 2;
    multiCycleCtx.beginPath();

    const totalSamples = SAMPLES * 3;
    for (let k = 0; k < totalSamples; k++) {
        const sampleVal = waveSamples[k % SAMPLES];
        const x = (k / (totalSamples - 1)) * w;
        const y = (1.0 - sampleVal * 0.85) * 0.5 * h;
        if (k === 0) multiCycleCtx.moveTo(x, y);
        else multiCycleCtx.lineTo(x, y);
    }
    multiCycleCtx.stroke();
}

// 3. GRÁFICO DE ARMÓNICOS (FOURIER)
function drawHarmonics() {
    const w = harmonicsCanvas.width;
    const h = harmonicsCanvas.height;
    const isDark = document.documentElement.classList.contains('dark');

    harmonicsCtx.fillStyle = isDark ? '#090d16' : '#ffffff';
    harmonicsCtx.fillRect(0, 0, w, h);

    harmonicsCtx.strokeStyle = isDark ? '#1e293b' : '#f1f5f9';
    harmonicsCtx.lineWidth = 1;
    harmonicsCtx.beginPath();
    for (let i = 1; i < 5; i++) {
        harmonicsCtx.moveTo(0, (h / 5) * i);
        harmonicsCtx.lineTo(w, (h / 5) * i);
    }
    harmonicsCtx.stroke();

    const { magnitudes } = calculateFourierCoefficients();

    let maxMag = 0.0001;
    for (let n = 1; n <= HARMONICS_COUNT; n++) {
        if (magnitudes[n] > maxMag) maxMag = magnitudes[n];
    }

    const barWidth = (w / HARMONICS_COUNT);

    for (let n = 1; n <= HARMONICS_COUNT; n++) {
        const normalized = magnitudes[n] / maxMag;
        const barHeight = normalized * (h - 30);
        const x = (n - 1) * barWidth + 2;
        const y = h - 20 - barHeight;

        harmonicsCtx.fillStyle = isDark ? (n === 1 ? '#16f9ad' : '#38bdf8') : (n === 1 ? '#059669' : '#1625f9');
        harmonicsCtx.fillRect(x, y, barWidth - 4, barHeight);

        if (n <= 16 || n % 2 === 0) {
            harmonicsCtx.fillStyle = isDark ? '#94a3b8' : '#64748b';
            harmonicsCtx.font = '9px monospace';
            harmonicsCtx.textAlign = 'center';
            harmonicsCtx.fillText(`${n}`, x + (barWidth - 4) / 2, h - 6);
        }
    }
    harmonicsCtx.textAlign = 'left';
}

// Cargar onda inicial y arrancar
loadTemplate('sine');
resizeCanvases();
updateDarkModeUI();
