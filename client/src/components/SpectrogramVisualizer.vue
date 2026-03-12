<script setup>
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import { useAccentColor } from '../composables/useAccentColor.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';

const props = defineProps({
  analyser: {
    type: Object,
    default: null,
  },
});

const VIZ_OPTIONS = [
  {
    value: 'spiral',
    label: 'Spiral',
    icon: '<circle cx="12" cy="12" r="3"/><path d="M12 2a10 10 0 0 1 4 19.3M12 2a10 10 0 0 0-4 19.3"/>',
    credit: null,
  },
  {
    value: 'pills',
    label: 'Pills',
    icon: '<path d="M7 16l4-8M13 16l4-8M6 12h12" stroke-linecap="round"/>',
    credit: {
      label: 'Inspired by soulwire',
      url: 'https://codepen.io/soulwire/pen/kGjRpg',
    },
  },
];

const PILL_SCALE = { min: 5, max: 80 };
const PILL_SPEED = { min: 0.2, max: 1.0 };
const PILL_ALPHA = { min: 0.8, max: 0.9 };
const PILL_SPIN = { min: 0.001, max: 0.005 };
const PILL_SIZE = { min: 0.5, max: 1.25 };
const PILL_COUNT = 150;
const NUM_BANDS = 128;

const BUBBLES = [
  { phase: 0, speed: 0.4, orbitX: 0.28, orbitY: 0.22, band: 'bass', baseSize: 0.45 },
  { phase: 1.2, speed: 0.3, orbitX: 0.32, orbitY: 0.28, band: 'bass', baseSize: 0.4 },
  { phase: 2.5, speed: 0.45, orbitX: 0.22, orbitY: 0.32, band: 'mid', baseSize: 0.35 },
  { phase: 3.8, speed: 0.35, orbitX: 0.38, orbitY: 0.18, band: 'mid', baseSize: 0.3 },
  { phase: 5.0, speed: 0.5, orbitX: 0.18, orbitY: 0.38, band: 'high', baseSize: 0.25 },
  { phase: 0.7, speed: 0.25, orbitX: 0.3, orbitY: 0.3, band: 'bass', baseSize: 0.5 },
  { phase: 4.2, speed: 0.42, orbitX: 0.25, orbitY: 0.2, band: 'high', baseSize: 0.22 },
];

const containerRef = ref(null);
const canvasRef = ref(null);
const analyserRef = shallowRef(null);
const isFullscreen = ref(false);
const showModeDropdown = ref(false);
const pillsNoiseUrl = ref('');

const { state, getVisualizerAnalyser, resumeVisualizerContext } = usePlayer();
const { accentColor } = useAccentColor();
const { vizMode, setVizMode } = useTheme();

let ctx = null;
let animationFrameId = 0;
let resizeObserver = null;
let viewportWidth = 0;
let viewportHeight = 0;
let frequencyData = null;
let timeDomainData = null;
let pillsParticles = [];
let visualTime = 0;
let smoothBass = 0;
let smoothMid = 0;
let smoothHigh = 0;
let prevBass = 0;
let beatBoost = 0;
let spiralAngle = 2.44;
let spiralDirection = true;

const currentMode = computed(() =>
  VIZ_OPTIONS.find(option => option.value === vizMode.value) ?? VIZ_OPTIONS[0]
);

const message = computed(() => {
  if (!analyserRef.value) {
    return {
      title: 'Visualizer unavailable',
      body: 'This device or browser does not expose the shared Web Audio analyser.',
    };
  }

  return null;
});

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function createPillParticle(x = 0, y = 0) {
  return {
    x,
    y,
    level: 1,
    scale: 1,
    alpha: 1,
    speed: 1,
    colorIndex: 0,
    size: 1,
    spin: 0,
    band: 0,
    smoothedScale: 0,
    smoothedAlpha: 0,
    decayScale: 0,
    decayAlpha: 0,
    rotation: 0,
    energy: 0,
  };
}

function resetPillParticle(particle) {
  particle.level = 1 + Math.floor(Math.random() * 4);
  particle.scale = randomBetween(PILL_SCALE.min, PILL_SCALE.max);
  particle.alpha = randomBetween(PILL_ALPHA.min, PILL_ALPHA.max);
  particle.speed = randomBetween(PILL_SPEED.min, PILL_SPEED.max);
  particle.colorIndex = Math.floor(Math.random() * 5);
  particle.size = randomBetween(PILL_SIZE.min, PILL_SIZE.max);
  particle.spin = randomBetween(PILL_SPIN.min, PILL_SPIN.max) * (Math.random() < 0.5 ? -1 : 1);
  particle.band = Math.floor(Math.random() * NUM_BANDS);
  particle.smoothedScale = 0;
  particle.smoothedAlpha = 0;
  particle.decayScale = 0;
  particle.decayAlpha = 0;
  particle.rotation = Math.random() * Math.PI * 2;
  particle.energy = 0;
}

function seedPills() {
  pillsParticles = Array.from({ length: PILL_COUNT }, () => {
    const particle = createPillParticle(
      Math.random() * viewportWidth,
      Math.random() * viewportHeight * 2,
    );
    resetPillParticle(particle);
    particle.energy = particle.band / 256;
    return particle;
  });
}

function resizePills(previousWidth, previousHeight) {
  if (!previousWidth || !previousHeight || !pillsParticles.length) {
    seedPills();
    return;
  }

  const widthRatio = viewportWidth / previousWidth;
  const heightRatio = viewportHeight / previousHeight;

  for (let index = 0; index < pillsParticles.length; index += 1) {
    const particle = pillsParticles[index];
    particle.x *= widthRatio;
    particle.y *= heightRatio;
  }
}

function ensurePillsNoiseUrl() {
  if (pillsNoiseUrl.value) return;

  const noiseCanvas = document.createElement('canvas');
  noiseCanvas.width = 160;
  noiseCanvas.height = 160;
  const noiseContext = noiseCanvas.getContext('2d', { alpha: true });
  const image = noiseContext.createImageData(noiseCanvas.width, noiseCanvas.height);

  for (let index = 0; index < image.data.length; index += 4) {
    const value = 160 + Math.random() * 95;
    image.data[index] = value;
    image.data[index + 1] = value;
    image.data[index + 2] = value;
    image.data[index + 3] = 26 + Math.random() * 34;
  }

  noiseContext.putImageData(image, 0, 0);
  pillsNoiseUrl.value = noiseCanvas.toDataURL('image/png');
}

function getAccentRgb() {
  if (!accentColor.value) return [52, 211, 153];
  const parts = accentColor.value.split(',').map(Number);
  return parts.length === 3 ? parts : [52, 211, 153];
}

function getSpiralPalette() {
  const [r, g, b] = getAccentRgb();
  return [
    [r, g, b],
    [Math.min(255, r + 80), Math.max(0, g - 40), Math.min(255, b + 30)],
    [Math.max(0, r - 40), Math.min(255, g + 50), Math.min(255, b + 80)],
    [Math.min(255, r + 40), Math.min(255, g + 30), Math.max(0, b - 50)],
    [Math.max(0, r - 60), Math.max(0, g - 20), Math.min(255, b + 60)],
  ];
}

function syncAnalyser() {
  analyserRef.value = props.analyser ?? getVisualizerAnalyser();
  frequencyData = analyserRef.value ? new Uint8Array(analyserRef.value.frequencyBinCount) : null;
  timeDomainData = analyserRef.value ? new Float32Array(analyserRef.value.fftSize) : null;
}

function resetMotionState() {
  smoothBass = 0;
  smoothMid = 0;
  smoothHigh = 0;
  prevBass = 0;
  beatBoost = 0;
  visualTime = 0;
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;

  const bounds = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const previousWidth = viewportWidth;
  const previousHeight = viewportHeight;

  viewportWidth = bounds.width;
  viewportHeight = bounds.height;

  if (!viewportWidth || !viewportHeight) return;

  canvas.width = Math.round(viewportWidth * dpr);
  canvas.height = Math.round(viewportHeight * dpr);

  ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  resizePills(previousWidth, previousHeight);
  paintBackground();
}

function paintBackground() {
  if (!ctx) return;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, viewportWidth, viewportHeight);
  ctx.fillStyle = '#13242f';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);
}

function coolPills() {
  for (let index = 0; index < pillsParticles.length; index += 1) {
    const particle = pillsParticles[index];
    particle.energy *= 0.94;
    particle.decayScale *= 0.972;
    particle.decayAlpha *= 0.95;
    particle.smoothedAlpha *= 0.958;
    particle.smoothedScale *= 0.975;
  }
}

function updateBeatBoost(rawBass) {
  const delta = rawBass - prevBass;
  if (delta > 0.08) beatBoost = Math.min(1, beatBoost + delta * 4);
  beatBoost *= 0.88;
  prevBass = rawBass;
}

function analyzeAudioFrame() {
  if (!analyserRef.value || !frequencyData || !timeDomainData) return null;

  analyserRef.value.getByteFrequencyData(frequencyData);
  analyserRef.value.getFloatTimeDomainData(timeDomainData);

  const third = Math.floor(frequencyData.length / 3);
  let bass = 0;
  let mid = 0;
  let high = 0;

  for (let index = 0; index < third; index += 1) bass += frequencyData[index];
  for (let index = third; index < third * 2; index += 1) mid += frequencyData[index];
  for (let index = third * 2; index < frequencyData.length; index += 1) high += frequencyData[index];

  bass = bass / third / 255;
  mid = mid / third / 255;
  high = high / Math.max(1, frequencyData.length - third * 2) / 255;

  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  updateBeatBoost(bass);

  return {
    bass,
    mid,
    high,
    energy: (smoothBass + smoothMid + smoothHigh) / 3,
  };
}

function drawSpiralBubbles(palette, gateFactor, width, height, centerX, centerY, minDim) {
  ctx.globalCompositeOperation = 'screen';

  for (let index = 0; index < BUBBLES.length; index += 1) {
    const bubble = BUBBLES[index];
    const [r, g, b] = palette[index % palette.length];
    const bandValue = bubble.band === 'bass'
      ? smoothBass
      : bubble.band === 'mid'
        ? smoothMid
        : smoothHigh;

    const orbitTime = visualTime * bubble.speed + bubble.phase;
    const bubbleX = centerX + Math.sin(orbitTime) * width * bubble.orbitX + Math.cos(orbitTime * 0.7) * width * 0.1;
    const bubbleY = centerY + Math.cos(orbitTime) * height * bubble.orbitY + Math.sin(orbitTime * 0.6) * height * 0.08;
    const radius = minDim * bubble.baseSize * (0.1 + bandValue * 1.6);

    if (radius < 2) continue;

    const gradient = ctx.createRadialGradient(bubbleX, bubbleY, 0, bubbleX, bubbleY, radius);
    const alpha = (0.1 + bandValue * 0.22) * gateFactor;
    gradient.addColorStop(0, `rgba(${r},${g},${b},${alpha})`);
    gradient.addColorStop(0.4, `rgba(${r},${g},${b},${alpha * 0.45})`);
    gradient.addColorStop(1, `rgba(${r},${g},${b},0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(bubbleX - radius, bubbleY - radius, radius * 2, radius * 2);
  }

  ctx.globalCompositeOperation = 'source-over';
}

function drawSpiralFrame() {
  const frame = analyzeAudioFrame();
  if (!frame) return;

  const { energy } = frame;
  const width = viewportWidth;
  const height = viewportHeight;
  const centerX = width / 2;
  const centerY = height / 2;
  const minDim = Math.min(width, height);

  const idle = !state.isPlaying || energy < 0.006;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = idle
    ? 'rgba(9, 9, 11, 0.28)'
    : `rgba(9, 9, 11, ${0.12 + (1 - energy) * 0.18})`;
  ctx.fillRect(0, 0, width, height);

  if (idle && energy < 0.0012) return;

  const gateFactor = Math.min(1, energy / 0.018);
  visualTime += 0.008;

  if (spiralDirection) {
    spiralAngle += 0.0000015;
    if (spiralAngle >= 2.48) spiralDirection = false;
  } else {
    spiralAngle -= 0.000002;
    if (spiralAngle <= 2.42) spiralDirection = true;
  }

  const palette = getSpiralPalette();
  const [pr, pg, pb] = palette[0];
  const coreGlow = ctx.createRadialGradient(
    centerX,
    centerY,
    minDim * 0.04,
    centerX,
    centerY,
    minDim * (0.34 + smoothBass * 0.16),
  );
  coreGlow.addColorStop(0, `rgba(${pr},${pg},${pb},${0.12 + energy * 0.18})`);
  coreGlow.addColorStop(0.45, `rgba(${pr},${pg},${pb},${0.05 + energy * 0.06})`);
  coreGlow.addColorStop(1, 'rgba(9,9,11,0)');
  ctx.fillStyle = coreGlow;
  ctx.fillRect(0, 0, width, height);

  drawSpiralBubbles(palette, gateFactor, width, height, centerX, centerY, minDim);

  const pointCount = 256;
  const baseRadius = minDim * (0.15 + smoothBass * 0.07 + beatBoost * 0.06);
  const waveAmplitude = minDim * (0.1 + beatBoost * 0.05) * (0.3 + energy * 0.7);
  const ringPoints = [];

  for (let index = 0; index <= pointCount; index += 1) {
    const sampleIndex = Math.floor((index % pointCount) / pointCount * timeDomainData.length);
    const sample = timeDomainData[sampleIndex] || 0;
    const angle = (index / pointCount) * Math.PI * 2 - Math.PI / 2 + spiralAngle;
    const radius = baseRadius + sample * waveAmplitude + Math.sin(angle * 3 + visualTime * 1.2) * minDim * 0.012 * gateFactor;
    ringPoints.push({
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    });
  }

  const ringAlpha = (0.15 + energy * 0.5 + beatBoost * 0.3) * gateFactor;

  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const strokeRing = (strokeStyle, lineWidth) => {
    ctx.beginPath();
    for (let index = 0; index <= pointCount; index += 1) {
      if (index === 0) ctx.moveTo(ringPoints[index].x, ringPoints[index].y);
      else ctx.lineTo(ringPoints[index].x, ringPoints[index].y);
    }
    ctx.closePath();
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  };

  strokeRing(`rgba(${pr},${pg},${pb},${ringAlpha * 0.05})`, 16);
  strokeRing(`rgba(${pr},${pg},${pb},${ringAlpha * 0.18})`, 5);
  strokeRing(`rgba(${pr},${pg},${pb},${ringAlpha})`, 1.5);
  strokeRing(`rgba(${pr},${pg},${pb},${ringAlpha * 0.08})`, 9);

  ctx.globalCompositeOperation = 'source-over';
}

function drawPillsFrame() {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = state.isPlaying ? 'rgba(19, 36, 47, 0.42)' : 'rgba(19, 36, 47, 0.66)';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  let averageEnergy = 0;
  const palette = getSpiralPalette();

  if (state.isPlaying && analyserRef.value && frequencyData) {
    analyserRef.value.getByteFrequencyData(frequencyData);
    for (let index = 0; index < pillsParticles.length; index += 1) {
      const particle = pillsParticles[index];
      particle.energy = frequencyData[Math.min(particle.band, frequencyData.length - 1)] / 256;
      averageEnergy += particle.energy;
    }
    averageEnergy /= Math.max(1, pillsParticles.length);
    if (averageEnergy < 0.012) coolPills();
  } else {
    coolPills();
  }

  ctx.globalCompositeOperation = 'lighter';

  for (let index = 0; index < pillsParticles.length; index += 1) {
    const particle = pillsParticles[index];

    if (particle.y < -particle.size * particle.level * particle.scale * 2) {
      resetPillParticle(particle);
      particle.x = Math.random() * viewportWidth;
      particle.y = viewportHeight + particle.size * particle.scale * particle.level;
    }

    const power = Math.exp(particle.energy);
    const scale = particle.scale * power;
    const alpha = particle.alpha * particle.energy * 0.68;

    particle.decayScale = Math.max(particle.decayScale, scale);
    particle.decayAlpha = Math.max(particle.decayAlpha, alpha);

    particle.smoothedScale += (particle.decayScale - particle.smoothedScale) * 0.3;
    particle.smoothedAlpha += (particle.decayAlpha - particle.smoothedAlpha) * 0.3;

    particle.decayScale *= 0.982;
    particle.decayAlpha *= 0.92;
    particle.rotation += particle.spin;
    particle.y -= particle.speed * particle.level;

    ctx.save();
    ctx.beginPath();
    ctx.translate(
      particle.x + Math.cos(particle.rotation * particle.speed) * 220,
      particle.y,
    );
    ctx.rotate(particle.rotation);
    ctx.scale(particle.smoothedScale * particle.level, particle.smoothedScale * particle.level);
    ctx.moveTo(particle.size * 0.5, 0);
    ctx.lineTo(particle.size * -0.5, 0);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.min(0.4, particle.smoothedAlpha / (particle.level * 1.65));
    const [r, g, b] = palette[particle.colorIndex % palette.length];
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'source-over';
}

function render() {
  animationFrameId = window.requestAnimationFrame(render);
  if (!ctx || !viewportWidth || !viewportHeight) return;

  if (currentMode.value.value === 'pills') {
    drawPillsFrame();
    return;
  }

  drawSpiralFrame();
}

function start() {
  syncAnalyser();
  resizeCanvas();
  resumeVisualizerContext();

  if (!animationFrameId) {
    animationFrameId = window.requestAnimationFrame(render);
  }
}

function stop() {
  if (animationFrameId) {
    window.cancelAnimationFrame(animationFrameId);
    animationFrameId = 0;
  }
}

function toggleFullscreen() {
  if (!containerRef.value) return;

  if (document.fullscreenElement) {
    document.exitFullscreen();
    return;
  }

  containerRef.value.requestFullscreen?.();
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
  resizeCanvas();
}

function selectMode(mode) {
  setVizMode(mode);
  showModeDropdown.value = false;
  resetMotionState();
  paintBackground();
}

watch(() => props.analyser, syncAnalyser);
watch(vizMode, () => {
  resetMotionState();
  paintBackground();
});

onMounted(() => {
  ensurePillsNoiseUrl();
  start();

  resizeObserver = new ResizeObserver(() => resizeCanvas());
  if (containerRef.value) resizeObserver.observe(containerRef.value);

  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('visibilitychange', resumeVisualizerContext);
});

onUnmounted(() => {
  stop();
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('visibilitychange', resumeVisualizerContext);
});
</script>

<template>
  <section
    ref="containerRef"
    class="visualizer"
    :class="{ 'visualizer--fullscreen': isFullscreen }"
  >
    <canvas ref="canvasRef" class="visualizer__canvas" />
    <div
      v-if="currentMode.value === 'pills'"
      class="visualizer__pills-glow"
    />
    <div
      v-if="currentMode.value === 'pills' && pillsNoiseUrl"
      class="visualizer__pills-noise"
      :style="{ backgroundImage: `url(${pillsNoiseUrl})` }"
    />
    <div
      v-if="currentMode.value === 'pills'"
      class="visualizer__pills-vignette"
    />

    <div v-if="message" class="visualizer__message">
      <h1>{{ message.title }}</h1>
      <h2>{{ message.body }}</h2>
    </div>

    <a
      v-if="currentMode.credit"
      :href="currentMode.credit.url"
      target="_blank"
      rel="noopener noreferrer"
      class="visualizer__credit"
    >
      {{ currentMode.credit.label }}
    </a>

    <div class="visualizer__controls">
      <button
        type="button"
        class="visualizer__icon-button"
        title="Visualizer mode"
        @click="showModeDropdown = !showModeDropdown"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>

      <div v-if="showModeDropdown" class="visualizer__mode-menu">
        <button
          v-for="option in VIZ_OPTIONS"
          :key="option.value"
          type="button"
          class="visualizer__mode-option"
          :class="{ 'visualizer__mode-option--active': currentMode.value === option.value }"
          @click="selectMode(option.value)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" v-html="option.icon" />
          <span>{{ option.label }}</span>
        </button>
      </div>

      <button
        type="button"
        class="visualizer__icon-button"
        :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="toggleFullscreen"
      >
        <svg v-if="!isFullscreen" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 14h6v6M14 4h6v6M14 10l7-7M3 21l7-7" />
        </svg>
      </button>
    </div>

    <div v-if="showModeDropdown" class="visualizer__scrim" @click="showModeDropdown = false" />
  </section>
</template>

<style scoped>
.visualizer {
  --visualizer-nav-offset: calc(env(safe-area-inset-top) + 3.5rem);
  position: relative;
  flex: 1;
  min-height: calc(100vh - 5.5rem);
  overflow: hidden;
  background: #13242f;
  font-family: 'Lato', 'Inter', sans-serif;
}

.visualizer--fullscreen {
  --visualizer-nav-offset: 0px;
  min-height: 100vh;
}

.visualizer::before {
  position: absolute;
  inset: 0;
  z-index: 0;
  content: '';
  opacity: 0.9;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 20%, rgba(0, 0, 0, 1) 95%);
  pointer-events: none;
}

.visualizer::after {
  position: absolute;
  inset: 0;
  z-index: 1;
  content: '';
  opacity: 0.42;
  background-image:
    radial-gradient(rgba(255, 255, 255, 0.08) 0.6px, transparent 0.6px),
    radial-gradient(rgba(255, 255, 255, 0.06) 0.7px, transparent 0.7px);
  background-position: 0 0, 11px 13px;
  background-size: 17px 17px, 21px 21px;
  mix-blend-mode: screen;
  pointer-events: none;
}

.visualizer__canvas {
  position: relative;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.visualizer__pills-noise {
  position: absolute;
  inset: 0;
  z-index: 2;
  opacity: 0.48;
  background-position: 0 0;
  background-repeat: repeat;
  background-size: 160px 160px;
  mix-blend-mode: screen;
  pointer-events: none;
}

.visualizer__pills-vignette {
  position: absolute;
  inset: 0;
  z-index: 3;
  opacity: 0.88;
  background: radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 24%, rgba(0, 0, 0, 0.92) 95%);
  pointer-events: none;
}

.visualizer__pills-glow {
  position: absolute;
  inset: 0;
  z-index: 1;
  background:
    radial-gradient(circle at 50% 42%, rgba(255, 255, 255, 0.06), transparent 18%),
    radial-gradient(circle at 50% 48%, rgba(255, 255, 255, 0.03), transparent 34%);
  mix-blend-mode: screen;
  pointer-events: none;
}

.visualizer__message {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 5;
  width: min(360px, calc(100% - 2rem));
  min-height: 60px;
  padding: 20px;
  border-radius: 3px;
  background: rgba(0, 0, 0, 0.8);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  color: #fff;
  text-align: center;
  text-transform: uppercase;
  transform: translate(-50%, -50%);
}

.visualizer__message h1,
.visualizer__message h2 {
  margin: 10px 0;
  font-weight: 300;
  line-height: 1.2;
}

.visualizer__message h1 {
  font-size: 1.65rem;
}

.visualizer__message h2 {
  font-size: 0.82rem;
  font-weight: 400;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.82);
}

.visualizer__credit {
  position: absolute;
  top: calc(var(--visualizer-nav-offset) + 0.85rem);
  left: 0.95rem;
  z-index: 4;
  color: rgba(228, 228, 231, 0.72);
  font-size: 0.74rem;
  text-decoration: none;
  transition: color 140ms ease;
}

.visualizer__credit:hover {
  color: rgba(250, 250, 250, 0.98);
}

.visualizer__controls {
  position: absolute;
  top: calc(var(--visualizer-nav-offset) + 0.75rem);
  right: 0.75rem;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.visualizer__mode-menu {
  position: absolute;
  top: calc(var(--visualizer-nav-offset) + 2.8rem);
  right: 3.1rem;
  min-width: 152px;
  padding: 0.35rem;
  border: 1px solid rgba(63, 63, 70, 0.9);
  border-radius: 0.8rem;
  background: rgba(9, 9, 11, 0.92);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(18px);
}

.visualizer__mode-option {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border-radius: 0.55rem;
  color: rgba(212, 212, 216, 0.86);
  font-size: 0.78rem;
  text-align: left;
  transition: background-color 140ms ease, color 140ms ease;
}

.visualizer__mode-option:hover,
.visualizer__mode-option--active {
  background: rgba(39, 39, 42, 0.9);
  color: rgba(250, 250, 250, 0.98);
}

.visualizer__mode-option svg {
  width: 0.95rem;
  height: 0.95rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.visualizer__icon-button {
  z-index: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(12px);
  transition: background-color 140ms ease, border-color 140ms ease, color 140ms ease;
}

.visualizer__icon-button:hover {
  background: rgba(0, 0, 0, 0.52);
  border-color: rgba(255, 255, 255, 0.32);
  color: rgba(250, 250, 250, 1);
}

.visualizer__icon-button svg {
  width: 1rem;
  height: 1rem;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
}

.visualizer__scrim {
  position: absolute;
  inset: 0;
  z-index: 3;
}
</style>
