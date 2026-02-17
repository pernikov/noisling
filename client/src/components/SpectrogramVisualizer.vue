<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';

const { audio } = usePlayer();
const { accentColor } = useAccentColor();

const containerRef = ref(null);
const canvasRef = ref(null);
const isFullscreen = ref(false);
const vizMode = ref('spiral'); // 'spiral' | 'wave'
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
let smoothSpiralEnergy = 0; // separate slow smoother for spiral expansion
let time = 0;
let vizCtx = null;
let smoothWaveBass = 0;

function toggleMode() {
  vizMode.value = vizMode.value === 'spiral' ? 'wave' : 'spiral';
  // Clear canvas on mode switch to avoid leftover artifacts
  const canvas = canvasRef.value;
  if (canvas) {
    const c = canvas.getContext('2d');
    c.fillStyle = 'rgb(9, 9, 11)';
    c.fillRect(0, 0, canvas.width, canvas.height);
  }
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

function drawWave() {
  const canvas = canvasRef.value;
  const analyser = vizCtx?.analyser;
  if (!canvas || !analyser) { animId = requestAnimationFrame(draw); return; }

  const setup = setupCanvas();
  if (!setup) { animId = requestAnimationFrame(draw); return; }
  const { c, w, h } = setup;
  const cy = h / 2;

  const bufferLength = analyser.fftSize;
  const floatTimeData = new Float32Array(bufferLength);
  const freqData = new Uint8Array(analyser.frequencyBinCount);
  analyser.getFloatTimeDomainData(floatTimeData);
  analyser.getByteFrequencyData(freqData);

  const [r, g, b] = getColor();

  // Bass energy for radial glow
  const bassEnd = Math.floor(analyser.frequencyBinCount / 6);
  let bass = 0;
  for (let i = 0; i < bassEnd; i++) bass += freqData[i];
  bass = bass / bassEnd / 255;

  // Fast attack, fast release
  if (bass > smoothWaveBass) smoothWaveBass += (bass - smoothWaveBass) * 0.7;
  else smoothWaveBass += (bass - smoothWaveBass) * 0.5;
  bass = smoothWaveBass;

  // Full clear — single crisp line, no trail
  c.clearRect(0, 0, w, h);
  c.fillStyle = 'rgb(9, 9, 11)';
  c.fillRect(0, 0, w, h);

  // Edge vignette glow on bass/kick/snare hits
  if (bass > 0.5) {
    const [br, bg, bb] = [r, g, b];
    const strength = Math.min(1, (bass - 0.5) * 3.0);
    const alpha = strength * 0.4;

    c.globalCompositeOperation = 'screen';

    const diag = Math.sqrt(w * w + h * h) / 2;
    const innerR = diag * 0.7;
    const outerR = diag;

    const grad = c.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, outerR);
    grad.addColorStop(0, `rgba(${br},${bg},${bb},0)`);
    grad.addColorStop(0.5, `rgba(${br},${bg},${bb},${alpha * 0.3})`);
    grad.addColorStop(1, `rgba(${br},${bg},${bb},${alpha})`);
    c.fillStyle = grad;
    c.fillRect(0, 0, w, h);

    c.globalCompositeOperation = 'source-over';
  }

  // Sample fewer points for sharp angular look
  const numPoints = 64;
  const step = Math.floor(bufferLength / numPoints);

  // Lines: almost flat baseline, peaks punch through
  const lineGate = Math.max(0, bass - 0.35) / 0.65;
  const bassAmp = h * (0.008 + lineGate * 0.3);
  const lineAlpha = 0.15 + lineGate * 0.7;
  const lineWidth = 1.5 + lineGate * 2.0;

  // Pre-compute points — bass pumps the displacement
  const pts = new Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const sample = floatTimeData[i * step] || 0;
    const abs = Math.abs(sample);
    const shaped = Math.sign(sample) * Math.pow(abs, 1.8) * 1.5;
    pts[i] = { x: (i / (numPoints - 1)) * w, y: cy + shaped * bassAmp };
  }

  // Draw with glow layers (like spiral mode)
  c.globalCompositeOperation = 'lighter';
  c.lineJoin = 'miter';
  c.lineCap = 'butt';

  // Wide outer glow
  c.beginPath();
  for (let i = 0; i < numPoints; i++) {
    if (i === 0) c.moveTo(pts[i].x, pts[i].y);
    else c.lineTo(pts[i].x, pts[i].y);
  }
  c.strokeStyle = `rgba(${r},${g},${b},${lineAlpha * 0.08})`;
  c.lineWidth = lineWidth + 10;
  c.stroke();

  // Medium glow
  c.beginPath();
  for (let i = 0; i < numPoints; i++) {
    if (i === 0) c.moveTo(pts[i].x, pts[i].y);
    else c.lineTo(pts[i].x, pts[i].y);
  }
  c.strokeStyle = `rgba(${r},${g},${b},${lineAlpha * 0.2})`;
  c.lineWidth = lineWidth + 4;
  c.stroke();

  // Core line
  c.beginPath();
  for (let i = 0; i < numPoints; i++) {
    if (i === 0) c.moveTo(pts[i].x, pts[i].y);
    else c.lineTo(pts[i].x, pts[i].y);
  }
  c.strokeStyle = `rgba(${r},${g},${b},${lineAlpha})`;
  c.lineWidth = lineWidth;
  c.stroke();

  c.globalCompositeOperation = 'source-over';

  animId = requestAnimationFrame(draw);
}

function draw() {
  if (vizMode.value === 'wave') { drawWave(); return; }

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

  if (energy < 0.005) {
    animId = requestAnimationFrame(draw);
    return;
  }

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
    const alpha = 0.1 + bandVal * 0.22;
    grad.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    grad.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
    grad.addColorStop(1, `rgba(${r},${g},${b},0)`);

    c.fillStyle = grad;
    c.fillRect(blobX - radius, blobY - radius, radius * 2, radius * 2);
  }

  c.globalCompositeOperation = 'source-over';

  // ── Layer 2: Spiral lines on top ──
  // Slow rise, fast collapse — needs sustained energy to expand
  const spiralTarget = energy > 0.05 ? energy : 0;
  // Fast both ways — punchy expansion, snappy retraction
  smoothSpiralEnergy += (spiralTarget - smoothSpiralEnergy) * 0.25;

  const scale = minDim / 110;
  const intensity = 0.12 + smoothSpiralEnergy * 0.65;
  const numPoints = 800;
  const a = 0.15;
  const b2 = 0.02 + smoothSpiralEnergy * 2.4;

  const freqBins = analyser.frequencyBinCount;

  // Boundaries: bass keeps spiral shape, mids/highs form a circle
  const bassPointEnd = Math.floor(numPoints * 0.12);
  const midPointEnd = Math.floor(numPoints * 0.45);

  const points = new Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    const dataIdx = i % bufferLength;
    const freqIdx = Math.floor((i / numPoints) * freqBins);
    const freqLevel = freqData[Math.min(freqIdx, freqBins - 1)] / 255;

    let x, y, bandGain, threshold, gatedLevel;

    if (i < bassPointEnd) {
      // ── Bass: full spiral shape, big pumps ──
      const t = (spiralAngle / 100) * i;
      x = (a + b2 * t) * Math.sin(t) + Math.sin(i / (spiralAngle / 100));
      y = (a + b2 * t) * Math.cos(t) + Math.cos(i / (spiralAngle / 100));
      bandGain = 1.8;
      threshold = 0.25;
    } else {
      // ── Mids & Highs: tight circle that only expands on energy ──
      const angle = ((i - bassPointEnd) / (numPoints - bassPointEnd)) * Math.PI * 2;
      // Base radius — compact circle
      const baseRadius = 2.5;
      if (i < midPointEnd) {
        bandGain = 0.6;
        threshold = 0.4;
      } else {
        bandGain = 0.3;
        threshold = 0.5;
      }
      gatedLevel = freqLevel > threshold ? (freqLevel - threshold) / (1 - threshold) : 0;
      // Circle expands outward only when energy is present
      const expandRadius = baseRadius + gatedLevel * bandGain * 4.0;
      x = expandRadius * Math.sin(angle);
      y = expandRadius * Math.cos(angle);
    }

    // Gated level for bass (mids/highs already computed above)
    if (i < bassPointEnd) {
      gatedLevel = freqLevel > threshold ? (freqLevel - threshold) / (1 - threshold) : 0;
    }

    const displacement = floatTimeData[dataIdx] * timeData[dataIdx] * intensity * bandGain * (0.3 + gatedLevel * 0.7);
    const dist = Math.sqrt(x * x + y * y) || 1;
    x += (x / dist) * displacement * 0.7;
    y += (y / dist) * displacement * 0.7;

    points[i] = {
      x: cx + x * scale,
      y: cy + y * scale,
      wave: floatTimeData[dataIdx],
      displacement,
    };
  }

  // Build mirrored bass points (rotate 180°)
  const mirrorPoints = new Array(bassPointEnd);
  for (let i = 0; i < bassPointEnd; i++) {
    const p = points[i];
    mirrorPoints[i] = {
      x: cx - (p.x - cx),
      y: cy - (p.y - cy),
      wave: p.wave,
      displacement: p.displacement,
    };
  }

  // Draw lines with lighter blend so they glow against the blobs
  c.globalCompositeOperation = 'lighter';
  c.lineCap = 'round';
  c.lineJoin = 'round';

  // Helper to draw a line segment with distance-based fade
  function drawSegment(p0, p1, fade) {
    const wave = p0.wave;
    const shift = wave * 0.2;
    const R = Math.max(0, Math.min(1, (pr / 255) + shift));
    const G = Math.max(0, Math.min(1, (pg / 255) - Math.abs(shift) * 0.25));
    const B = Math.max(0, Math.min(1, (pb / 255) - shift * 0.4));
    const alpha = Math.min(0.55, energy * 0.8 + Math.abs(wave) * 0.15) * fade;

    c.beginPath();
    c.moveTo(p0.x, p0.y);
    c.lineTo(p1.x, p1.y);
    c.strokeStyle = `rgba(${Math.round(R * 255)},${Math.round(G * 255)},${Math.round(B * 255)},${alpha})`;
    c.lineWidth = 0.6 + Math.abs(p0.displacement) * 0.015 * scale;
    c.stroke();
  }

  // Draw original points — fade out with distance from center
  for (let i = 0; i < numPoints - 1; i++) {
    const dx = points[i].x - cx;
    const dy = points[i].y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = minDim * 0.5;
    const fade = Math.max(0.15, 1 - (dist / maxDist) * 0.6);
    drawSegment(points[i], points[i + 1], fade);
  }

  // Draw mirrored bass spiral — same distance fade
  for (let i = 0; i < bassPointEnd - 1; i++) {
    const dx = mirrorPoints[i].x - cx;
    const dy = mirrorPoints[i].y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const maxDist = minDim * 0.5;
    const fade = Math.max(0.15, 1 - (dist / maxDist) * 0.6);
    drawSegment(mirrorPoints[i], mirrorPoints[i + 1], fade);
  }

  c.globalCompositeOperation = 'source-over';

  animId = requestAnimationFrame(draw);
}

onMounted(() => {
  vizCtx = ensureAudioContext();
  if (vizCtx.ctx.state === 'suspended') {
    vizCtx.ctx.resume();
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
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
    <canvas ref="canvasRef" class="w-full h-full block" />

    <button
      class="absolute top-3 right-12 text-zinc-500 hover:text-zinc-200 transition-colors z-10"
      @click="toggleMode"
      :title="vizMode === 'spiral' ? 'Switch to wave' : 'Switch to spiral'"
    >
      <svg v-if="vizMode === 'spiral'" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
        <path d="M2 12h4l3-8 4 16 3-8h6" />
      </svg>
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
