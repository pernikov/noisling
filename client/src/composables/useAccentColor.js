import { ref, watch } from 'vue';
import { usePlayer } from './usePlayer.js';
import { useApi } from './useApi.js';

const accentColor = ref(null); // "r, g, b" string or null
const accentPalette = ref([]);
const extractedColorCache = new Map();

let currentRgb = [0, 0, 0];
let targetRgb = [0, 0, 0];
let currentPalette = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
let targetPalette = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
let animFrame = null;
let watcherStarted = false;
let extractToken = 0;
let idleHandle = null;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function animateColor() {
  const speed = 0.04; // ~25 frames to settle
  let done = true;

  for (let i = 0; i < 3; i++) {
    currentRgb[i] = lerp(currentRgb[i], targetRgb[i], speed);
    if (Math.abs(currentRgb[i] - targetRgb[i]) > 0.5) done = false;
    else currentRgb[i] = targetRgb[i];
  }

  for (let paletteIndex = 0; paletteIndex < currentPalette.length; paletteIndex += 1) {
    for (let channel = 0; channel < 3; channel += 1) {
      currentPalette[paletteIndex][channel] = lerp(
        currentPalette[paletteIndex][channel],
        targetPalette[paletteIndex][channel],
        speed,
      );
      if (Math.abs(currentPalette[paletteIndex][channel] - targetPalette[paletteIndex][channel]) > 0.5) done = false;
      else currentPalette[paletteIndex][channel] = targetPalette[paletteIndex][channel];
    }
  }

  accentColor.value = `${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])}`;
  accentPalette.value = currentPalette.map(rgb => formatRgb(rgb.map(value => Math.round(value))));

  if (!done) {
    animFrame = requestAnimationFrame(animateColor);
  } else {
    animFrame = null;
  }
}

function setTargetColor(r, g, b) {
  targetRgb = [r, g, b];
  if (!animFrame) {
    animFrame = requestAnimationFrame(animateColor);
  }
}

function normalizePalette(palette) {
  const safe = palette.slice(0, 3).map(rgb => [...rgb]);
  while (safe.length < 3) safe.push([...(safe[safe.length - 1] ?? [0, 0, 0])]);
  return safe;
}

function setTargetPalette(palette) {
  targetPalette = normalizePalette(palette);
  if (!animFrame) {
    animFrame = requestAnimationFrame(animateColor);
  }
}

function formatRgb(rgb) {
  return `${rgb[0]}, ${rgb[1]}, ${rgb[2]}`;
}

function colorDistance(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function getFallbackPalette(base) {
  const brighten = (amount) => base.map(value => Math.min(255, Math.round(value + (255 - value) * amount)));
  const deepen = (amount) => base.map(value => Math.max(0, Math.round(value * (1 - amount))));
  return [base, brighten(0.18), deepen(0.22)].map(formatRgb);
}

export function useAccentColor() {
  ensureAccentWatcher();
  return { accentColor, accentPalette };
}

function ensureAccentWatcher() {
  if (watcherStarted) return;
  watcherStarted = true;

  const { state } = usePlayer();
  const api = useApi();

  watch(
    () => state.currentTrack?.cover,
    (cover) => {
      if (!cover) {
        extractToken += 1;
        clearScheduledExtraction();
        setTargetColor(0, 0, 0);
        setTargetPalette([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
        return;
      }
      scheduleExtractColor(api.coverUrl(cover));
    },
    { immediate: true }
  );
}

function scheduleIdle(callback) {
  if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: 500 });
  }
  return setTimeout(callback, 0);
}

function cancelIdle(handle) {
  if (typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
    window.cancelIdleCallback(handle);
  } else {
    clearTimeout(handle);
  }
}

function clearScheduledExtraction() {
  if (idleHandle) {
    cancelIdle(idleHandle);
    idleHandle = null;
  }
}

function applyExtractedColor({ rgb, palette }) {
  setTargetPalette(palette);
  setTargetColor(rgb[0], rgb[1], rgb[2]);
}

function rememberExtractedColor(url, value) {
  extractedColorCache.set(url, value);
  if (extractedColorCache.size > 80) {
    const [oldest] = extractedColorCache.keys();
    extractedColorCache.delete(oldest);
  }
}

function scheduleExtractColor(url) {
  clearScheduledExtraction();
  const cached = extractedColorCache.get(url);
  if (cached) {
    applyExtractedColor(cached);
    return;
  }

  const token = ++extractToken;
  idleHandle = scheduleIdle(() => {
    idleHandle = null;
    extractColor(url, token);
  });
}

function extractColor(url, token) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  img.onload = () => {
    if (token !== extractToken) return;

    const canvas = document.createElement('canvas');
    const size = 10;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    let r = 0, g = 0, b = 0, count = 0;
    const buckets = new Map();

    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i], pg = data[i + 1], pb = data[i + 2];
      const brightness = (pr + pg + pb) / 3;
      if (brightness < 20 || brightness > 235) continue;
      r += pr;
      g += pg;
      b += pb;
      count++;

      const qr = Math.round(pr / 32) * 32;
      const qg = Math.round(pg / 32) * 32;
      const qb = Math.round(pb / 32) * 32;
      const key = `${qr},${qg},${qb}`;
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }

    if (count === 0) {
      const fallback = { rgb: [0, 0, 0], palette: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
      rememberExtractedColor(url, fallback);
      applyExtractedColor(fallback);
      return;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    const dominant = [r, g, b];
    const rankedPalette = [...buckets.entries()]
      .sort((a, bEntry) => bEntry[1] - a[1])
      .map(([key]) => key.split(',').map(Number));
    const palette = [dominant];
    for (const candidate of rankedPalette) {
      if (palette.length >= 3) break;
      if (palette.every(existing => colorDistance(existing, candidate) >= 52)) {
        palette.push(candidate);
      }
    }
    const extracted = {
      rgb: [r, g, b],
      palette: (palette.length >= 2 ? palette : getFallbackPalette(dominant).map(value => value.split(', ').map(Number)))
        .slice(0, 3),
    };

    rememberExtractedColor(url, extracted);
    if (token === extractToken) applyExtractedColor(extracted);
  };
  img.onerror = () => {
    if (token !== extractToken) return;
    setTargetColor(0, 0, 0);
    setTargetPalette([[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  };
  img.src = url;
}
