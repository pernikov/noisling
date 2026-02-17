import { ref, watch } from 'vue';
import { usePlayer } from './usePlayer.js';
import { useApi } from './useApi.js';

const accentColor = ref(null); // "r, g, b" string or null

let currentRgb = [0, 0, 0];
let targetRgb = [0, 0, 0];
let animFrame = null;

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

  accentColor.value = `${Math.round(currentRgb[0])}, ${Math.round(currentRgb[1])}, ${Math.round(currentRgb[2])}`;

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

export function useAccentColor() {
  const { state } = usePlayer();
  const api = useApi();

  watch(
    () => state.currentTrack?.cover,
    (cover) => {
      if (!cover) {
        setTargetColor(0, 0, 0);
        return;
      }
      extractColor(api.coverUrl(cover));
    },
    { immediate: true }
  );

  return { accentColor };
}

function extractColor(url) {
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const size = 10;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    let r = 0, g = 0, b = 0, count = 0;

    for (let i = 0; i < data.length; i += 4) {
      const pr = data[i], pg = data[i + 1], pb = data[i + 2];
      const brightness = (pr + pg + pb) / 3;
      if (brightness < 20 || brightness > 235) continue;
      r += pr;
      g += pg;
      b += pb;
      count++;
    }

    if (count === 0) {
      setTargetColor(0, 0, 0);
      return;
    }

    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);

    setTargetColor(r, g, b);
  };
  img.onerror = () => {
    setTargetColor(0, 0, 0);
  };
  img.src = url;
}
