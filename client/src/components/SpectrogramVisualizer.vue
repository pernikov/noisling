<script setup>
import butterchurn from 'butterchurn';
import butterchurnPresets from 'butterchurn-presets';
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';
import {
  BUTTERCHURN_PRESET_OPTIONS,
  DEFAULT_BUTTERCHURN_PRESET,
} from '../constants/butterchurnPresets.js';
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
  {
    value: 'butterchurn',
    label: 'Butterchurn',
    icon: '<path d="M4 16c2.5-5.6 5.2-8.4 8-8.4s5.5 2.8 8 8.4"/><path d="M4 9.5c2.5 3.7 5.2 5.5 8 5.5s5.5-1.8 8-5.5" stroke-linecap="round"/>',
    credit: {
      label: 'Butterchurn by Jordan Berg',
      url: 'https://github.com/jberg/butterchurn',
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
const BUTTERCHURN_BLEND_SECONDS = 2.4;
const BUTTERCHURN_ROTATE_MS = 30000;
const butterchurnPresetMap = butterchurnPresets.getPresets();
const butterchurnPresetNames = BUTTERCHURN_PRESET_OPTIONS
  .map(option => option.value)
  .filter(name => butterchurnPresetMap[name]);
const butterchurnPresetOptions = BUTTERCHURN_PRESET_OPTIONS
  .filter(option => butterchurnPresetMap[option.value]);

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
const canvas2dRef = ref(null);
const butterchurnCanvasRef = ref(null);
const analyserRef = shallowRef(null);
const isFullscreen = ref(false);
const showModeDropdown = ref(false);
const pillsNoiseUrl = ref('');
const hideChromeInFullscreen = ref(localStorage.getItem('noisling_viz_hide_fullscreen_chrome') === 'true');
const overlayVisible = ref(true);

const { state, getVisualizerAnalyser, getVisualizerGraph, resumeVisualizerContext } = usePlayer();
const { accentColor: artworkAccentColor } = useAccentColor();
const {
  accentRgb,
  vizMode,
  randomizeOnNewTrack,
  butterchurnPresetMode,
  butterchurnPreset,
  setButterchurnPreset: persistButterchurnPreset,
  setButterchurnPresetMode,
  setVizMode,
} = useTheme();

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
let overlayHideTimer = 0;
let lastOverlayRevealAt = 0;
let butterchurnVisualizer = null;
let butterchurnConnected = false;
let butterchurnSupported = null;
const butterchurnPresetLoaded = ref(false);
const butterchurnPresetName = ref(null);
let butterchurnWasPlaying = false;
let butterchurnPresetTimer = 0;
const butterchurnPresetIndex = ref(-1);
let butterchurnTrackStep = 0;
const butterchurnDesiredIndex = ref(0);

const currentMode = computed(() =>
  VIZ_OPTIONS.find(option => option.value === vizMode.value) ?? VIZ_OPTIONS[0]
);
const isButterchurnMode = computed(() => currentMode.value.value === 'butterchurn');
const showButterchurnPresetPicker = computed(() => (
  butterchurnPresetMode.value === 'single'
));

const shouldShowOverlay = computed(() => {
  if (showModeDropdown.value) return true;
  if (!isFullscreen.value) return true;
  if (!hideChromeInFullscreen.value) return true;
  return overlayVisible.value;
});
const message = computed(() => {
  if (isButterchurnMode.value && !isButterchurnAvailable()) {
    return {
      title: 'Butterchurn unavailable',
      body: 'This browser does not expose the shared Web Audio graph with WebGL 2 support.',
    };
  }

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

function getButterchurnPresetAt(index) {
  if (!butterchurnPresetNames.length) return null;
  const safeIndex = ((index % butterchurnPresetNames.length) + butterchurnPresetNames.length) % butterchurnPresetNames.length;
  butterchurnPresetIndex.value = safeIndex;
  return butterchurnPresetNames[safeIndex];
}

function isButterchurnAvailable() {
  if (butterchurnSupported !== null) return butterchurnSupported;
  if (typeof document === 'undefined') {
    butterchurnSupported = false;
    return butterchurnSupported;
  }

  const graph = getVisualizerGraph();
  if (!graph?.ctx || !graph?.source) {
    butterchurnSupported = false;
    return butterchurnSupported;
  }

  const canvas = document.createElement('canvas');
  let gl = null;

  try {
    gl = canvas.getContext('webgl2');
  } catch {
    gl = null;
  }

  butterchurnSupported = Boolean(gl);
  return butterchurnSupported;
}

function ensureButterchurnVisualizer() {
  if (!isButterchurnMode.value || !isButterchurnAvailable()) return null;

  const canvas = butterchurnCanvasRef.value;
  const graph = getVisualizerGraph();
  if (!canvas || !graph?.ctx || !graph?.source) return null;

  if (!butterchurnVisualizer) {
    butterchurnVisualizer = butterchurn.createVisualizer(graph.ctx, canvas, {
      width: Math.max(1, canvas.width || 1),
      height: Math.max(1, canvas.height || 1),
    });
  }

  if (!butterchurnConnected) {
    butterchurnVisualizer.connectAudio(graph.source);
    butterchurnConnected = true;
  }

  return butterchurnVisualizer;
}

function loadButterchurnPreset({ index = 0, blendTime = BUTTERCHURN_BLEND_SECONDS } = {}) {
  const visualizer = ensureButterchurnVisualizer();
  if (!visualizer) return;

  const presetName = getButterchurnPresetAt(index);
  const preset = presetName ? butterchurnPresetMap[presetName] : null;
  if (!preset) return;

  visualizer.loadPreset(preset, butterchurnPresetLoaded.value ? blendTime : 0);
  butterchurnPresetLoaded.value = true;
  butterchurnPresetName.value = presetName;
}

function setButterchurnPreset(index, { blendTime = BUTTERCHURN_BLEND_SECONDS } = {}) {
  if (!butterchurnPresetNames.length) return;
  butterchurnDesiredIndex.value = index;
  butterchurnTrackStep = ((index % butterchurnPresetNames.length) + butterchurnPresetNames.length) % butterchurnPresetNames.length;
  loadButterchurnPreset({ index: butterchurnDesiredIndex.value, blendTime });
}

function getButterchurnPresetIndexByName(name) {
  const index = butterchurnPresetNames.indexOf(name);
  return index >= 0 ? index : 0;
}

function cycleButterchurnPreset(step = 1) {
  if (!butterchurnPresetNames.length) return;
  const baseIndex = butterchurnPresetIndex.value >= 0
    ? butterchurnPresetIndex.value
    : butterchurnDesiredIndex.value;
  setButterchurnPreset(baseIndex + step);
}

function getRandomButterchurnPresetIndex(excludeIndex = -1) {
  if (!butterchurnPresetNames.length) return -1;
  if (butterchurnPresetNames.length === 1) return 0;

  let nextIndex = excludeIndex;
  while (nextIndex === excludeIndex) {
    nextIndex = Math.floor(Math.random() * butterchurnPresetNames.length);
  }

  return nextIndex;
}

function advanceButterchurnPresetForTrack() {
  if (!state.currentTrack || !butterchurnPresetNames.length) return;
  if (butterchurnPresetMode.value === 'single') {
    setButterchurnPreset(getButterchurnPresetIndexByName(butterchurnPreset.value));
    return;
  }
  setButterchurnPreset(getRandomButterchurnPresetIndex(butterchurnPresetIndex.value));
}

function syncButterchurnPreset() {
  if (!state.currentTrack || !isButterchurnMode.value) return;

  if (butterchurnPresetMode.value === 'single') {
    const selectedIndex = getButterchurnPresetIndexByName(butterchurnPreset.value || DEFAULT_BUTTERCHURN_PRESET);
    if (!butterchurnPresetLoaded.value || butterchurnPresetIndex.value !== selectedIndex) {
      loadButterchurnPreset({ index: selectedIndex, blendTime: butterchurnPresetLoaded.value ? BUTTERCHURN_BLEND_SECONDS : 0 });
    }
    return;
  }

  if (!butterchurnPresetLoaded.value) {
    loadButterchurnPreset({ index: butterchurnDesiredIndex.value, blendTime: 0 });
    return;
  }

  if (butterchurnDesiredIndex.value !== butterchurnPresetIndex.value) {
    loadButterchurnPreset({ index: butterchurnDesiredIndex.value });
  }
}

function disposeButterchurnVisualizer() {
  if (!butterchurnVisualizer) return;

  const graph = getVisualizerGraph();
  if (butterchurnConnected && graph?.source) {
    try {
      butterchurnVisualizer.disconnectAudio(graph.source);
    } catch {
      // Ignore disconnect errors from stale audio graph nodes.
    }
  }

  butterchurnConnected = false;
  butterchurnPresetLoaded.value = false;
  butterchurnPresetIndex.value = -1;
  butterchurnTrackStep = 0;
  butterchurnDesiredIndex.value = 0;
  butterchurnPresetName.value = null;
  butterchurnWasPlaying = false;
  butterchurnVisualizer = null;
}

function clearButterchurnPresetTimer() {
  if (!butterchurnPresetTimer) return;
  window.clearInterval(butterchurnPresetTimer);
  butterchurnPresetTimer = 0;
}

function syncButterchurnPresetTimer() {
  clearButterchurnPresetTimer();
  if (
    !isButterchurnMode.value
    || butterchurnPresetMode.value !== 'random'
    || !randomizeOnNewTrack.value
    || !state.isPlaying
    || !state.currentTrack
  ) {
    return;
  }

  butterchurnPresetTimer = window.setInterval(() => {
    if (!state.isPlaying || !state.currentTrack || !isButterchurnMode.value) return;
    rotateButterchurnPreset();
    syncButterchurnPreset();
  }, BUTTERCHURN_ROTATE_MS);
}

function rotateButterchurnPreset() {
  if (
    !state.currentTrack
    || !randomizeOnNewTrack.value
    || butterchurnPresetMode.value !== 'random'
    || !butterchurnPresetNames.length
  ) return;
  setButterchurnPreset(getRandomButterchurnPresetIndex(butterchurnPresetIndex.value));
}

function clearButterchurnCanvas() {
  const canvas = butterchurnCanvasRef.value;
  if (!canvas) return;

  let gl = null;
  try {
    gl = canvas.getContext('webgl2');
  } catch {
    gl = null;
  }
  if (!gl) return;

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0745, 0.1412, 0.1843, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
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
  if (!artworkAccentColor.value) return [52, 211, 153];
  const parts = artworkAccentColor.value.split(',').map(Number);
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
  const container = containerRef.value;
  if (!container) return;

  const bounds = container.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const previousWidth = viewportWidth;
  const previousHeight = viewportHeight;

  viewportWidth = bounds.width;
  viewportHeight = bounds.height;

  if (!viewportWidth || !viewportHeight) return;

  const canvas2d = canvas2dRef.value;
  if (canvas2d) {
    canvas2d.width = Math.round(viewportWidth * dpr);
    canvas2d.height = Math.round(viewportHeight * dpr);

    ctx = canvas2d.getContext('2d');
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  } else {
    ctx = null;
  }

  const butterchurnCanvas = butterchurnCanvasRef.value;
  if (butterchurnCanvas) {
    butterchurnCanvas.width = Math.round(viewportWidth * dpr);
    butterchurnCanvas.height = Math.round(viewportHeight * dpr);
    ensureButterchurnVisualizer()?.setRendererSize(
      butterchurnCanvas.width,
      butterchurnCanvas.height,
    );
  }

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

function drawButterchurnFrame() {
  if (!state.currentTrack) {
    clearButterchurnCanvas();
    butterchurnWasPlaying = false;
    return;
  }

  syncButterchurnPreset();

  if (!state.isPlaying) {
    if (butterchurnWasPlaying) butterchurnVisualizer?.render();
    butterchurnWasPlaying = false;
    return;
  }

  ensureButterchurnVisualizer()?.render();
  butterchurnWasPlaying = true;
}

function render() {
  animationFrameId = window.requestAnimationFrame(render);
  if (!viewportWidth || !viewportHeight) return;

  if (isButterchurnMode.value) {
    drawButterchurnFrame();
    return;
  }

  if (!ctx) return;

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
  overlayVisible.value = true;
  scheduleOverlayHide();
  resizeCanvas();
}

function selectMode(mode) {
  setVizMode(mode);
  showModeDropdown.value = false;
  resetMotionState();
  paintBackground();
}

function clearOverlayHideTimer() {
  if (!overlayHideTimer) return;
  window.clearTimeout(overlayHideTimer);
  overlayHideTimer = 0;
}

function scheduleOverlayHide() {
  clearOverlayHideTimer();
  if (!isFullscreen.value || !hideChromeInFullscreen.value || showModeDropdown.value) return;
  overlayHideTimer = window.setTimeout(() => {
    overlayVisible.value = false;
  }, 1800);
}

function revealOverlay() {
  const now = Date.now();
  if (now - lastOverlayRevealAt < 120) return;
  lastOverlayRevealAt = now;
  overlayVisible.value = true;
  scheduleOverlayHide();
}

function setHideChromeInFullscreen(value) {
  hideChromeInFullscreen.value = Boolean(value);
  localStorage.setItem('noisling_viz_hide_fullscreen_chrome', String(hideChromeInFullscreen.value));
  revealOverlay();
}

function toggleButterchurnPresetShuffle() {
  const nextMode = butterchurnPresetMode.value === 'random' ? 'single' : 'random';
  if (nextMode === 'single') {
    const currentPreset = butterchurnPresetName.value
      ?? butterchurnPresetNames[butterchurnPresetIndex.value]
      ?? butterchurnPreset.value
      ?? DEFAULT_BUTTERCHURN_PRESET;
    persistButterchurnPreset(currentPreset);
  }
  setButterchurnPresetMode(nextMode);
}

function handleButterchurnPresetChange(event) {
  const nextPreset = event.target.value;
  persistButterchurnPreset(nextPreset);
}

watch(() => props.analyser, syncAnalyser);
watch(vizMode, () => {
  resetMotionState();
  ensureButterchurnVisualizer();
  resizeCanvas();
  paintBackground();
  syncButterchurnPreset();
  syncButterchurnPresetTimer();
});
watch(() => state.currentTrack?._id, (trackId, previousTrackId) => {
  if (!trackId || trackId === previousTrackId) {
    if (!trackId) clearButterchurnCanvas();
    syncButterchurnPresetTimer();
    return;
  }

  advanceButterchurnPresetForTrack();
  syncButterchurnPreset();
  syncButterchurnPresetTimer();
});
watch(() => state.isPlaying, () => {
  syncButterchurnPreset();
  syncButterchurnPresetTimer();
});
watch(randomizeOnNewTrack, () => {
  syncButterchurnPreset();
  syncButterchurnPresetTimer();
});
watch(butterchurnPresetMode, () => {
  syncButterchurnPreset();
  syncButterchurnPresetTimer();
});
watch(butterchurnPreset, () => {
  syncButterchurnPreset();
});
watch(showModeDropdown, (open) => {
  if (open) {
    revealOverlay();
    return;
  }
  scheduleOverlayHide();
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
  disposeButterchurnVisualizer();
  clearButterchurnPresetTimer();
  clearOverlayHideTimer();
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('visibilitychange', resumeVisualizerContext);
});
</script>

<template>
  <section
    ref="containerRef"
    class="visualizer relative flex-1 overflow-hidden bg-[#13242f] font-sans"
    :style="{ '--visualizer-nav-offset': isFullscreen ? '0px' : 'calc(env(safe-area-inset-top) + 3.5rem)' }"
    @pointermove="revealOverlay"
    @pointerdown="revealOverlay"
    @focusin="revealOverlay"
  >
    <canvas
      ref="canvas2dRef"
      class="relative z-0 block size-full"
      :class="currentMode.value === 'butterchurn' && 'hidden'"
    />
    <canvas
      ref="butterchurnCanvasRef"
      class="relative z-0 block size-full"
      :class="currentMode.value !== 'butterchurn' && 'hidden'"
    />
    <div
      v-if="currentMode.value === 'pills'"
      class="pointer-events-none absolute inset-0 z-[1] mix-blend-screen [background:radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.06),transparent_18%),radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.03),transparent_34%)]"
    />
    <div
      v-if="currentMode.value === 'pills' && pillsNoiseUrl"
      class="pointer-events-none absolute inset-0 z-[2] bg-[length:160px_160px] bg-repeat opacity-50 mix-blend-screen"
      :style="{ backgroundImage: `url(${pillsNoiseUrl})` }"
    />
    <div
      v-if="currentMode.value === 'pills'"
      class="pointer-events-none absolute inset-0 z-[3] opacity-[0.88] [background:radial-gradient(ellipse_at_center,rgba(0,0,0,0)_24%,rgba(0,0,0,0.92)_95%)]"
    />

    <div
      v-if="message"
      class="absolute left-1/2 top-1/2 z-[5] min-h-[60px] w-[min(360px,calc(100%-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-black/80 p-5 text-center uppercase text-white shadow-[0_2px_4px_rgba(0,0,0,0.2)]"
    >
      <h1 class="my-[10px] text-[1.65rem] font-light leading-[1.2]">{{ message.title }}</h1>
      <h2 class="my-[10px] text-[0.82rem] font-normal leading-[1.2] tracking-[0.06em] text-white/80">
        {{ message.body }}
      </h2>
    </div>

    <a
      v-if="currentMode.credit"
      :href="currentMode.credit.url"
      target="_blank"
      rel="noopener noreferrer"
      class="absolute left-[0.65rem] top-[calc(var(--visualizer-nav-offset)+0.65rem)] z-[5] inline-flex min-h-[1.85rem] max-w-[7.5rem] items-center overflow-hidden rounded-full border border-white/10 bg-[rgba(5,7,10,0.24)] px-[0.58rem] py-[0.34rem] text-[0.68rem] tracking-[0.03em] text-zinc-100/65 no-underline text-ellipsis whitespace-nowrap shadow-[0_12px_30px_rgba(0,0,0,0.14)] backdrop-blur-[14px] backdrop-saturate-[120%] transition-[opacity,transform,background-color,color] duration-180 ease-out hover:bg-[rgba(5,7,10,0.42)] hover:text-zinc-50/90 sm:left-[0.8rem] sm:top-[calc(var(--visualizer-nav-offset)+0.8rem)] sm:max-w-[min(32vw,12rem)]"
      :class="!shouldShowOverlay && 'pointer-events-none -translate-y-2 opacity-0'"
    >
      {{ currentMode.credit.label }}
    </a>

    <div
      class="absolute right-[0.65rem] top-[calc(var(--visualizer-nav-offset)+0.65rem)] z-[5] flex items-center gap-[0.45rem] transition-[opacity,transform] duration-180 ease-out sm:right-[0.8rem] sm:top-[calc(var(--visualizer-nav-offset)+0.8rem)]"
      :class="!shouldShowOverlay && 'pointer-events-none -translate-y-2 opacity-0'"
    >
      <button
        type="button"
        class="z-[4] inline-flex size-[2.2rem] items-center justify-center rounded-full border border-white/10 bg-[rgba(5,7,10,0.22)] text-white/70 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-[14px] transition-[background-color,border-color,color] duration-150 ease-out hover:border-white/20 hover:bg-[rgba(5,7,10,0.42)] hover:text-white"
        :class="showModeDropdown && 'border-white/20 bg-[rgba(5,7,10,0.42)] text-white'"
        title="Visualizer mode"
        @click="showModeDropdown = !showModeDropdown"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="size-4 fill-none stroke-current stroke-2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </button>

      <div
        v-if="showModeDropdown"
        class="absolute right-0 top-[calc(100%+0.65rem)] flex min-w-[min(260px,calc(100vw-1.3rem))] flex-col gap-1 rounded-[0.95rem] border border-white/10 bg-zinc-950/90 p-1 shadow-[0_24px_60px_rgba(0,0,0,0.38)] backdrop-blur-[18px] sm:min-w-[260px]"
      >
        <div class="px-3 py-[0.45rem] pb-[0.2rem] text-[0.66rem] font-semibold uppercase tracking-[0.08em] text-zinc-400/90">
          Mode
        </div>
        <template v-for="option in VIZ_OPTIONS" :key="option.value">
          <div
            role="button"
            tabindex="0"
            class="relative flex w-full items-center gap-[0.65rem] rounded-[0.7rem] px-3 py-[0.65rem] text-left text-[0.8rem] text-zinc-300/85 transition-[background-color,color] duration-150 ease-out hover:bg-zinc-800/95 hover:text-zinc-50"
            :class="currentMode.value === option.value && 'bg-zinc-800/95 text-zinc-50'"
            @click="selectMode(option.value)"
            @keydown.enter.prevent="selectMode(option.value)"
            @keydown.space.prevent="selectMode(option.value)"
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              class="size-[0.95rem] shrink-0 fill-none stroke-current stroke-2"
              v-html="option.icon"
            />
            <span
              class="min-w-0 flex-1"
              :class="option.value === 'butterchurn' && 'pr-8'"
            >
              {{ option.label }}
            </span>
            <button
              v-if="option.value === 'butterchurn'"
              type="button"
              class="absolute right-3 top-1/2 inline-flex size-[1.75rem] -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-black/15 p-0 text-zinc-300/85 transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out hover:border-white/20 hover:bg-black/30 hover:text-white"
              :title="butterchurnPresetMode === 'random' ? 'Shuffle presets on' : 'Shuffle presets off'"
              :style="butterchurnPresetMode === 'random'
                ? {
                    borderColor: `rgba(${accentRgb}, 0.55)`,
                    backgroundColor: `rgba(${accentRgb}, 0.18)`,
                    color: `rgb(${accentRgb})`,
                    boxShadow: `inset 0 0 0 1px rgba(${accentRgb}, 0.18)`,
                  }
                : null"
              @click.stop="toggleButterchurnPresetShuffle"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" class="size-[0.92rem] shrink-0 fill-none stroke-current stroke-2">
                <path d="M16 3h5v5" />
                <path d="M4 20 20 4" />
                <path d="M21 16v5h-5" />
                <path d="M15 15 21 21" />
                <path d="M4 4l5 5" />
              </svg>
            </button>
          </div>

          <div
            v-if="option.value === 'butterchurn' && showButterchurnPresetPicker"
            class="flex flex-col gap-2 px-3 pb-[0.35rem] pt-[0.1rem]"
          >
            <label for="butterchurn-preset-picker" class="text-[0.68rem] font-medium uppercase tracking-[0.08em] text-zinc-400/90">
              Butterchurn Preset
            </label>
            <div class="relative">
              <select
                id="butterchurn-preset-picker"
                :value="butterchurnPreset"
                class="w-full appearance-none rounded-[0.7rem] border border-white/10 bg-zinc-900/90 px-3 py-[0.65rem] pr-10 text-[0.8rem] text-zinc-200 outline-none transition-[border-color,background-color,color] duration-150 ease-out hover:border-white/20 focus:border-white/25"
                @click.stop
                @change="handleButterchurnPresetChange"
              >
                <option
                  v-for="presetOption in butterchurnPresetOptions"
                  :key="presetOption.value"
                  :value="presetOption.value"
                >
                  {{ presetOption.label }}
                </option>
              </select>
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
                class="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 fill-none stroke-zinc-400 stroke-2"
              >
                <path d="m7 10 5 5 5-5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </div>
          </div>
        </template>

        <button
          type="button"
          class="mt-[0.2rem] flex w-full items-center gap-[0.65rem] border-t border-white/10 rounded-[0.7rem] px-3 py-[0.65rem] text-left text-[0.8rem] text-zinc-300/85 transition-[background-color,color] duration-150 ease-out hover:bg-zinc-800/95 hover:text-zinc-50"
          :class="hideChromeInFullscreen && 'rounded-[0.7rem] bg-zinc-800/95 text-zinc-50'"
          @click="setHideChromeInFullscreen(!hideChromeInFullscreen)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" class="size-[0.95rem] shrink-0 fill-none stroke-current stroke-2">
            <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <span>Hide in fullscreen</span>
        </button>

      </div>

      <button
        type="button"
        class="z-[4] inline-flex size-[2.2rem] items-center justify-center rounded-full border border-white/10 bg-[rgba(5,7,10,0.22)] text-white/70 shadow-[0_10px_24px_rgba(0,0,0,0.12)] backdrop-blur-[14px] transition-[background-color,border-color,color] duration-150 ease-out hover:border-white/20 hover:bg-[rgba(5,7,10,0.42)] hover:text-white"
        :title="isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'"
        @click="toggleFullscreen"
      >
        <svg v-if="!isFullscreen" viewBox="0 0 24 24" aria-hidden="true" class="size-4 fill-none stroke-current stroke-2">
          <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
        </svg>
        <svg v-else viewBox="0 0 24 24" aria-hidden="true" class="size-4 fill-none stroke-current stroke-2">
          <path d="M4 14h6v6M14 4h6v6M14 10l7-7M3 21l7-7" />
        </svg>
      </button>
    </div>

    <div v-if="showModeDropdown" class="absolute inset-0 z-[3]" @click="showModeDropdown = false" />
  </section>
</template>

<style scoped>
.visualizer {
  min-height: calc(100vh - 5.5rem);
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

.visualizer:fullscreen {
  min-height: 100vh;
}
</style>
