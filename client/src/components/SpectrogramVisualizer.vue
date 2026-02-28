<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';

const { audio } = usePlayer();
const { accentColor } = useAccentColor();

const containerRef = ref(null);
const canvasRef = ref(null);
const isFullscreen = ref(false);
const vizMode = ref('spiral'); // 'spiral' | 'wave' | 'bubbles'
const showBubbles = ref(true);
let animId = null;

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
let spiralAngle = 2.44;
let spiralDir = true;
let time = 0;
let vizCtx = null;
function toggleMode() {
  if (vizMode.value === 'spiral') vizMode.value = 'wave';
  else if (vizMode.value === 'wave') vizMode.value = showBubbles.value ? 'bubbles' : 'spiral';
  else vizMode.value = 'spiral';
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
  // Bass drives X amplitude, mids drive Y, highs nudge the phase
  const ampX = minDim * 0.22 * (0.15 + smoothBass * 1.5);
  const ampY = minDim * 0.22 * (0.15 + smoothMid * 1.5);
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

function draw() {
  if (vizMode.value === 'wave' || vizMode.value === 'bubbles') { drawBars(); return; }

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
  const baseR = minDim * (0.15 + smoothBass * 0.07);
  const waveAmp = minDim * 0.10 * (0.3 + energy * 0.7);

  const ringPts = [];
  for (let i = 0; i <= numRingPts; i++) {
    const idx = Math.floor((i % numRingPts) / numRingPts * bufferLength);
    const sample = floatTimeData[idx] || 0;
    const angle = (i / numRingPts) * Math.PI * 2 - Math.PI / 2;
    const r = baseR + sample * waveAmp;
    ringPts.push({ x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r });
  }

  const ringAlpha = (0.15 + energy * 0.5) * gateFactor;

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

    <button
      class="absolute top-3 right-12 text-zinc-500 hover:text-zinc-200 transition-colors z-10"
      @click="toggleMode"
      :title="vizMode === 'spiral' ? 'Switch to Lissajous' : vizMode === 'wave' ? (showBubbles ? 'Remove waves' : 'Switch to spiral') : 'Switch to spiral'"
    >
      <!-- In spiral: show wave icon (next = wave) -->
      <svg v-if="vizMode === 'spiral'" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M4,12 C4,8 8,8 12,12 C16,16 20,16 20,12 C20,8 16,8 12,12 C8,16 4,16 4,12" />
      </svg>
      <!-- In wave: next is bubbles-only (if bubbles on) → wave-off icon; or spiral (if bubbles off) → spiral icon -->
      <svg v-else-if="vizMode === 'wave' && showBubbles" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M4 12 C6 9 8 9 10 12 C12 15 14 15 16 12 C18 9 20 9 22 12" stroke-linecap="round" />
        <line x1="4" y1="20" x2="20" y2="4" stroke-linecap="round" />
      </svg>
      <!-- In wave with no bubbles, or in bubbles mode: show spiral icon (next = spiral) -->
      <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3" /><path d="M12 2a10 10 0 0 1 4 19.3M12 2a10 10 0 0 0-4 19.3" />
      </svg>
    </button>

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
