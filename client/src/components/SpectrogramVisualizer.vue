<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';

const { audio } = usePlayer();
const { accentColor } = useAccentColor();

const PREFS_KEY = 'noisling_player';
function loadVizPrefs() {
  try { return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (_) { return {}; }
}
function saveVizPref(key, value) {
  let prefs = loadVizPrefs();
  prefs[key] = value;
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

const _prefs = loadVizPrefs();

const containerRef = ref(null);
const canvasRef = ref(null);
const isFullscreen = ref(false);
const vizMode = ref(_prefs.vizMode ?? 'spiral'); // 'spiral' | 'wave' | 'particles' | 'polar' | 'bubbles'
const showBubbles = ref(_prefs.showBubbles ?? true);
const showModeDropdown = ref(false);
const randomizeOnNewSong = ref(_prefs.randomizeOnNewSong ?? false);

watch(vizMode, v => saveVizPref('vizMode', v));
watch(showBubbles, v => saveVizPref('showBubbles', v));
watch(randomizeOnNewSong, v => saveVizPref('randomizeOnNewSong', v));
let animId = null;

const vizModes = [
  { value: 'spiral',    label: 'Spiral',       icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 4 19.3M12 2a10 10 0 0 0-4 19.3"/>' },
  { value: 'wave',      label: 'Lissajous',    icon: '<path d="M4,12 C4,8 8,8 12,12 C16,16 20,16 20,12 C20,8 16,8 12,12 C8,16 4,16 4,12"/>' },
  { value: 'particles', label: 'Particles',    icon: '<circle cx="12" cy="4" r="1.5" fill="currentColor" stroke="none"/><circle cx="20" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="20" r="1.5" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="2"/>' },
  { value: 'polar',     label: 'Polar',        icon: '<path stroke-linecap="round" d="M12 2v4M12 18v4M2 12h4M18 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/>' },
  { value: 'spectrum',  label: 'Equalizer',    icon: '<path d="M4 20V8M8 20V4M12 20V10M16 20V6M20 20V12" stroke-linecap="round"/>' },
  { value: 'bubbles',   label: 'Bubbles only', icon: '<circle cx="7" cy="15" r="3"/><circle cx="15" cy="9" r="2"/><circle cx="17" cy="17" r="1.5"/>' },
];

function ensureAudioContext() {
  if (audio._vizCtx) return audio._vizCtx;
  const ctx = new AudioContext();
  const src = ctx.createMediaElementSource(audio);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.75;
  src.connect(analyser);
  analyser.connect(ctx.destination);
  audio._vizCtx = { ctx, analyser };
  return audio._vizCtx;
}

function getColor() {
  if (accentColor.value) {
    const parts = accentColor.value.split(',').map(Number);
    if (parts.length === 3) return parts;
  }
  return [52, 211, 153];
}

function getColorPalette() {
  const [r, g, b] = getColor();
  return [
    [r, g, b],
    [Math.min(255, r + 80), Math.max(0, g - 40), Math.min(255, b + 30)],
    [Math.max(0, r - 40), Math.min(255, g + 50), Math.min(255, b + 80)],
    [Math.min(255, r + 40), Math.min(255, g + 30), Math.max(0, b - 50)],
    [Math.max(0, r - 60), Math.max(0, g - 20), Math.min(255, b + 60)],
  ];
}

// Blobs
const blobs = [
  { phase: 0,    speed: 0.4,  orbitX: 0.28, orbitY: 0.22, band: 'bass',  baseSize: 0.45 },
  { phase: 1.2,  speed: 0.3,  orbitX: 0.32, orbitY: 0.28, band: 'bass',  baseSize: 0.4  },
  { phase: 2.5,  speed: 0.45, orbitX: 0.22, orbitY: 0.32, band: 'mid',   baseSize: 0.35 },
  { phase: 3.8,  speed: 0.35, orbitX: 0.38, orbitY: 0.18, band: 'mid',   baseSize: 0.3  },
  { phase: 5.0,  speed: 0.5,  orbitX: 0.18, orbitY: 0.38, band: 'high',  baseSize: 0.25 },
  { phase: 0.7,  speed: 0.25, orbitX: 0.3,  orbitY: 0.3,  band: 'bass',  baseSize: 0.5  },
  { phase: 4.2,  speed: 0.42, orbitX: 0.25, orbitY: 0.2,  band: 'high',  baseSize: 0.22 },
];

let smoothBass = 0;
let smoothMid = 0;
let smoothHigh = 0;
let prevBass = 0;      // for transient detection
let beatBoost = 0;     // 0–1, decays after a detected transient
let spiralAngle = 2.44;
let spiralDir = true;
let time = 0;
let vizCtx = null;
let particlePool = null;
let pendingModeSwitch = false;
let shuffleBag = [];

function onNewSong() {
  if (!randomizeOnNewSong.value) return;
  // Just flag that a switch is pending — the actual mode is picked at apply time
  // so it's always guaranteed to differ from whatever mode is active then
  pendingModeSwitch = true;
}

function selectMode(mode) {
  vizMode.value = mode;
  showModeDropdown.value = false;
  const canvas = canvasRef.value;
  if (canvas) {
    const c = canvas.getContext('2d');
    c.fillStyle = 'rgb(9, 9, 11)';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }
}


function toggleBubbles() {
  if (showBubbles.value && vizMode.value === 'bubbles') {
    // Turning off bubbles while in bubbles-only mode would show nothing — switch to spiral first
    vizMode.value = 'spiral';
  }
  showBubbles.value = !showBubbles.value;
}

function toggleFullscreen() {
  if (!containerRef.value) return;
  if (!document.fullscreenElement) {
    containerRef.value.requestFullscreen();
  } else {
    document.exitFullscreen();
  }
}

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

function setupCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return null;
  const c = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    c.scale(dpr, dpr);
  }
  return { c, w: rect.width, h: rect.height };
}

function drawBars() {
  const canvas = canvasRef.value;
  const analyser = vizCtx?.analyser;
  if (!canvas || !analyser) { animId = requestAnimationFrame(draw); return; }

  const setup = setupCanvas();
  if (!setup) { animId = requestAnimationFrame(draw); return; }
  const { c, w, h } = setup;
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  const floatTimeData = new Float32Array(analyser.fftSize);
  analyser.getByteFrequencyData(freqData);
  analyser.getFloatTimeDomainData(floatTimeData);

  const bufLen = freqData.length;
  const third = Math.floor(bufLen / 3);

  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < third; i++) bass += freqData[i];
  for (let i = third; i < third * 2; i++) mid += freqData[i];
  for (let i = third * 2; i < bufLen; i++) high += freqData[i];
  bass = bass / third / 255;
  mid = mid / third / 255;
  high = high / (bufLen - third * 2) / 255;

  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  updateBeatBoost(bass);

  const energy = (smoothBass + smoothMid + smoothHigh) / 3;

  c.fillStyle = `rgba(9, 9, 11, ${0.12 + (1 - energy) * 0.18})`;
  c.fillRect(0, 0, w, h);

  if (energy < 0.0002) { animId = requestAnimationFrame(draw); return; }

  // Soft gate: smoothly ramp alpha to 0 as energy fades below threshold
  const gateFactor = Math.min(1, energy / 0.018);

  time += 0.008;

  const palette = getColorPalette();
  const [pr, pg, pb] = palette[0];

  // ── Layer 1: Gradient blobs ──
  if (showBubbles.value) {
    c.globalCompositeOperation = 'screen';

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const [r, g, b] = palette[i % palette.length];

      let bandVal;
      if (blob.band === 'bass') bandVal = smoothBass;
      else if (blob.band === 'mid') bandVal = smoothMid;
      else bandVal = smoothHigh;

      const t = time * blob.speed + blob.phase;
      const blobX = cx + Math.sin(t) * w * blob.orbitX + Math.cos(t * 0.7) * w * 0.1;
      const blobY = cy + Math.cos(t) * h * blob.orbitY + Math.sin(t * 0.6) * h * 0.08;

      const radius = minDim * blob.baseSize * (0.1 + bandVal * 1.6);
      if (radius < 2) continue;

      const grad = c.createRadialGradient(blobX, blobY, 0, blobX, blobY, radius);
      const alpha = (0.1 + bandVal * 0.22) * gateFactor;
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      c.fillStyle = grad;
      c.fillRect(blobX - radius, blobY - radius, radius * 2, radius * 2);
    }

    c.globalCompositeOperation = 'source-over';
  }

  if (vizMode.value === 'bubbles') { animId = requestAnimationFrame(draw); return; }

  // ── Layer 2: Lissajous ──
  // Bass drives X amplitude, mids drive Y, highs nudge the phase; beat boost expands both
  const ampX = minDim * 0.22 * (0.15 + smoothBass * 1.5 + beatBoost * 0.4);
  const ampY = minDim * 0.22 * (0.15 + smoothMid * 1.5 + beatBoost * 0.25);
  const delta = time * 1.5 + smoothHigh * 3.0;

  const numLissPts = 512;
  const lissPts = [];
  for (let i = 0; i <= numLissPts; i++) {
    const t = (i / numLissPts) * Math.PI * 2;
    const audioIdx = Math.floor((i / numLissPts) * analyser.fftSize);
    const nudge = (floatTimeData[audioIdx] || 0) * minDim * 0.04 * energy;
    lissPts.push({
      x: cx + Math.sin(2 * t + delta) * ampX + nudge,
      y: cy + Math.sin(3 * t)         * ampY + nudge,
    });
  }

  const lissAlpha = (0.10 + energy * 0.42) * gateFactor;

  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // Wide glow
  c.beginPath();
  for (let i = 0; i <= numLissPts; i++) {
    if (i === 0) c.moveTo(lissPts[i].x, lissPts[i].y);
    else c.lineTo(lissPts[i].x, lissPts[i].y);
  }
  c.strokeStyle = `rgba(${pr},${pg},${pb},${lissAlpha * 0.06})`;
  c.lineWidth = 14;
  c.stroke();

  // Medium glow
  c.beginPath();
  for (let i = 0; i <= numLissPts; i++) {
    if (i === 0) c.moveTo(lissPts[i].x, lissPts[i].y);
    else c.lineTo(lissPts[i].x, lissPts[i].y);
  }
  c.strokeStyle = `rgba(${pr},${pg},${pb},${lissAlpha * 0.22})`;
  c.lineWidth = 4;
  c.stroke();

  // Core line
  c.beginPath();
  for (let i = 0; i <= numLissPts; i++) {
    if (i === 0) c.moveTo(lissPts[i].x, lissPts[i].y);
    else c.lineTo(lissPts[i].x, lissPts[i].y);
  }
  c.strokeStyle = `rgba(${pr},${pg},${pb},${lissAlpha})`;
  c.lineWidth = 1.5;
  c.stroke();

  c.globalCompositeOperation = 'source-over';

  animId = requestAnimationFrame(draw);
}

function initParticles() {
  particlePool = Array.from({ length: 120 }, (_, i) => ({
    angle: (i / 120) * Math.PI * 2,
    baseRadius: 0.08 + Math.random() * 0.22,
    speed: (0.005 + Math.random() * 0.012) * (Math.random() < 0.5 ? 1 : -1),
    size: 0.8 + Math.random() * 3,
    colorIdx: i % 5,
    phase: Math.random() * Math.PI * 2,
    orbitVariance: 0.03 + Math.random() * 0.07,
    // per-particle personality
    opacity: 0.12 + Math.random() * Math.random(), // skewed toward dim
    glowScale: 2 + Math.random() * 7,              // tight sparkle → wide soft halo
    twinkleAmt: Math.random() * 0.4,               // 0 = steady, 0.4 = shimmer
    twinkleSpeed: 0.8 + Math.random() * 2.5,
  }));
}

function drawParticles() {
  const canvas = canvasRef.value;
  const analyser = vizCtx?.analyser;
  if (!canvas || !analyser) { animId = requestAnimationFrame(draw); return; }
  if (!particlePool) initParticles();

  const setup = setupCanvas();
  if (!setup) { animId = requestAnimationFrame(draw); return; }
  const { c, w, h } = setup;
  const cx = w / 2, cy = h / 2, minDim = Math.min(w, h);

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);
  const bufLen = freqData.length, third = Math.floor(bufLen / 3);
  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < third; i++) bass += freqData[i];
  for (let i = third; i < third * 2; i++) mid += freqData[i];
  for (let i = third * 2; i < bufLen; i++) high += freqData[i];
  bass = bass / third / 255;
  mid = mid / third / 255;
  high = high / (bufLen - third * 2) / 255;
  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  updateBeatBoost(bass);
  const energy = (smoothBass + smoothMid + smoothHigh) / 3;

  c.fillStyle = `rgba(9, 9, 11, ${0.14 + (1 - energy) * 0.16})`;
  c.fillRect(0, 0, w, h);
  if (energy < 0.0002) { animId = requestAnimationFrame(draw); return; }
  const gateFactor = Math.min(1, energy / 0.018);
  time += 0.008;

  const palette = getColorPalette();

  if (showBubbles.value) {
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const [r, g, b] = palette[i % palette.length];
      const bandVal = blob.band === 'bass' ? smoothBass : blob.band === 'mid' ? smoothMid : smoothHigh;
      const t = time * blob.speed + blob.phase;
      const blobX = cx + Math.sin(t) * w * blob.orbitX + Math.cos(t * 0.7) * w * 0.1;
      const blobY = cy + Math.cos(t) * h * blob.orbitY + Math.sin(t * 0.6) * h * 0.08;
      const radius = minDim * blob.baseSize * (0.1 + bandVal * 1.6);
      if (radius < 2) continue;
      const grad = c.createRadialGradient(blobX, blobY, 0, blobX, blobY, radius);
      const alpha = (0.1 + bandVal * 0.22) * gateFactor;
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(blobX - radius, blobY - radius, radius * 2, radius * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  c.globalCompositeOperation = 'lighter';
  for (const p of particlePool) {
    p.angle += p.speed * (1 + smoothHigh * 4);
    const pulse = Math.sin(p.phase + time * 2.5) * p.orbitVariance;
    const orbitR = minDim * (p.baseRadius + smoothBass * 0.15 + pulse);
    const x = cx + Math.cos(p.angle) * orbitR;
    const y = cy + Math.sin(p.angle) * orbitR;
    const dotSize = p.size * (1 + smoothMid * 2.5) * gateFactor;
    if (dotSize < 0.2) continue;
    const [pr, pg, pb] = palette[p.colorIdx];
    const twinkle = 1 + Math.sin(p.phase + time * p.twinkleSpeed) * p.twinkleAmt;
    const alpha = (0.45 + smoothMid * 0.55) * gateFactor * p.opacity * twinkle;
    if (alpha < 0.01) continue;
    const glowR = dotSize * p.glowScale;
    // diffuse glow: larger halos get proportionally dimmer at center
    const glowPeak = alpha * 0.35 * (3.5 / p.glowScale);
    const glow = c.createRadialGradient(x, y, 0, x, y, glowR);
    glow.addColorStop(0, `rgba(${pr},${pg},${pb},${glowPeak})`);
    glow.addColorStop(1, `rgba(${pr},${pg},${pb},0)`);
    c.fillStyle = glow;
    c.beginPath();
    c.arc(x, y, glowR, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = `rgba(${pr},${pg},${pb},${alpha})`;
    c.beginPath();
    c.arc(x, y, dotSize, 0, Math.PI * 2);
    c.fill();
  }
  c.globalCompositeOperation = 'source-over';
  animId = requestAnimationFrame(draw);
}

function drawPolar() {
  const canvas = canvasRef.value;
  const analyser = vizCtx?.analyser;
  if (!canvas || !analyser) { animId = requestAnimationFrame(draw); return; }

  const setup = setupCanvas();
  if (!setup) { animId = requestAnimationFrame(draw); return; }
  const { c, w, h } = setup;
  const cx = w / 2, cy = h / 2, minDim = Math.min(w, h);

  const bufferLength = analyser.fftSize;
  const floatTimeData = new Float32Array(bufferLength);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getFloatTimeDomainData(floatTimeData);
  analyser.getByteFrequencyData(freqData);
  const bufLen = freqData.length, third = Math.floor(bufLen / 3);
  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < third; i++) bass += freqData[i];
  for (let i = third; i < third * 2; i++) mid += freqData[i];
  for (let i = third * 2; i < bufLen; i++) high += freqData[i];
  bass = bass / third / 255;
  mid = mid / third / 255;
  high = high / (bufLen - third * 2) / 255;
  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  updateBeatBoost(bass);
  const energy = (smoothBass + smoothMid + smoothHigh) / 3;

  c.fillStyle = `rgba(9, 9, 11, ${0.10 + (1 - energy) * 0.18})`;
  c.fillRect(0, 0, w, h);
  if (energy < 0.0002) { animId = requestAnimationFrame(draw); return; }
  const gateFactor = Math.min(1, energy / 0.018);
  time += 0.008;

  const palette = getColorPalette();
  const [pr, pg, pb] = palette[0];

  if (showBubbles.value) {
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const [r, g, b] = palette[i % palette.length];
      const bandVal = blob.band === 'bass' ? smoothBass : blob.band === 'mid' ? smoothMid : smoothHigh;
      const t = time * blob.speed + blob.phase;
      const blobX = cx + Math.sin(t) * w * blob.orbitX + Math.cos(t * 0.7) * w * 0.1;
      const blobY = cy + Math.cos(t) * h * blob.orbitY + Math.sin(t * 0.6) * h * 0.08;
      const radius = minDim * blob.baseSize * (0.1 + bandVal * 1.6);
      if (radius < 2) continue;
      const grad = c.createRadialGradient(blobX, blobY, 0, blobX, blobY, radius);
      const alpha = (0.1 + bandVal * 0.22) * gateFactor;
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(blobX - radius, blobY - radius, radius * 2, radius * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // Polar mandala — 6-fold mirrored symmetry
  const SYMMETRY = 6;
  const numPts = 256;
  const baseR = minDim * (0.10 + smoothBass * 0.06);
  const amplitude = minDim * 0.12 * (0.5 + energy * 0.8);
  const wedgeAngle = Math.PI / SYMMETRY;
  const rotation = time * 0.3;

  const radii = new Array(numPts + 1);
  for (let i = 0; i <= numPts; i++) {
    const audioIdx = Math.floor((i / numPts) * (bufferLength / 2));
    radii[i] = baseR + (floatTimeData[audioIdx] || 0) * amplitude;
  }

  const alpha = (0.12 + energy * 0.5) * gateFactor;
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const strokeArms = () => {
    c.save();
    c.translate(cx, cy);
    for (let sym = 0; sym < SYMMETRY; sym++) {
      const symRot = (sym / SYMMETRY) * Math.PI * 2 + rotation;
      for (const mirror of [1, -1]) {
        c.save();
        c.rotate(symRot);
        c.scale(1, mirror);
        c.beginPath();
        for (let i = 0; i <= numPts; i++) {
          const angle = (i / numPts) * wedgeAngle;
          const x = Math.cos(angle) * radii[i];
          const y = Math.sin(angle) * radii[i];
          if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
        }
        c.stroke();
        c.restore();
      }
    }
    c.restore();
  };

  c.strokeStyle = `rgba(${pr},${pg},${pb},${alpha * 0.06})`;
  c.lineWidth = 14;
  strokeArms();
  c.strokeStyle = `rgba(${pr},${pg},${pb},${alpha * 0.20})`;
  c.lineWidth = 4;
  strokeArms();
  c.strokeStyle = `rgba(${pr},${pg},${pb},${alpha})`;
  c.lineWidth = 1.5;
  strokeArms();

  c.globalCompositeOperation = 'source-over';
  animId = requestAnimationFrame(draw);
}

// Detect bass transients and update beatBoost. Call once per frame after smoothBass is updated.
function updateBeatBoost(rawBass) {
  const drop = rawBass - prevBass;
  if (drop > 0.08) beatBoost = Math.min(1, beatBoost + drop * 4); // sharp rise → boost
  beatBoost *= 0.88; // exponential decay (~12 frames to halve)
  prevBass = rawBass;
}

function drawSpectrum() {
  const canvas = canvasRef.value;
  const analyser = vizCtx?.analyser;
  if (!canvas || !analyser) { animId = requestAnimationFrame(draw); return; }

  const setup = setupCanvas();
  if (!setup) { animId = requestAnimationFrame(draw); return; }
  const { c, w, h } = setup;

  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(freqData);
  const bufLen = freqData.length;
  const third = Math.floor(bufLen / 3);

  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < third; i++) bass += freqData[i];
  for (let i = third; i < third * 2; i++) mid += freqData[i];
  for (let i = third * 2; i < bufLen; i++) high += freqData[i];
  bass = bass / third / 255;
  mid = mid / third / 255;
  high = high / (bufLen - third * 2) / 255;

  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  updateBeatBoost(bass);

  const energy = (smoothBass + smoothMid + smoothHigh) / 3;

  // Faster fade for crisp bar edges
  c.fillStyle = `rgba(9, 9, 11, ${0.35 + (1 - energy) * 0.45})`;
  c.fillRect(0, 0, w, h);

  if (energy < 0.0002) { animId = requestAnimationFrame(draw); return; }
  const gateFactor = Math.min(1, energy / 0.018);

  time += 0.008;

  const palette = getColorPalette();
  const [pr, pg, pb] = palette[0];

  // Bubbles behind bars
  if (showBubbles.value) {
    c.globalCompositeOperation = 'screen';
    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const [r, g, b] = palette[i % palette.length];
      const bandVal = blob.band === 'bass' ? smoothBass : blob.band === 'mid' ? smoothMid : smoothHigh;
      const t = time * blob.speed + blob.phase;
      const blobX = (w / 2) + Math.sin(t) * w * blob.orbitX + Math.cos(t * 0.7) * w * 0.1;
      const blobY = (h / 2) + Math.cos(t) * h * blob.orbitY + Math.sin(t * 0.6) * h * 0.08;
      const minDim = Math.min(w, h);
      const radius = minDim * blob.baseSize * (0.1 + bandVal * 1.6);
      if (radius < 2) continue;
      const grad = c.createRadialGradient(blobX, blobY, 0, blobX, blobY, radius);
      const alpha = (0.06 + bandVal * 0.14) * gateFactor;
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      c.fillStyle = grad;
      c.fillRect(blobX - radius, blobY - radius, radius * 2, radius * 2);
    }
    c.globalCompositeOperation = 'source-over';
  }

  // Classic spectrum bars — logarithmically spaced bins
  const NUM_BARS = 64;
  const barGap = 2;
  const totalBarW = w - barGap;
  const barW = Math.max(2, totalBarW / NUM_BARS - barGap);
  const step = totalBarW / NUM_BARS;

  // Beat boost widens and brightens bars
  const boostH = 1 + beatBoost * 0.7;
  const maxBarH = h * 0.88 * boostH;

  c.globalCompositeOperation = 'lighter';

  for (let i = 0; i < NUM_BARS; i++) {
    // Logarithmic bin mapping: gives more bars to bass/mids like a real EQ
    const logMin = Math.log10(1);
    const logMax = Math.log10(bufLen * 0.8);
    const binIdx = Math.floor(Math.pow(10, logMin + (i / NUM_BARS) * (logMax - logMin)));
    const value = (freqData[Math.min(binIdx, bufLen - 1)] / 255) * gateFactor;

    const barH = value * maxBarH;
    if (barH < 1) continue;

    const x = i * step + barGap / 2;
    const y = h - barH;

    // Vertical gradient: dim at base, bright at peak
    const grad = c.createLinearGradient(x, h, x, y);
    const alpha = (0.5 + beatBoost * 0.5) * gateFactor;
    grad.addColorStop(0, `rgba(${pr},${pg},${pb},${alpha * 0.25})`);
    grad.addColorStop(0.6, `rgba(${pr},${pg},${pb},${alpha * 0.7})`);
    grad.addColorStop(1, `rgba(${pr},${pg},${pb},${alpha})`);

    // Glow pass
    c.fillStyle = `rgba(${pr},${pg},${pb},${alpha * 0.08})`;
    c.fillRect(x - barGap, y - 4, barW + barGap * 2, barH + 4);

    // Core bar
    c.fillStyle = grad;
    c.fillRect(x, y, barW, barH);

    // Peak cap — bright dot at top
    c.fillStyle = `rgba(${pr},${pg},${pb},${Math.min(1, alpha * 1.4)})`;
    c.fillRect(x, y, barW, Math.min(2, barH));
  }

  c.globalCompositeOperation = 'source-over';
  animId = requestAnimationFrame(draw);
}

function draw() {
  // Apply queued mode switch only once the current visualization has faded to silence
  if (pendingModeSwitch) {
    const currentEnergy = (smoothBass + smoothMid + smoothHigh) / 3;
    if (currentEnergy < 0.003) {
      pendingModeSwitch = false;
      if (shuffleBag.length === 0) {
        shuffleBag = vizModes
          .filter(m => m.value !== 'bubbles' && m.value !== vizMode.value)
          .map(m => m.value)
          .sort(() => Math.random() - 0.5);
      }
      if (shuffleBag.length) selectMode(shuffleBag.pop());
      animId = requestAnimationFrame(draw);
      return;
    }
  }

  if (vizMode.value === 'wave' || vizMode.value === 'bubbles') { drawBars(); return; }
  if (vizMode.value === 'particles') { drawParticles(); return; }
  if (vizMode.value === 'polar') { drawPolar(); return; }
  if (vizMode.value === 'spectrum') { drawSpectrum(); return; }

  const canvas = canvasRef.value;
  const analyser = vizCtx?.analyser;
  if (!canvas || !analyser) {
    animId = requestAnimationFrame(draw);
    return;
  }

  const setup = setupCanvas();
  if (!setup) { animId = requestAnimationFrame(draw); return; }
  const { c, w, h } = setup;
  const cx = w / 2;
  const cy = h / 2;
  const minDim = Math.min(w, h);

  // Get waveform + frequency data
  const bufferLength = analyser.fftSize;
  const floatTimeData = new Float32Array(bufferLength);
  const timeData = new Uint8Array(bufferLength);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getFloatTimeDomainData(floatTimeData);
  analyser.getByteTimeDomainData(timeData);
  analyser.getByteFrequencyData(freqData);

  const bufLen = freqData.length;
  const third = Math.floor(bufLen / 3);

  let bass = 0, mid = 0, high = 0;
  for (let i = 0; i < third; i++) bass += freqData[i];
  for (let i = third; i < third * 2; i++) mid += freqData[i];
  for (let i = third * 2; i < bufLen; i++) high += freqData[i];
  bass = bass / third / 255;
  mid = mid / third / 255;
  high = high / (bufLen - third * 2) / 255;

  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  updateBeatBoost(bass);

  const energy = (smoothBass + smoothMid + smoothHigh) / 3;

  // Fade — moderate trail
  c.fillStyle = `rgba(9, 9, 11, ${0.12 + (1 - energy) * 0.18})`;
  c.fillRect(0, 0, w, h);

  if (energy < 0.0002) {
    animId = requestAnimationFrame(draw);
    return;
  }

  // Soft gate: smoothly ramp alpha to 0 as energy fades below threshold
  const gateFactor = Math.min(1, energy / 0.018);

  time += 0.008;

  // Spiral morph — very slow rotation
  if (spiralDir) {
    spiralAngle += 0.0000015;
    if (spiralAngle >= 2.48) spiralDir = false;
  } else {
    spiralAngle -= 0.000002;
    if (spiralAngle <= 2.42) spiralDir = true;
  }

  const palette = getColorPalette();
  const [pr, pg, pb] = palette[0];

  // ── Layer 1: Gradient blobs (screen blended) ──
  if (showBubbles.value) {
    c.globalCompositeOperation = 'screen';

    for (let i = 0; i < blobs.length; i++) {
      const blob = blobs[i];
      const [r, g, b] = palette[i % palette.length];

      let bandVal;
      if (blob.band === 'bass') bandVal = smoothBass;
      else if (blob.band === 'mid') bandVal = smoothMid;
      else bandVal = smoothHigh;

      const t = time * blob.speed + blob.phase;
      const blobX = cx + Math.sin(t) * w * blob.orbitX + Math.cos(t * 0.7) * w * 0.1;
      const blobY = cy + Math.cos(t) * h * blob.orbitY + Math.sin(t * 0.6) * h * 0.08;

      const radius = minDim * blob.baseSize * (0.1 + bandVal * 1.6);
      if (radius < 2) continue;

      const grad = c.createRadialGradient(blobX, blobY, 0, blobX, blobY, radius);
      const alpha = (0.1 + bandVal * 0.22) * gateFactor;
      grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
      grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

      c.fillStyle = grad;
      c.fillRect(blobX - radius, blobY - radius, radius * 2, radius * 2);
    }

    c.globalCompositeOperation = 'source-over';
  }

  // ── Layer 2: Waveform ring ──
  const numRingPts = 256;
  const baseR = minDim * (0.15 + smoothBass * 0.07 + beatBoost * 0.06);
  const waveAmp = minDim * (0.10 + beatBoost * 0.05) * (0.3 + energy * 0.7);

  const ringPts = [];
  for (let i = 0; i <= numRingPts; i++) {
    const idx = Math.floor((i % numRingPts) / numRingPts * bufferLength);
    const sample = floatTimeData[idx] || 0;
    const angle = (i / numRingPts) * Math.PI * 2 - Math.PI / 2;
    const r = baseR + sample * waveAmp;
    ringPts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  const ringAlpha = (0.15 + energy * 0.5 + beatBoost * 0.3) * gateFactor;

  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // Wide outer glow
  c.beginPath();
  for (let i = 0; i <= numRingPts; i++) {
    if (i === 0) c.moveTo(ringPts[i].x, ringPts[i].y);
    else c.lineTo(ringPts[i].x, ringPts[i].y);
  }
  c.closePath();
  c.strokeStyle = `rgba(${pr},${pg},${pb},${ringAlpha * 0.05})`;
  c.lineWidth = 16;
  c.stroke();

  // Medium glow
  c.beginPath();
  for (let i = 0; i <= numRingPts; i++) {
    if (i === 0) c.moveTo(ringPts[i].x, ringPts[i].y);
    else c.lineTo(ringPts[i].x, ringPts[i].y);
  }
  c.closePath();
  c.strokeStyle = `rgba(${pr},${pg},${pb},${ringAlpha * 0.18})`;
  c.lineWidth = 5;
  c.stroke();

  // Core line
  c.beginPath();
  for (let i = 0; i <= numRingPts; i++) {
    if (i === 0) c.moveTo(ringPts[i].x, ringPts[i].y);
    else c.lineTo(ringPts[i].x, ringPts[i].y);
  }
  c.closePath();
  c.strokeStyle = `rgba(${pr},${pg},${pb},${ringAlpha})`;
  c.lineWidth = 1.5;
  c.stroke();

  c.globalCompositeOperation = 'source-over';

  animId = requestAnimationFrame(draw);
}

onMounted(() => {
  vizCtx = ensureAudioContext();
  if (vizCtx.ctx.state === 'suspended') {
    vizCtx.ctx.resume();
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  audio.addEventListener('loadstart', onNewSong);

  // Pre-fill the canvas immediately so it's fully dark before the first draw()
  // fires. Without this, the canvas starts transparent and takes many frames to
  // reach full opacity due to the low-alpha trail fill, creating a visible gap
  // during the fade-in transition.
  const canvas = canvasRef.value;
  if (canvas) {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const c = canvas.getContext('2d');
      c.scale(dpr, dpr);
      c.fillStyle = 'rgb(9, 9, 11)';
      c.fillRect(0, 0, rect.width, rect.height);
    }
  }

  animId = requestAnimationFrame(draw);
});

onUnmounted(() => {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  audio.removeEventListener('loadstart', onNewSong);
});
</script>

<template>
  <div
    ref="containerRef"
    class="w-full flex-1 bg-zinc-950 relative overflow-hidden"
    :class="isFullscreen ? '' : 'h-[calc(100vh-3.5rem-5.5rem)]'"
  >
    <canvas ref="canvasRef" class="w-full h-full block bg-zinc-950" />

    <button
      class="absolute top-3 right-[4.75rem] transition-colors z-10"
      :class="vizMode === 'bubbles' ? 'text-zinc-700 pointer-events-none' : showBubbles ? 'text-zinc-400 hover:text-zinc-200' : 'text-zinc-600 hover:text-zinc-200'"
      @click="toggleBubbles"
      :title="showBubbles ? 'Hide bubbles' : 'Show bubbles'"
    >
      <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="7" cy="15" r="3" /><circle cx="15" cy="9" r="2" /><circle cx="17" cy="17" r="1.5" />
      </svg>
    </button>

    <!-- Mode selector dropdown -->
    <div class="absolute top-3 right-12 z-30">
      <button
        class="text-zinc-500 hover:text-zinc-200 transition-colors"
        @click="showModeDropdown = !showModeDropdown"
        title="Visualizer mode"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        </svg>
      </button>
      <div v-if="showModeDropdown" class="absolute right-0 top-8 bg-zinc-900 border border-zinc-800 rounded-lg py-1 shadow-2xl min-w-[130px]">
        <button
          v-for="m in vizModes"
          :key="m.value"
          class="w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center gap-2.5"
          :class="[
            vizMode === m.value ? 'text-zinc-100' : 'text-zinc-400',
            m.value === 'bubbles' && !showBubbles ? 'opacity-30 pointer-events-none' : 'hover:bg-zinc-800 hover:text-zinc-200',
          ]"
          @click="selectMode(m.value)"
        >
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" v-html="m.icon" />
          <span class="flex-1">{{ m.label }}</span>
          <span class="w-1 h-1 rounded-full bg-current flex-shrink-0" :class="vizMode === m.value ? 'opacity-100' : 'opacity-0'" />
        </button>
        <div class="border-t border-zinc-800 mx-2 my-1" />
        <button
          class="w-full px-3 py-1.5 text-left text-xs transition-colors flex items-center gap-2.5 hover:bg-zinc-800"
          :class="randomizeOnNewSong ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-300'"
          @click="randomizeOnNewSong = !randomizeOnNewSong"
        >
          <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>
          </svg>
          <span class="flex-1">Shuffle on new song</span>
          <span class="w-1 h-1 rounded-full bg-current flex-shrink-0" :class="randomizeOnNewSong ? 'opacity-100' : 'opacity-0'" />
        </button>
      </div>
    </div>
    <div v-if="showModeDropdown" class="fixed inset-0 z-20" @click="showModeDropdown = false" />

    <button
      class="absolute top-3 right-3 text-zinc-500 hover:text-zinc-200 transition-colors z-10"
      @click="toggleFullscreen"
      :title="isFullscreen ? 'Exit fullscreen' : 'Fullscreen'"
    >
      <svg v-if="!isFullscreen" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
      </svg>
      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M4 14h6v6M14 4h6v6M14 10l7-7M3 21l7-7" />
      </svg>
    </button>

  </div>
</template>
