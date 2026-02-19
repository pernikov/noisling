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

function progressPercent() {
  if (!state.duration || !isFinite(state.duration)) return 0;
  return (state.currentTime / state.duration) * 100;
}

function onProgressClick(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  seek(ratio * state.duration);
}

let progressTouchStartX = 0;
let progressTouchStartY = 0;
let isProgressScrubbing = false;

function onProgressTouchStart(e) {
  progressTouchStartX = e.touches[0].clientX;
  progressTouchStartY = e.touches[0].clientY;
  isProgressScrubbing = false;
  // Seek immediately so the scrubber feels responsive
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
  seek(ratio * state.duration);
}

function onProgressTouchMove(e) {
  const deltaX = Math.abs(e.touches[0].clientX - progressTouchStartX);
  const deltaY = Math.abs(e.touches[0].clientY - progressTouchStartY);
  // Ignore the move if the gesture is primarily vertical (e.g. swiping to close
  // the modal), otherwise the finger sliding left off the bar clamps to ratio 0
  // and seek(0) is called, restarting the song.
  if (!isProgressScrubbing && deltaY > deltaX * 0.8) return;
  isProgressScrubbing = true;
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.touches[0].clientX - rect.left) / rect.width));
  seek(ratio * state.duration);
}

function onProgressTouchEnd() {
  isProgressScrubbing = false;
}

// Swipe-down to close
const dragY = ref(0);
const isDragging = ref(false);
let touchStartY = 0;
let touchStartX = 0;
let swipeActive = false;

function onTouchStart(e) {
  if (e.target.closest('[data-no-swipe]')) { swipeActive = false; return; }
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;
  swipeActive = true;
  isDragging.value = true;
  dragY.value = 0;
}

function onTouchMove(e) {
  if (!swipeActive) return;
  const deltaY = e.touches[0].clientY - touchStartY;
  const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
  if (deltaY > 0 && deltaY > deltaX * 0.5) dragY.value = deltaY;
}

function onTouchEnd() {
  if (!swipeActive) return;
  swipeActive = false;
  isDragging.value = false;
  if (dragY.value > 80) {
    dragY.value = 0;
    toggleNowPlaying();
  } else {
    dragY.value = 0;
  }
}

const dragStyle = computed(() =>
  dragY.value > 0
    ? { transform: `translateY(${dragY.value}px)`, transition: 'none' }
    : {}
);

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
        :style="[{ zIndex: 60 }, dragStyle]"
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
          <div class="flex justify-center pt-3 pb-1 flex-shrink-0">
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
            <img
              v-if="coverUrl"
              :src="coverUrl"
              alt="Album art"
              class="aspect-square object-cover rounded-xl w-full"
              style="max-width: min(100%, 60vh, 400px);  box-shadow: 0 32px 80px rgba(0,0,0,0.6);"
              loading="eager"
            />
            <div
              v-else
              class="aspect-square rounded-xl bg-zinc-800 flex items-center justify-center w-full"
              style="max-width: min(100%, 60vh, 400px);"
            >
              <svg class="w-24 h-24 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
          </div>

          <!-- Bottom section -->
          <div class="flex flex-col gap-4 pb-10 flex-shrink-0" data-no-swipe>

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
              <div
                class="relative h-1.5 bg-white/20 rounded-full cursor-pointer group"
                @click="onProgressClick"
                @touchstart.passive="onProgressTouchStart"
                @touchmove.passive="onProgressTouchMove"
                @touchend="onProgressTouchEnd"
              >
                <div
                  class="h-full bg-white rounded-full transition-colors"
                  :class="`group-hover:bg-${accentColor}-400`"
                  :style="{ width: progressPercent() + '%' }"
                />
                <div
                  class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity -translate-x-1/2 pointer-events-none"
                  :style="{ left: progressPercent() + '%' }"
                />
              </div>
              <div class="flex justify-between text-xs text-zinc-400 mt-1.5 tabular-nums">
                <span>{{ formatTime(state.currentTime) }}</span>
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
                <Icon v-if="state.isPlaying" :path="mdiPause" class="w-8 h-8" />
                <Icon v-else :path="mdiPlay" class="w-8 h-8" />
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
                <Icon v-if="state.repeat === 'one'" :path="mdiRepeatOnce" class="w-5 h-5" />
                <Icon v-else :path="mdiRepeat" class="w-5 h-5" />
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

</style>
