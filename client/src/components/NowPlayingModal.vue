<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';
import { useTheme } from '../composables/useTheme.js';
import { useApi } from '../composables/useApi.js';
import Icon from './Icon.vue';
import {
  mdiChevronDown,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiPlay,
  mdiPause,
  mdiShuffle,
  mdiRepeat,
  mdiRepeatOnce,
} from '@mdi/js';

const {
  state,
  toggle,
  next,
  prev,
  seek,
  toggleShuffle,
  toggleNowPlaying,
  cycleRepeat,
  hasNext,
  hasPrev,
} = usePlayer();

const { accentColor: albumAccentColor } = useAccentColor();
const { accentColor } = useTheme();
const api = useApi();

const coverUrl = computed(() =>
  state.currentTrack?.cover ? api.coverUrl(state.currentTrack.cover) : null
);

const accentOverlay = computed(() => {
  if (!albumAccentColor.value) return 'transparent';
  return `linear-gradient(to top, rgba(${albumAccentColor.value}, 0.5), rgba(${albumAccentColor.value}, 0.15) 60%, transparent)`;
});

function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  if (!isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Progress scrubbing ---
// scrubPercent tracks where the finger/cursor actually is during a drag so the
// bar follows it exactly. Displaying state.currentTime directly would cause
// visible jumps because the browser snaps seeks to keyframe boundaries.
const isScrubbing = ref(false);
const scrubPercent = ref(0);

const displayPercent = computed(() => {
  if (isScrubbing.value) return scrubPercent.value;
  if (!state.duration || !isFinite(state.duration)) return 0;
  return (state.currentTime / state.duration) * 100;
});

const displayTime = computed(() => {
  if (isScrubbing.value && state.duration) return scrubPercent.value / 100 * state.duration;
  return state.currentTime;
});

// Cached bounding rect for the duration of a drag (avoids repeated layout reads).
let progressRect = null;

function clampPercent(clientX) {
  if (!progressRect) return 0;
  return Math.max(0, Math.min(100, (clientX - progressRect.left) / progressRect.width * 100));
}

// Mouse drag (desktop / iPadOS with pointer)
function onProgressMouseDown(e) {
  if (!state.duration) return;
  progressRect = e.currentTarget.getBoundingClientRect();
  isScrubbing.value = true;
  scrubPercent.value = clampPercent(e.clientX);
  seek(scrubPercent.value / 100 * state.duration);

  const onMove = (ev) => {
    scrubPercent.value = clampPercent(ev.clientX);
    seek(scrubPercent.value / 100 * state.duration);
  };
  const onUp = (ev) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    scrubPercent.value = clampPercent(ev.clientX);
    seek(scrubPercent.value / 100 * state.duration);
    isScrubbing.value = false;
    progressRect = null;
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// Touch drag (mobile)
let progressTouchStartX = 0;
let progressTouchStartY = 0;
let isProgressScrubbing = false;

function onProgressTouchStart(e) {
  progressTouchStartX = e.touches[0].clientX;
  progressTouchStartY = e.touches[0].clientY;
  isProgressScrubbing = false;
  progressRect = e.currentTarget.getBoundingClientRect();
  isScrubbing.value = true;
  scrubPercent.value = clampPercent(e.touches[0].clientX);
  seek(scrubPercent.value / 100 * state.duration);
}

function onProgressTouchMove(e) {
  const deltaX = Math.abs(e.touches[0].clientX - progressTouchStartX);
  const deltaY = Math.abs(e.touches[0].clientY - progressTouchStartY);
  // If gesture is primarily vertical (swipe to close), abort the scrub.
  if (!isProgressScrubbing && deltaY > deltaX * 0.8) {
    isScrubbing.value = false;
    return;
  }
  isProgressScrubbing = true;
  e.preventDefault(); // stop page scroll during horizontal scrub
  scrubPercent.value = clampPercent(e.touches[0].clientX);
  seek(scrubPercent.value / 100 * state.duration);
}

function onProgressTouchEnd() {
  isProgressScrubbing = false;
  isScrubbing.value = false;
  progressRect = null;
}

// Swipe-down to close / swipe left-right to skip
const dragY = ref(0);
const dragX = ref(0);
const isDragging = ref(false);
const isReleasingHorizontal = ref(false);
let touchStartY = 0;
let touchStartX = 0;
let swipeActive = false;
let swipeDirection = null; // 'vertical' | 'horizontal' | null — locked after first 10px

function onTouchStart(e) {
  if (e.target.closest('[data-no-swipe]')) { swipeActive = false; return; }
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;
  swipeActive = true;
  isDragging.value = true;
  dragY.value = 0;
  dragX.value = 0;
  swipeDirection = null;
}

function onTouchMove(e) {
  if (!swipeActive) return;
  const deltaY = e.touches[0].clientY - touchStartY;
  const deltaX = e.touches[0].clientX - touchStartX;

  // Lock direction after the gesture travels 10px
  if (!swipeDirection && (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10)) {
    swipeDirection = Math.abs(deltaX) > Math.abs(deltaY) ? 'horizontal' : 'vertical';
  }

  if (swipeDirection === 'vertical') {
    if (deltaY > 0) dragY.value = deltaY;
  } else if (swipeDirection === 'horizontal') {
    dragX.value = deltaX;
  }
}

function onTouchEnd() {
  if (!swipeActive) return;
  swipeActive = false;
  isDragging.value = false;

  if (swipeDirection === 'vertical') {
    if (dragY.value > 80) {
      dragY.value = 0;
      toggleNowPlaying();
    } else {
      dragY.value = 0;
    }
  } else if (swipeDirection === 'horizontal') {
    const THRESHOLD = 60;
    const triggered = (dragX.value < -THRESHOLD && hasNext.value) || (dragX.value > THRESHOLD && hasPrev.value);
    if (!triggered) {
      isReleasingHorizontal.value = true;
      setTimeout(() => { isReleasingHorizontal.value = false; }, 450);
    }
    if (dragX.value < -THRESHOLD && hasNext.value) next();
    else if (dragX.value > THRESHOLD && hasPrev.value) prev();
    dragX.value = 0;
  }

  swipeDirection = null;
}

const dragStyle = computed(() => {
  const parts = [];
  if (dragY.value > 0) parts.push(`translateY(${dragY.value}px)`);
  if (dragX.value !== 0) parts.push(`translateX(${dragX.value * 0.35}px)`); // dampened feel
  return parts.length ? { transform: parts.join(' '), transition: 'none' } : {};
});

// Cover-specific drag physics: tilt + slight scale-up while dragging horizontally
const coverDragStyle = computed(() => {
  const x = dragX.value;
  if (x !== 0) {
    const rotate = Math.max(-12, Math.min(12, x * 0.08));
    const scale = 1 + Math.min(Math.abs(x) * 0.0003, 0.03);
    return { transform: `rotate(${rotate}deg) scale(${scale})`, transition: 'none' };
  }
  if (isReleasingHorizontal.value) {
    // Snap-back spring when swipe was rejected
    return { transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)' };
  }
  return {};
});

// Floating skip badge that fades in as you drag past 15px toward a valid target
const swipeHint = computed(() => {
  const x = dragX.value;
  if (!isDragging.value || x === 0) return null;
  const THRESHOLD = 60;
  const opacity = Math.min(1, Math.max(0, (Math.abs(x) - 15) / (THRESHOLD - 15)));
  if (opacity <= 0) return null;
  const direction = x < 0 ? 'next' : 'prev';
  if (direction === 'next' && !hasNext.value) return null;
  if (direction === 'prev' && !hasPrev.value) return null;
  return { direction, opacity };
});

watch(
  () => state.showNowPlaying,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
  }
);

function onKeyDown(e) {
  if (e.key === 'Escape' && state.showNowPlaying) {
    e.stopPropagation();
    toggleNowPlaying();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown, { capture: true });
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeyDown, { capture: true });
  if (state.showNowPlaying) {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div
        v-if="state.showNowPlaying && state.currentTrack"
        class="fixed inset-0 flex flex-col overflow-hidden"
        :style="[{ zIndex: 60, touchAction: 'none' }, dragStyle]"
        role="dialog"
        aria-modal="true"
        aria-label="Now Playing"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
      >
        <!-- Layer 1: Blurred album art — the actual background -->
        <div class="absolute inset-0 overflow-hidden bg-zinc-900">
          <img
            v-if="coverUrl"
            :src="coverUrl"
            alt=""
            aria-hidden="true"
            class="w-full h-full object-cover"
            style="filter: blur(80px); opacity: 0.9; transform: scale(1.2);"
            loading="eager"
          />
        </div>

        <!-- Layer 2: Dark scrim so text is always readable -->
        <div class="absolute inset-0 bg-black/40" />

        <!-- Layer 3: Subtle accent color gradient -->
        <div class="absolute inset-0" :style="{ background: accentOverlay }" />

        <!-- Content -->
        <div class="relative z-10 flex flex-col h-full px-6">

          <!-- Drag pill -->
          <div class="flex justify-center pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1 flex-shrink-0">
            <div class="w-10 h-1 bg-white/30 rounded-full" />
          </div>

          <!-- Top bar -->
          <div class="flex items-center justify-between py-3 flex-shrink-0">
            <button
              class="text-zinc-300 hover:text-white transition-colors p-1 -ml-1 rounded-full hover:bg-white/10"
              @click="toggleNowPlaying"
              aria-label="Close Now Playing"
            >
              <Icon :path="mdiChevronDown" class="w-7 h-7" />
            </button>
            <span class="text-xs uppercase tracking-widest text-zinc-400 font-medium">Now Playing</span>
            <div class="w-7 h-7" />
          </div>

          <!-- Album art -->
          <div class="flex-1 flex items-center justify-center py-2 min-h-0">
            <div
              class="relative w-full"
              style="max-width: min(100%, 60vh, 400px);"
              :style="coverDragStyle"
            >
              <!-- Swipe-to-prev hint (dragging right) -->
              <div
                v-if="swipeHint?.direction === 'prev'"
                class="absolute inset-y-0 left-0 flex items-center pointer-events-none z-10"
                :style="{ opacity: swipeHint.opacity }"
              >
                <div class="bg-black/70 rounded-full p-3 shadow-lg -translate-x-1/2 backdrop-blur-sm">
                  <Icon :path="mdiSkipPrevious" class="w-7 h-7 text-white" />
                </div>
              </div>
              <!-- Swipe-to-next hint (dragging left) -->
              <div
                v-if="swipeHint?.direction === 'next'"
                class="absolute inset-y-0 right-0 flex items-center pointer-events-none z-10"
                :style="{ opacity: swipeHint.opacity }"
              >
                <div class="bg-black/70 rounded-full p-3 shadow-lg translate-x-1/2 backdrop-blur-sm">
                  <Icon :path="mdiSkipNext" class="w-7 h-7 text-white" />
                </div>
              </div>

              <Transition name="cover-fade" mode="out-in">
                <img
                  v-if="coverUrl"
                  :key="coverUrl"
                  :src="coverUrl"
                  alt="Album art"
                  class="aspect-square object-cover rounded-xl w-full"
                  style="box-shadow: 0 32px 80px rgba(0,0,0,0.6);"
                  loading="eager"
                />
                <div
                  v-else
                  key="placeholder"
                  class="aspect-square rounded-xl bg-zinc-800 flex items-center justify-center w-full"
                >
                  <svg class="w-24 h-24 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>
              </Transition>
            </div>
          </div>

          <!-- Bottom section -->
          <div class="flex flex-col gap-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex-shrink-0" data-no-swipe>

            <!-- Track info -->
            <div>
              <div class="text-xl font-bold truncate text-white leading-tight">
                {{ state.currentTrack.title }}
              </div>
              <div class="text-sm text-zinc-300 truncate mt-1">
                <template v-for="(artist, ai) in state.currentTrack.artists" :key="ai">
                  <span v-if="ai > 0">, </span>
                  <router-link
                    :to="{ name: 'artist', params: { name: artist } }"
                    class="hover:text-white hover:underline"
                    @click="toggleNowPlaying"
                  >{{ artist }}</router-link>
                </template>
              </div>
            </div>

            <!-- Progress scrubber -->
            <div>
              <!-- Tall hit area so finger has plenty of room; visual bar stays slim -->
              <div
                class="relative flex items-center h-8 select-none"
                :class="isScrubbing ? 'cursor-grabbing' : 'cursor-grab'"
                @mousedown.prevent="onProgressMouseDown"
                @touchstart.passive="onProgressTouchStart"
                @touchmove="onProgressTouchMove"
                @touchend="onProgressTouchEnd"
              >
                <div class="relative w-full h-1.5 bg-white/20 rounded-full">
                  <div
                    class="h-full rounded-full transition-colors"
                    :class="isScrubbing ? `bg-${accentColor}-400` : 'bg-white'"
                    :style="{ width: displayPercent + '%' }"
                  />
                  <div
                    class="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg -translate-x-1/2 pointer-events-none transition-transform"
                    :class="isScrubbing ? 'scale-100' : 'scale-50'"
                    :style="{ left: displayPercent + '%' }"
                  />
                </div>
              </div>
              <div class="flex justify-between text-xs text-zinc-400 tabular-nums">
                <span>{{ formatTime(displayTime) }}</span>
                <span>{{ formatTime(state.duration) }}</span>
              </div>
            </div>

            <!-- Playback controls -->
            <div class="flex items-center justify-between">
              <button
                class="transition-colors p-2 rounded-full hover:bg-white/10"
                :class="state.shuffle ? `text-${accentColor}-400` : 'text-white/60 hover:text-white'"
                @click="toggleShuffle"
                aria-label="Shuffle"
              >
                <Icon :path="mdiShuffle" class="w-5 h-5" />
              </button>

              <button
                :disabled="!hasPrev"
                class="text-white disabled:text-zinc-600 transition-colors p-2 rounded-full hover:bg-white/10 disabled:hover:bg-transparent"
                @click="prev"
                aria-label="Previous"
              >
                <Icon :path="mdiSkipPrevious" class="w-9 h-9" />
              </button>

              <button
                class="w-16 h-16 rounded-full bg-white text-zinc-900 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-lg"
                @click="toggle"
                :aria-label="state.isPlaying ? 'Pause' : 'Play'"
              >
                <Transition name="icon-swap" mode="out-in">
                  <Icon v-if="state.isPlaying" :path="mdiPause" class="w-8 h-8" :key="'pause'" />
                  <Icon v-else :path="mdiPlay" class="w-8 h-8" :key="'play'" />
                </Transition>
              </button>

              <button
                :disabled="!hasNext"
                class="text-white disabled:text-zinc-600 transition-colors p-2 rounded-full hover:bg-white/10 disabled:hover:bg-transparent"
                @click="next"
                aria-label="Next"
              >
                <Icon :path="mdiSkipNext" class="w-9 h-9" />
              </button>

              <button
                class="transition-colors p-2 rounded-full hover:bg-white/10"
                :class="state.repeat !== 'off' ? `text-${accentColor}-400` : 'text-white/60 hover:text-white'"
                @click="cycleRepeat"
                :aria-label="'Repeat: ' + state.repeat"
              >
                <Transition name="icon-swap" mode="out-in">
                  <Icon v-if="state.repeat === 'one'" :path="mdiRepeatOnce" class="w-5 h-5" :key="'repeat-one'" />
                  <Icon v-else :path="mdiRepeat" class="w-5 h-5" :key="'repeat'" />
                </Transition>
              </button>
            </div>


          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.35s cubic-bezier(0.32, 0.72, 0, 1);
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
}

/* Album art crossfade on track change */
.cover-fade-enter-active,
.cover-fade-leave-active {
  transition: opacity 0.25s ease;
}
.cover-fade-enter-from,
.cover-fade-leave-to {
  opacity: 0;
}

/* Play/pause and repeat icon swaps */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 0.1s ease;
}
.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
}

</style>
