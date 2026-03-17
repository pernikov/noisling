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
    value: 'pills',
    label: 'Pills',
    icon: '<path d="M7 16l4-8M13 16l4-8M6 12h12" stroke-linecap="round"/>',
    credit: {
      label: 'Inspired by soulwire',
      url: 'https://codepen.io/soulwire/pen/kGjRpg',
    },
  },
  {
    value: 'nucleus',
    label: 'Nucleus',
    icon: '<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke-linecap="round"/>',
    credit: {
      label: 'Inspired by Wael Yasmina',
      url: 'https://github.com/WaelYasmina/audiovisualizer',
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
const CANVAS_MODE_TRANSITION_MS = 650;
const HIDE_CHROME_STORAGE_KEY = 'noisling_viz_hide_chrome';
const LEGACY_HIDE_CHROME_STORAGE_KEY = 'noisling_viz_hide_fullscreen_chrome';
const butterchurnPresetMap = butterchurnPresets.getPresets();
const butterchurnPresetNames = BUTTERCHURN_PRESET_OPTIONS
  .map(option => option.value)
  .filter(name => butterchurnPresetMap[name]);
const butterchurnPresetOptions = BUTTERCHURN_PRESET_OPTIONS
  .filter(option => butterchurnPresetMap[option.value]);

const containerRef = ref(null);
const pillsCanvasRef = ref(null);
const butterchurnCanvasRef = ref(null);
const nucleusCanvasRef = ref(null);
const analyserRef = shallowRef(null);
const isFullscreen = ref(false);
const showModeDropdown = ref(false);
const pillsNoiseUrl = ref('');
const hideChrome = ref(
  (
    localStorage.getItem(HIDE_CHROME_STORAGE_KEY)
    ?? localStorage.getItem(LEGACY_HIDE_CHROME_STORAGE_KEY)
    ?? 'true'
  ) === 'true'
);
const overlayVisible = ref(true);

const { state, getVisualizerAnalyser, getVisualizerGraph, resumeVisualizerContext } = usePlayer();
const { accentColor: artworkAccentColor, accentPalette: artworkAccentPalette } = useAccentColor();
const {
  accentRgb,
  vizMode,
  randomizeOnNewTrack,
  butterchurnPresetMode,
  butterchurnPreset,
  setButterchurnPreset: persistButterchurnPreset,
  setButterchurnPresetMode,
  setVizMode,
  setRandomizeOnNewTrack,
} = useTheme();
const activeCanvasMode = ref(vizMode.value);
const fadingCanvasMode = ref(null);
const nucleusRevealProgress = ref(0);
const modeTransitionProgress = ref(1);
const modeTransitionDecay = ref(0);

let ctx = null;
let pillsCtx = null;
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
let smoothRms = 0;
let prevBass = 0;
let beatBoost = 0;
let overlayHideTimer = 0;
let lastOverlayRevealAt = 0;
let butterchurnVisualizer = null;
let butterchurnConnected = false;
let butterchurnSupported = null;
let orbRenderer = null;
let orbComposer = null;
let orbScene = null;
let orbCamera = null;
let orbMesh = null;
let orbAuraMesh = null;
let orbBackGlowMesh = null;
let orbPointLight = null;
let orbClock = null;
let orbSupported = null;
let smoothNucleusFrequency = 0;
let nucleusBeatPulse = 0;
let smoothNucleusBody = 0;
let smoothNucleusDetail = 0;
let nucleusBackdropPulse = 0;
let prevFrequencyFrame = null;
let orbThree = null;
let orbEffectComposerCtor = null;
let orbRenderPassCtor = null;
let orbUnrealBloomPassCtor = null;
let orbOutputPassCtor = null;
let orbBloomPass = null;
let orbModulePromise = null;
const butterchurnPresetLoaded = ref(false);
const butterchurnPresetName = ref(null);
let butterchurnWasPlaying = false;
let butterchurnPauseFade = 1;
const butterchurnPresetIndex = ref(-1);
let butterchurnTrackStep = 0;
const butterchurnDesiredIndex = ref(0);
let modeTransitionTimer = 0;
let modeTransitionStartedAt = 0;

const currentMode = computed(() =>
  VIZ_OPTIONS.find(option => option.value === vizMode.value) ?? VIZ_OPTIONS[0]
);
const isButterchurnMode = computed(() => currentMode.value.value === 'butterchurn');
const isNucleusMode = computed(() => currentMode.value.value === 'nucleus');
const shouldShuffleVisualizerModes = computed(() => randomizeOnNewTrack.value);
const shouldRandomizeButterchurnPresets = computed(() => butterchurnPresetMode.value === 'random');
const showButterchurnPresetPicker = computed(() => (
  butterchurnPresetMode.value === 'single'
));
const nucleusBackdropStyle = computed(() => {
  const pulse = clamp01(nucleusBackdropPulse);
  const [primary, secondary = primary] = getArtworkPalette();
  const reveal = activeCanvasMode.value === 'nucleus'
    ? smoothstep(0, 1, nucleusRevealProgress.value)
    : 1;
  const glowReveal = smoothstep(0.9, 0.995, reveal);
  const coreAlpha = (0.022 + pulse * 0.12) * glowReveal;
  const haloAlpha = (0.018 + pulse * 0.1) * glowReveal;
  return {
    opacity: isCanvasVisible('nucleus') ? glowReveal : 0,
    transform: `scale(${0.996 + glowReveal * 0.004 + pulse * 0.018})`,
    background: `radial-gradient(circle at 44% 42%, rgba(${primary.join(', ')}, ${coreAlpha}) 0%, rgba(${secondary.join(', ')}, ${haloAlpha}) 28%, rgba(${secondary.join(', ')}, 0) 62%)`,
  };
});
const nucleusCanvasStyle = computed(() => {
  const reveal = activeCanvasMode.value === 'nucleus'
    ? smoothstep(0, 1, nucleusRevealProgress.value)
    : 1;
  return {
    opacity: isCanvasVisible('nucleus') ? reveal : 0,
    transform: `scale(${1.06 - reveal * 0.06})`,
  };
});
const nucleusVignetteStyle = computed(() => {
  const reveal = activeCanvasMode.value === 'nucleus'
    ? smoothstep(0, 1, nucleusRevealProgress.value)
    : 1;
  return {
    opacity: 0.82 * smoothstep(0.7, 0.96, reveal),
  };
});
const visualizerStyle = computed(() => ({
  '--visualizer-nav-offset': isFullscreen.value ? '0px' : 'calc(env(safe-area-inset-top) + 3.5rem)',
  backgroundColor: '#13242f',
}));
const butterchurnPauseFadeStyle = computed(() => ({
  opacity: getModeLayerOpacity('butterchurn', butterchurnPauseFade),
}));
const pillsGlowStyle = computed(() => ({
  opacity: getModeLayerOpacity('pills'),
}));
const pillsNoiseStyle = computed(() => ({
  opacity: getModeLayerOpacity('pills', 0.5),
  backgroundImage: pillsNoiseUrl.value ? `url(${pillsNoiseUrl.value})` : 'none',
}));
const pillsVignetteStyle = computed(() => ({
  opacity: getModeLayerOpacity('pills', 0.88),
}));

const shouldShowOverlay = computed(() => {
  if (showModeDropdown.value) return true;
  if (!hideChrome.value) return true;
  return overlayVisible.value;
});
const message = computed(() => {
  if (isButterchurnMode.value && !isButterchurnAvailable()) {
    return {
      title: 'Butterchurn unavailable',
      body: 'This browser does not expose the shared Web Audio graph with WebGL 2 support.',
    };
  }

  if (isNucleusMode.value && !isNucleusAvailable()) {
    return {
      title: 'Nucleus unavailable',
      body: 'This browser does not expose the WebGL renderer needed for the Nucleus visualizer.',
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

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function compress01(value, strength = 1) {
  const safe = Math.max(0, value);
  return 1 - Math.exp(-safe * strength);
}

function approachAsymmetric(current, target, attack, release) {
  const factor = target > current ? attack : release;
  return current + (target - current) * factor;
}

function getFrequencyBandLevel(minHz, maxHz, sampleRate) {
  if (!frequencyData?.length || !sampleRate) return 0;

  const nyquist = sampleRate / 2;
  const minIndex = Math.max(0, Math.floor((minHz / nyquist) * frequencyData.length));
  const maxIndex = Math.min(
    frequencyData.length - 1,
    Math.ceil((maxHz / nyquist) * frequencyData.length),
  );

  if (maxIndex < minIndex) return 0;

  let total = 0;
  for (let index = minIndex; index <= maxIndex; index += 1) total += frequencyData[index];
  return total / Math.max(1, maxIndex - minIndex + 1) / 255;
}

function getButterchurnPresetAt(index) {
  if (!butterchurnPresetNames.length) return null;
  const safeIndex = ((index % butterchurnPresetNames.length) + butterchurnPresetNames.length) % butterchurnPresetNames.length;
  butterchurnPresetIndex.value = safeIndex;
  return butterchurnPresetNames[safeIndex];
}

function getRandomVizModeValue(excludeValue = null) {
  if (!VIZ_OPTIONS.length) return null;
  if (VIZ_OPTIONS.length === 1) return VIZ_OPTIONS[0].value;

  let nextValue = excludeValue;
  while (nextValue === excludeValue) {
    nextValue = VIZ_OPTIONS[Math.floor(Math.random() * VIZ_OPTIONS.length)]?.value ?? null;
  }

  return nextValue;
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

function ensureButterchurnVisualizer({ allowInactive = false } = {}) {
  if ((!allowInactive && !isButterchurnMode.value) || !isButterchurnAvailable()) return null;

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

function getNucleusVertexShader() {
  return `
    uniform float uTime;
    uniform float uFrequency;

    vec3 mod289(vec3 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 mod289(vec4 x) {
      return x - floor(x * (1.0 / 289.0)) * 289.0;
    }

    vec4 permute(vec4 x) {
      return mod289(((x * 34.0) + 10.0) * x);
    }

    vec4 taylorInvSqrt(vec4 r) {
      return 1.79284291400159 - 0.85373472095314 * r;
    }

    vec3 fade(vec3 t) {
      return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
    }

    float pnoise(vec3 P, vec3 rep) {
      vec3 Pi0 = mod(floor(P), rep);
      vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
      Pi0 = mod289(Pi0);
      Pi1 = mod289(Pi1);
      vec3 Pf0 = fract(P);
      vec3 Pf1 = Pf0 - vec3(1.0);
      vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
      vec4 iy = vec4(Pi0.yy, Pi1.yy);
      vec4 iz0 = Pi0.zzzz;
      vec4 iz1 = Pi1.zzzz;

      vec4 ixy = permute(permute(ix) + iy);
      vec4 ixy0 = permute(ixy + iz0);
      vec4 ixy1 = permute(ixy + iz1);

      vec4 gx0 = ixy0 * (1.0 / 7.0);
      vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
      gx0 = fract(gx0);
      vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
      vec4 sz0 = step(gz0, vec4(0.0));
      gx0 -= sz0 * (step(0.0, gx0) - 0.5);
      gy0 -= sz0 * (step(0.0, gy0) - 0.5);

      vec4 gx1 = ixy1 * (1.0 / 7.0);
      vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
      gx1 = fract(gx1);
      vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
      vec4 sz1 = step(gz1, vec4(0.0));
      gx1 -= sz1 * (step(0.0, gx1) - 0.5);
      gy1 -= sz1 * (step(0.0, gy1) - 0.5);

      vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
      vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
      vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
      vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
      vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
      vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
      vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
      vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

      vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
      g000 *= norm0.x;
      g010 *= norm0.y;
      g100 *= norm0.z;
      g110 *= norm0.w;
      vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
      g001 *= norm1.x;
      g011 *= norm1.y;
      g101 *= norm1.z;
      g111 *= norm1.w;

      float n000 = dot(g000, Pf0);
      float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
      float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
      float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
      float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
      float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
      float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
      float n111 = dot(g111, Pf1);

      vec3 fade_xyz = fade(Pf0);
      vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
      vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
      float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
      return 2.2 * n_xyz;
    }

    void main() {
      float noise = 3.0 * pnoise(position + uTime, vec3(10.0));
      float displacement = (uFrequency / 30.0) * (noise / 10.0);
      vec3 newPosition = position + normal * displacement;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
    }
  `;
}

function getNucleusFragmentShader() {
  return `
    uniform vec3 uAccent;

    void main() {
      gl_FragColor = vec4(uAccent, 1.0);
    }
  `;
}

function isNucleusAvailable() {
  if (orbSupported !== null) return orbSupported;
  if (typeof document === 'undefined') {
    orbSupported = false;
    return orbSupported;
  }

  const canvas = document.createElement('canvas');
  let gl = null;

  try {
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  } catch {
    gl = null;
  }

  orbSupported = Boolean(gl);
  return orbSupported;
}

async function loadNucleusModules() {
  if (orbThree && orbEffectComposerCtor && orbRenderPassCtor && orbUnrealBloomPassCtor && orbOutputPassCtor) return;
  if (!orbModulePromise) {
    orbModulePromise = Promise.all([
      import('three'),
      import('three/examples/jsm/postprocessing/EffectComposer.js'),
      import('three/examples/jsm/postprocessing/RenderPass.js'),
      import('three/examples/jsm/postprocessing/UnrealBloomPass.js'),
      import('three/examples/jsm/postprocessing/OutputPass.js'),
    ]).then(([threeModule, composerModule, renderPassModule, bloomPassModule, outputPassModule]) => {
      orbThree = threeModule;
      orbEffectComposerCtor = composerModule.EffectComposer;
      orbRenderPassCtor = renderPassModule.RenderPass;
      orbUnrealBloomPassCtor = bloomPassModule.UnrealBloomPass;
      orbOutputPassCtor = outputPassModule.OutputPass;
    });
  }
  await orbModulePromise;
}

function preloadNucleusVisualizer() {
  if (!isNucleusAvailable()) return;
  void loadNucleusModules()
    .then(() => {
      if (!isNucleusMode.value) return;
      ensureNucleusVisualizer();
      resizeCanvas();
    })
    .catch(() => {
      orbSupported = false;
    });
}

function disposeThreeObject(object) {
  if (!object) return;
  object.geometry?.dispose?.();
  if (Array.isArray(object.material)) {
    for (const material of object.material) material?.dispose?.();
    return;
  }
  object.material?.dispose?.();
}

function ensureNucleusVisualizer({ allowInactive = false } = {}) {
  if ((!allowInactive && !isNucleusMode.value) || !isNucleusAvailable()) return null;
  if (!orbThree || !orbEffectComposerCtor || !orbRenderPassCtor || !orbUnrealBloomPassCtor || !orbOutputPassCtor) {
    preloadNucleusVisualizer();
    return null;
  }

  const canvas = nucleusCanvasRef.value;
  if (!canvas) return null;

  if (!orbRenderer) {
    orbRenderer = new orbThree.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    orbRenderer.outputColorSpace = orbThree.SRGBColorSpace;
    orbRenderer.setClearColor(0x000000, 1);

    orbScene = new orbThree.Scene();
    orbCamera = new orbThree.PerspectiveCamera(45, 1, 0.1, 100);
    orbCamera.position.set(0, -2, 14);

    const uniforms = {
      uTime: { value: 0 },
      uFrequency: { value: 0 },
      uAccent: { value: new orbThree.Color(0x34d399) },
    };

    orbMesh = new orbThree.Mesh(
      new orbThree.IcosahedronGeometry(4, 30),
      new orbThree.ShaderMaterial({
        uniforms,
        vertexShader: getNucleusVertexShader(),
        fragmentShader: getNucleusFragmentShader(),
        wireframe: true,
        transparent: false,
      }),
    );
    orbScene.add(orbMesh);

    orbComposer = new orbEffectComposerCtor(orbRenderer);
    orbComposer.addPass(new orbRenderPassCtor(orbScene, orbCamera));
    orbBloomPass = new orbUnrealBloomPassCtor(
      new orbThree.Vector2(Math.max(1, viewportWidth), Math.max(1, viewportHeight)),
      0.5,
      0.5,
      0.8,
    );
    orbBloomPass.threshold = 0.46;
    orbBloomPass.strength = 0.5;
    orbBloomPass.radius = 0.8;
    orbComposer.addPass(orbBloomPass);
    orbComposer.addPass(new orbOutputPassCtor());

    orbClock = new orbThree.Clock();
  }

  return {
    renderer: orbRenderer,
    composer: orbComposer,
    scene: orbScene,
    camera: orbCamera,
    mesh: orbMesh,
    auraMesh: orbAuraMesh,
    backGlowMesh: orbBackGlowMesh,
    pointLight: orbPointLight,
    clock: orbClock,
  };
}

function clearModeTransitionTimer() {
  if (!modeTransitionTimer) return;
  window.clearTimeout(modeTransitionTimer);
  modeTransitionTimer = 0;
}

function isCanvasVisible(mode) {
  return activeCanvasMode.value === mode || fadingCanvasMode.value === mode;
}

function getModeLayerOpacity(mode, maxOpacity = 1) {
  if (activeCanvasMode.value === mode) {
    const activeOpacity = fadingCanvasMode.value ? modeTransitionProgress.value : 1;
    return activeOpacity * maxOpacity;
  }
  if (fadingCanvasMode.value === mode) {
    return modeTransitionDecay.value * maxOpacity;
  }
  return 0;
}

function transitionCanvasMode(nextMode, previousMode = activeCanvasMode.value) {
  if (nextMode === previousMode) {
    activeCanvasMode.value = nextMode;
    if (nextMode === 'nucleus') nucleusRevealProgress.value = 0;
    return;
  }

  if (nextMode === 'nucleus') nucleusRevealProgress.value = 0;
  activeCanvasMode.value = nextMode;
  fadingCanvasMode.value = previousMode;
  modeTransitionStartedAt = window.performance?.now?.() ?? Date.now();
  clearModeTransitionTimer();
  modeTransitionTimer = window.setTimeout(() => {
    fadingCanvasMode.value = null;
    modeTransitionStartedAt = 0;
    modeTransitionTimer = 0;
  }, CANVAS_MODE_TRANSITION_MS);
}

function getTransitionDecay(now = window.performance?.now?.() ?? Date.now()) {
  if (!fadingCanvasMode.value || !modeTransitionStartedAt) return 0;
  const elapsed = now - modeTransitionStartedAt;
  return 1 - clamp01(elapsed / CANVAS_MODE_TRANSITION_MS);
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
  if (!shouldRandomizeButterchurnPresets.value) {
    setButterchurnPreset(getButterchurnPresetIndexByName(butterchurnPreset.value));
    return;
  }
  setButterchurnPreset(getRandomButterchurnPresetIndex(butterchurnPresetIndex.value));
}

function syncButterchurnPreset() {
  if (!state.currentTrack || !isButterchurnMode.value) return;

  if (!shouldRandomizeButterchurnPresets.value) {
    const selectedIndex = getButterchurnPresetIndexByName(butterchurnPreset.value || DEFAULT_BUTTERCHURN_PRESET);
    if (!butterchurnPresetLoaded.value || butterchurnPresetIndex.value !== selectedIndex) {
      loadButterchurnPreset({ index: selectedIndex, blendTime: butterchurnPresetLoaded.value ? BUTTERCHURN_BLEND_SECONDS : 0 });
    }
    return;
  }

  if (!butterchurnPresetLoaded.value) {
    const initialIndex = getRandomButterchurnPresetIndex();
    butterchurnDesiredIndex.value = initialIndex;
    loadButterchurnPreset({ index: initialIndex, blendTime: 0 });
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
  butterchurnPauseFade = 1;
  butterchurnVisualizer = null;
}

function disposeNucleusVisualizer() {
  orbComposer?.dispose?.();
  orbComposer = null;
  orbBloomPass = null;
  disposeThreeObject(orbMesh);
  disposeThreeObject(orbAuraMesh);
  disposeThreeObject(orbBackGlowMesh);
  orbMesh = null;
  orbAuraMesh = null;
  orbBackGlowMesh = null;
  orbPointLight = null;
  orbScene = null;
  orbCamera = null;
  orbClock = null;
  if (orbRenderer) {
    orbRenderer.dispose();
    orbRenderer = null;
  }
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

function getArtworkPalette() {
  const parsed = (artworkAccentPalette.value ?? [])
    .map(color => color.split(',').map(part => Number(part.trim())))
    .filter(parts => parts.length === 3 && parts.every(value => Number.isFinite(value)));
  return parsed.length ? parsed : [getAccentRgb()];
}

function getVisualizerPalette() {
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
  prevFrequencyFrame = frequencyData ? new Uint8Array(frequencyData.length) : null;
}

function resetMotionState() {
  smoothBass = 0;
  smoothMid = 0;
  smoothHigh = 0;
  smoothRms = 0;
  smoothNucleusFrequency = 0;
  nucleusBeatPulse = 0;
  smoothNucleusBody = 0;
  smoothNucleusDetail = 0;
  nucleusBackdropPulse = 0;
  prevBass = 0;
  beatBoost = 0;
  visualTime = 0;
  prevFrequencyFrame?.fill(0);
  if (orbMesh) orbMesh.scale.setScalar(1);
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

  const setCanvasContext = (canvas) => {
    if (!canvas) return null;
    canvas.width = Math.round(viewportWidth * dpr);
    canvas.height = Math.round(viewportHeight * dpr);
    const context = canvas.getContext('2d');
    context?.setTransform(dpr, 0, 0, dpr, 0, 0);
    return context;
  };

  pillsCtx = setCanvasContext(pillsCanvasRef.value);
  ctx = pillsCtx;

  const butterchurnCanvas = butterchurnCanvasRef.value;
  if (butterchurnCanvas) {
    butterchurnCanvas.width = Math.round(viewportWidth * dpr);
    butterchurnCanvas.height = Math.round(viewportHeight * dpr);
    ensureButterchurnVisualizer()?.setRendererSize(
      butterchurnCanvas.width,
      butterchurnCanvas.height,
    );
  }

  const nucleusCanvas = nucleusCanvasRef.value;
  if (nucleusCanvas) {
    nucleusCanvas.width = Math.round(viewportWidth * dpr);
    nucleusCanvas.height = Math.round(viewportHeight * dpr);
    const orb = ensureNucleusVisualizer();
    if (orb) {
      orb.renderer.setPixelRatio(dpr);
      orb.renderer.setSize(viewportWidth, viewportHeight, false);
      orb.composer.setSize(viewportWidth, viewportHeight);
      orb.camera.aspect = viewportWidth / viewportHeight;
      orb.camera.updateProjectionMatrix();
    }
  }

  resizePills(previousWidth, previousHeight);
  paintBackground(pillsCtx);
}

function paintBackground(targetCtx = ctx) {
  if (!targetCtx) return;
  targetCtx.globalCompositeOperation = 'source-over';
  targetCtx.clearRect(0, 0, viewportWidth, viewportHeight);
  targetCtx.fillStyle = '#13242f';
  targetCtx.fillRect(0, 0, viewportWidth, viewportHeight);
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
  if (delta > 0.022) beatBoost = Math.min(1, beatBoost + delta * 3.6);
  beatBoost *= 0.84;
  prevBass = rawBass;
}

function analyzeAudioFrame() {
  if (!analyserRef.value || !frequencyData || !timeDomainData) return null;

  analyserRef.value.getByteFrequencyData(frequencyData);
  analyserRef.value.getFloatTimeDomainData(timeDomainData);
  const sampleRate = analyserRef.value.context?.sampleRate ?? 44100;
  const bass = getFrequencyBandLevel(20, 180, sampleRate);
  const mid = getFrequencyBandLevel(180, 1800, sampleRate);
  const high = getFrequencyBandLevel(1800, 12000, sampleRate);
  const presence = getFrequencyBandLevel(2500, 7000, sampleRate);

  let rms = 0;
  for (let index = 0; index < timeDomainData.length; index += 1) {
    const sample = timeDomainData[index] || 0;
    rms += sample * sample;
  }
  rms = Math.sqrt(rms / Math.max(1, timeDomainData.length));

  if (!prevFrequencyFrame || prevFrequencyFrame.length !== frequencyData.length) {
    prevFrequencyFrame = new Uint8Array(frequencyData.length);
  }

  let flux = 0;
  let fluxBins = 0;
  for (let index = 1; index < frequencyData.length; index += 2) {
    const current = frequencyData[index] / 255;
    const previous = prevFrequencyFrame[index] / 255;
    if (current > previous) flux += current - previous;
    prevFrequencyFrame[index] = frequencyData[index];
    fluxBins += 1;
  }
  flux /= Math.max(1, fluxBins);

  smoothBass += (bass - smoothBass) * 0.18;
  smoothMid += (mid - smoothMid) * 0.15;
  smoothHigh += (high - smoothHigh) * 0.12;
  smoothRms += (rms - smoothRms) * 0.18;
  updateBeatBoost(bass);

  const transient = clamp01(
    beatBoost * 0.54
    + Math.max(0, rms - smoothRms) * 1.9
    + flux * 1.65,
  );

  return {
    bass,
    mid,
    high,
    presence,
    rms,
    flux,
    transient,
    energy: (smoothBass + smoothMid + smoothHigh) / 3,
  };
}

function drawPillsFrame({ decay = 1 } = {}) {
  const motionDecay = 0.28 + decay * 0.72;
  visualTime += 0.016 * motionDecay;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = state.isPlaying ? 'rgba(19, 36, 47, 0.42)' : 'rgba(19, 36, 47, 0.66)';
  ctx.fillRect(0, 0, viewportWidth, viewportHeight);

  let averageEnergy = 0;
  const palette = getVisualizerPalette();

  if (state.isPlaying && analyserRef.value && frequencyData) {
    analyserRef.value.getByteFrequencyData(frequencyData);
    for (let index = 0; index < pillsParticles.length; index += 1) {
      const particle = pillsParticles[index];
      particle.energy = (frequencyData[Math.min(particle.band, frequencyData.length - 1)] / 256) * motionDecay;
      averageEnergy += particle.energy;
    }
    averageEnergy /= Math.max(1, pillsParticles.length);
    if (averageEnergy < 0.012) coolPills();
  } else {
    coolPills();
    for (let index = 0; index < pillsParticles.length; index += 1) {
      const particle = pillsParticles[index];
      const isIdleAnchor = index % 12 === 0;
      const idleEnergy = 0.026
        + ((Math.sin(
          visualTime * (0.35 + particle.speed * 0.06)
          + particle.band * 0.31
          + particle.x * 0.002,
        ) + 1) * 0.5) * 0.04;
      const anchorEnergy = 0.24
        + ((Math.sin(
          visualTime * (0.55 + particle.speed * 0.08)
          + particle.band * 0.47
          + particle.rotation,
        ) + 1) * 0.5) * 0.16;
      particle.energy = Math.max(particle.energy, isIdleAnchor ? anchorEnergy : idleEnergy);
    }
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
    const verticalSpeed = state.isPlaying
      ? particle.speed * particle.level * (0.45 + motionDecay * 0.55)
      : particle.speed * particle.level * 0.28;
    particle.y -= verticalSpeed;

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
    ctx.globalAlpha = Math.min(0.4, particle.smoothedAlpha / (particle.level * 1.65)) * motionDecay;
    const [r, g, b] = palette[particle.colorIndex % palette.length];
    ctx.strokeStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.stroke();
    ctx.restore();
  }

  ctx.globalCompositeOperation = 'source-over';
}

function drawButterchurnFrame({ allowInactive = false } = {}) {
  if (!state.currentTrack) {
    clearButterchurnCanvas();
    butterchurnWasPlaying = false;
    butterchurnPauseFade += (1 - butterchurnPauseFade) * 0.12;
    return;
  }

  syncButterchurnPreset();

  if (!state.isPlaying) {
    ensureButterchurnVisualizer({ allowInactive })?.render();
    butterchurnWasPlaying = false;
    butterchurnPauseFade += (0.72 - butterchurnPauseFade) * 0.08;
    return;
  }

  ensureButterchurnVisualizer({ allowInactive })?.render();
  butterchurnWasPlaying = true;
  butterchurnPauseFade += (0 - butterchurnPauseFade) * 0.14;
}

function drawNucleusFrame({ allowInactive = false, decay = 1 } = {}) {
  const orb = ensureNucleusVisualizer({ allowInactive });
  if (!orb) return;
  const motionDecay = 0.24 + decay * 0.76;

  nucleusRevealProgress.value += (1 - nucleusRevealProgress.value) * 0.24;

  const analysis = analyzeAudioFrame();
  const [primaryRgb, secondaryRgb = primaryRgb] = getArtworkPalette();
  const primaryColor = new orbThree.Color(`rgb(${primaryRgb.join(', ')})`);
  const secondaryColor = new orbThree.Color(`rgb(${secondaryRgb.join(', ')})`);

  // Keep the original bright wire look, but let it borrow a secondary cover tone.
  const primaryHsl = {};
  const secondaryHsl = {};
  primaryColor.getHSL(primaryHsl);
  secondaryColor.getHSL(secondaryHsl);
  const brightPrimary = new orbThree.Color().setHSL(
    primaryHsl.h,
    Math.max(0.6, primaryHsl.s),
    Math.max(0.80, primaryHsl.l),
  );
  const brightSecondary = new orbThree.Color().setHSL(
    secondaryHsl.h,
    Math.max(0.5, secondaryHsl.s),
    Math.max(0.72, secondaryHsl.l),
  );
  let averageFrequency = 0;
  if (state.isPlaying && analyserRef.value && frequencyData) {
    for (let index = 0; index < frequencyData.length; index += 1) {
      averageFrequency += frequencyData[index];
    }
    averageFrequency /= Math.max(1, frequencyData.length);
  } else {
    smoothBass *= 0.9;
    smoothMid *= 0.9;
    smoothHigh *= 0.9;
    beatBoost *= 0.84;
  }
  const transient = state.isPlaying ? (analysis?.transient ?? 0) * motionDecay : 0;
  smoothNucleusFrequency += ((state.isPlaying ? averageFrequency * motionDecay : 0) - smoothNucleusFrequency)
    * (state.isPlaying ? 0.24 : 0.1);
  nucleusBackdropPulse += (((state.isPlaying ? (smoothBass * 1.1 + beatBoost * 0.56) * motionDecay : 0)) - nucleusBackdropPulse)
    * (state.isPlaying ? 0.2 : 0.08);
  nucleusBeatPulse += (((state.isPlaying ? (smoothBass * 1.0 + beatBoost * 1.02 + transient * 0.64) * motionDecay : 0)) - nucleusBeatPulse)
    * (state.isPlaying ? 0.22 : 0.08);
  const mixAmount = 0.28 + Math.min(0.2, smoothNucleusFrequency / 255 * 0.2);
  const wireColor = brightPrimary.clone().lerp(brightSecondary, mixAmount);

  const uniforms = orb.mesh.material.uniforms;
  const elapsedTime = orb.clock.getElapsedTime();
  uniforms.uTime.value = elapsedTime;
  uniforms.uFrequency.value = smoothNucleusFrequency * 0.84;
  uniforms.uAccent.value.copy(wireColor);

  const orbitAmount = 0.35 + nucleusBackdropPulse * 0.12;
  const targetCameraX = Math.sin(elapsedTime * 0.14) * orbitAmount;
  const targetCameraY = -2 + Math.cos(elapsedTime * 0.1) * 0.18;
  const targetCameraZ = 14 + Math.sin(elapsedTime * 0.08) * 0.25;
  orb.camera.position.x += (targetCameraX - orb.camera.position.x) * 0.035;
  orb.camera.position.y += (targetCameraY - orb.camera.position.y) * 0.08;
  orb.camera.position.z += (targetCameraZ - orb.camera.position.z) * 0.05;
  orb.camera.lookAt(orb.scene.position);

  const orbPulseScale = 1 + nucleusBackdropPulse * 0.016 + nucleusBeatPulse * 0.058;
  orb.mesh.scale.setScalar(orbPulseScale);
  orb.mesh.rotation.y = elapsedTime * 0.1;
  orb.mesh.rotation.x = Math.sin(elapsedTime * 0.16) * 0.08 + nucleusBeatPulse * 0.056;
  orb.mesh.rotation.z = Math.cos(elapsedTime * 0.12) * 0.05 + transient * 0.024;
  if (orbBloomPass) {
    orbBloomPass.strength = 0.44 + nucleusBackdropPulse * 0.15 + transient * 0.18;
  }

  orb.composer.render();
}

function render(now) {
  animationFrameId = window.requestAnimationFrame(render);
  if (!viewportWidth || !viewportHeight) return;
  const transitionDecay = getTransitionDecay(now);
  modeTransitionDecay.value = transitionDecay;
  modeTransitionProgress.value = fadingCanvasMode.value ? 1 - transitionDecay : 1;

  if (fadingCanvasMode.value === 'nucleus' && transitionDecay > 0) {
    drawNucleusFrame({ allowInactive: true, decay: transitionDecay });
  } else if (fadingCanvasMode.value === 'butterchurn' && transitionDecay > 0) {
    drawButterchurnFrame({ allowInactive: true });
  } else if (fadingCanvasMode.value === 'pills' && transitionDecay > 0) {
    ctx = pillsCtx;
    if (ctx) drawPillsFrame({ decay: transitionDecay });
  }

  if (activeCanvasMode.value === 'nucleus') {
    drawNucleusFrame();
    return;
  }

  if (activeCanvasMode.value === 'butterchurn') {
    drawButterchurnFrame();
    return;
  }

  if (activeCanvasMode.value === 'pills') {
    ctx = pillsCtx;
    if (!ctx) return;
    drawPillsFrame();
  }
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

function handleVisualizerDoubleClick(event) {
  const interactiveTarget = event.target instanceof Element
    ? event.target.closest('button, a, select, option, label')
    : null;
  if (interactiveTarget) return;
  toggleFullscreen();
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
  overlayVisible.value = true;
  scheduleOverlayHide();
  resizeCanvas();
}

function selectMode(mode) {
  transitionCanvasMode(mode);
  setVizMode(mode);
  showModeDropdown.value = false;
  resetMotionState();
  if (mode === 'pills') paintBackground(pillsCtx);
  else if (mode === 'nucleus') preloadNucleusVisualizer();
}

function clearOverlayHideTimer() {
  if (!overlayHideTimer) return;
  window.clearTimeout(overlayHideTimer);
  overlayHideTimer = 0;
}

function scheduleOverlayHide() {
  clearOverlayHideTimer();
  if (!hideChrome.value || showModeDropdown.value) return;
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

function setHideChrome(value) {
  hideChrome.value = Boolean(value);
  localStorage.setItem(HIDE_CHROME_STORAGE_KEY, String(hideChrome.value));
  revealOverlay();
}

function handleButterchurnPresetChange(event) {
  const nextPreset = event.target.value;
  persistButterchurnPreset(nextPreset);
}

function toggleButterchurnPresetShuffle() {
  const nextMode = shouldRandomizeButterchurnPresets.value ? 'single' : 'random';
  if (nextMode === 'single') {
    const currentPreset = butterchurnPresetName.value
      ?? butterchurnPresetNames[butterchurnPresetIndex.value]
      ?? butterchurnPreset.value
      ?? DEFAULT_BUTTERCHURN_PRESET;
    persistButterchurnPreset(currentPreset);
  }
  setButterchurnPresetMode(nextMode);
}

function toggleVisualizerModeShuffle() {
  setRandomizeOnNewTrack(!randomizeOnNewTrack.value);
}

watch(() => props.analyser, syncAnalyser);
watch(vizMode, () => {
  transitionCanvasMode(vizMode.value);
  resetMotionState();
  ensureButterchurnVisualizer();
  if (vizMode.value === 'nucleus') preloadNucleusVisualizer();
  resizeCanvas();
  if (vizMode.value === 'pills') paintBackground(pillsCtx);
  syncButterchurnPreset();
});
watch(() => state.currentTrack?._id, (trackId, previousTrackId) => {
  if (!trackId || trackId === previousTrackId) {
    if (!trackId) clearButterchurnCanvas();
    return;
  }

  let nextModeValue = currentMode.value.value;
  if (shouldShuffleVisualizerModes.value) {
    const nextMode = getRandomVizModeValue(currentMode.value.value);
    if (nextMode) {
      nextModeValue = nextMode;
      setVizMode(nextMode);
    }
  }

  if (nextModeValue === 'butterchurn') {
    advanceButterchurnPresetForTrack();
  }
  syncButterchurnPreset();
});
watch(() => state.isPlaying, () => {
  syncButterchurnPreset();
});
watch(randomizeOnNewTrack, () => {
  syncButterchurnPreset();
});
watch(butterchurnPresetMode, () => {
  syncButterchurnPreset();
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
  disposeNucleusVisualizer();
  clearOverlayHideTimer();
  clearModeTransitionTimer();
  resizeObserver?.disconnect();
  resizeObserver = null;
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('visibilitychange', resumeVisualizerContext);
});
</script>

<template>
  <section
    ref="containerRef"
    class="visualizer relative flex-1 overflow-hidden font-sans"
    :style="visualizerStyle"
    @pointermove="revealOverlay"
    @pointerdown="revealOverlay"
    @focusin="revealOverlay"
    @dblclick="handleVisualizerDoubleClick"
  >
    <canvas
      ref="pillsCanvasRef"
      class="visualizer-canvas relative z-0 block size-full"
      :class="isCanvasVisible('pills') ? 'opacity-100' : 'opacity-0'"
    />
    <canvas
      ref="butterchurnCanvasRef"
      class="visualizer-canvas absolute inset-0 z-0 block size-full"
      :class="isCanvasVisible('butterchurn') ? 'opacity-100' : 'opacity-0'"
    />
    <div
      class="visualizer-layer-fade butterchurn-fade pointer-events-none absolute inset-0 z-[1]"
      :style="butterchurnPauseFadeStyle"
    />
    <canvas
      ref="nucleusCanvasRef"
      class="visualizer-canvas absolute inset-0 z-0 block size-full"
      :style="nucleusCanvasStyle"
    />
    <div
      v-if="currentMode.value === 'nucleus'"
      class="nucleus-backdrop pointer-events-none absolute inset-0 z-[1]"
      :style="nucleusBackdropStyle"
    />
    <div
      v-if="currentMode.value === 'nucleus'"
      class="nucleus-vignette pointer-events-none absolute inset-0 z-[2]"
      :style="nucleusVignetteStyle"
    />
    <div
      class="visualizer-layer-fade pointer-events-none absolute inset-0 z-[1] mix-blend-screen [background:radial-gradient(circle_at_50%_42%,rgba(255,255,255,0.06),transparent_18%),radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.03),transparent_34%)]"
      :style="pillsGlowStyle"
    />
    <div
      v-if="pillsNoiseUrl"
      class="visualizer-layer-fade pointer-events-none absolute inset-0 z-[2] bg-[length:160px_160px] bg-repeat opacity-50 mix-blend-screen"
      :style="pillsNoiseStyle"
    />
    <div
      class="visualizer-layer-fade pointer-events-none absolute inset-0 z-[3] opacity-[0.88] [background:radial-gradient(ellipse_at_center,rgba(0,0,0,0)_24%,rgba(0,0,0,0.92)_95%)]"
      :style="pillsVignetteStyle"
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
      :class="shouldShowOverlay
        ? null
        : 'pointer-events-none -translate-y-2 opacity-0'"
    >
      {{ currentMode.credit.label }}
    </a>

    <div
      class="absolute right-[0.65rem] top-[calc(var(--visualizer-nav-offset)+0.65rem)] z-[5] flex items-center gap-[0.45rem] transition-[opacity,transform] duration-180 ease-out sm:right-[0.8rem] sm:top-[calc(var(--visualizer-nav-offset)+0.8rem)]"
      :class="shouldShowOverlay
        ? null
        : 'pointer-events-none -translate-y-2 opacity-0'"
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

      <Transition name="menu">
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
                :title="shouldRandomizeButterchurnPresets ? 'Shuffle presets on' : 'Shuffle presets off'"
                :style="shouldRandomizeButterchurnPresets
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

          <div class="mt-[0.2rem] flex items-center gap-2 px-3 pb-[0.15rem] pt-[0.35rem]">
            <div class="h-px flex-1 bg-white/10" />
            <span class="text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-zinc-500/90">
              General
            </span>
            <div class="h-px flex-1 bg-white/10" />
          </div>

          <button
            type="button"
            class="flex w-full items-center gap-[0.65rem] rounded-[0.7rem] px-3 py-[0.65rem] text-left text-[0.8rem] text-zinc-300/85 transition-[background-color,color,border-color,box-shadow] duration-150 ease-out hover:bg-zinc-800/95 hover:text-zinc-50"
            :class="shouldShuffleVisualizerModes && 'bg-zinc-800/95 text-zinc-50'"
            :style="shouldShuffleVisualizerModes
              ? {
                  borderColor: `rgba(${accentRgb}, 0.35)`,
                  boxShadow: `inset 0 0 0 1px rgba(${accentRgb}, 0.2)`,
                }
              : null"
            @click="toggleVisualizerModeShuffle"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="size-[0.95rem] shrink-0 fill-none stroke-current stroke-2">
              <path d="M16 3h5v5" />
              <path d="M4 20 20 4" />
              <path d="M21 16v5h-5" />
              <path d="M15 15 21 21" />
              <path d="M4 4l5 5" />
            </svg>
            <span>Shuffle visualizer mode</span>
          </button>

          <button
            type="button"
            class="mt-[0.2rem] flex w-full items-center gap-[0.65rem] rounded-[0.7rem] px-3 py-[0.65rem] text-left text-[0.8rem] text-zinc-300/85 transition-[background-color,color,border-color,box-shadow] duration-150 ease-out hover:bg-zinc-800/95 hover:text-zinc-50"
            :class="hideChrome && 'rounded-[0.7rem] bg-zinc-800/95 text-zinc-50'"
            :style="hideChrome
              ? {
                  borderColor: `rgba(${accentRgb}, 0.35)`,
                  boxShadow: `inset 0 0 0 1px rgba(${accentRgb}, 0.2)`,
                }
              : null"
            @click="setHideChrome(!hideChrome)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" class="size-[0.95rem] shrink-0 fill-none stroke-current stroke-2">
              <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Auto-hide controls</span>
          </button>
        </div>
      </Transition>

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

    <Transition name="fade">
      <div v-if="showModeDropdown" class="absolute inset-0 z-[3]" @click="showModeDropdown = false" />
    </Transition>
  </section>
</template>

<style scoped>
.visualizer-canvas {
  transition: opacity 0.32s ease, transform 0.42s cubic-bezier(0.22, 1, 0.36, 1);
  will-change: opacity, transform;
}

.visualizer-layer-fade {
  will-change: opacity;
}

.nucleus-backdrop {
  mix-blend-mode: screen;
  filter: blur(36px);
  will-change: transform, opacity;
}

.nucleus-vignette {
  background:
    radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.24) 72%, rgba(0, 0, 0, 0.52) 100%);
  opacity: 0.82;
}

.butterchurn-fade {
  background:
    radial-gradient(ellipse at center, rgba(19, 36, 47, 0.14) 0%, rgba(19, 36, 47, 0.36) 62%, rgba(19, 36, 47, 0.82) 100%);
  transition: opacity 0.18s ease;
}

.menu-enter-active, .menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top right;
}

.menu-enter-from, .menu-leave-to {
  opacity: 0;
  transform: translateY(-0.2rem) scale(0.96);
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

.visualizer {
  min-height: calc(100vh - 5.5rem);
  transition: background-color 0.32s ease;
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
