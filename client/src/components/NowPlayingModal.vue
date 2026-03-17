<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';
import { useTheme } from '../composables/useTheme.js';
import { useApi } from '../composables/useApi.js';
import { useProgressScrub, formatTime } from '../composables/useProgressScrub.js';
import Icon from './Icon.vue';
import Spinner from './Spinner.vue';
import QueueList from './QueueList.vue';
import QueueActions from './QueueActions.vue';
import {
  mdiChevronDown,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiPlay,
  mdiPause,
  mdiShuffle,
  mdiRepeat,
  mdiRepeatOnce,
  mdiHeart,
  mdiHeartOutline,
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
  toggleLove,
  hasNext,
  hasPrev,
} = usePlayer();

const { accentColor: albumAccentColor } = useAccentColor();
const { accentColor, lovedUseAccent } = useTheme();
const api = useApi();
const coverUrl = computed(() =>
  state.currentTrack?.cover ? api.coverUrl(state.currentTrack.cover) : null
);

// --- Tab state ---
const activeTab = ref('nowplaying');
const queueList = ref(null);

watch(activeTab, async (tab) => {
  if (tab === 'queue') {
    await nextTick();
    queueList.value?.scrollToCurrent();
  }
});

// Cover crossfade: hold the previous cover visible until the new one finishes loading,
// then crossfade both simultaneously (fade-out old, fade-in new).
const displayedCoverUrl = ref(null);
const prevCoverUrl = ref(null);
const currLoaded = ref(false);

watch(coverUrl, (newUrl) => {
  prevCoverUrl.value = null; // immediately hide old cover; show skeleton instead
  displayedCoverUrl.value = newUrl;
  currLoaded.value = !newUrl; // no image → nothing to wait for
}, { immediate: true });

function onCoverLoad() {
  currLoaded.value = true;
  setTimeout(() => { prevCoverUrl.value = null; }, 350);
}

const accentOverlay = computed(() => {
  if (!albumAccentColor.value) return 'transparent';
  return `linear-gradient(to top, rgba(${albumAccentColor.value}, 0.5), rgba(${albumAccentColor.value}, 0.15) 60%, transparent)`;
});

// --- Progress scrubbing ---
// scrubPercent tracks where the finger/cursor actually is during a drag so the
// bar follows it exactly. Displaying state.currentTime directly would cause
// visible jumps because the browser snaps seeks to keyframe boundaries.
const { isScrubbing, scrubPercent, displayPercent, displayTime, startMouseScrub } = useProgressScrub({ state, seek });

// Cached bounding rect for touch scrubbing (avoids repeated layout reads).
let progressRect = null;

function clampPercent(clientX) {
  if (!progressRect) return 0;
  return Math.max(0, Math.min(100, (clientX - progressRect.left) / progressRect.width * 100));
}

// Mouse drag (desktop / iPadOS with pointer)
function onProgressMouseDown(e) {
  startMouseScrub(e, { seekDuringDrag: true });
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
const isClosingByDrag = ref(false);
let touchStartY = 0;
let touchStartX = 0;
let swipeActive = false;
let swipeDirection = null; // 'vertical' | 'horizontal' | null — locked after first 10px

function onTouchStart(e) {
  if (activeTab.value === 'queue') { swipeActive = false; return; }
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
      isClosingByDrag.value = true;
      dragY.value = window.innerHeight;
      setTimeout(() => {
        isClosingByDrag.value = false;
        dragY.value = 0;
        toggleNowPlaying();
      }, 280);
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

const outerStyle = computed(() => {
  const base = { zIndex: 60, touchAction: activeTab.value === 'queue' ? 'pan-y' : 'none' };
  if (isClosingByDrag.value) return { ...base, transform: `translateY(${dragY.value}px)`, transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)' };
  if (dragY.value > 0) return { ...base, transform: `translateY(${dragY.value}px)`, transition: 'none' };
  return base;
});

// Cover-specific drag physics: slide + tilt + slight scale-up while dragging horizontally
const coverDragStyle = computed(() => {
  const x = dragX.value;
  if (x !== 0) {
    const translateX = x * 0.45;
    const rotate = Math.max(-12, Math.min(12, x * 0.08));
    const scale = 1 + Math.min(Math.abs(x) * 0.0003, 0.03);
    return { transform: `translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`, transition: 'none' };
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
    if (open) activeTab.value = 'nowplaying';
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
        class="fixed inset-0 z-[40] flex flex-col overflow-hidden"
        :style="outerStyle"
        role="dialog"
        aria-modal="true"
        aria-label="Now Playing"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
      >
        <!-- Base background -->
        <div class="absolute inset-0 bg-zinc-900" />

        <!-- Decorative layers: always mounted, fade via CSS opacity on tab switch -->
        <div
          class="absolute inset-0 overflow-hidden transition-opacity duration-[350ms]"
          :class="activeTab === 'nowplaying' ? 'opacity-100' : 'opacity-0'"
        >
          <img
            v-if="prevCoverUrl"
            :src="prevCoverUrl"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            :style="{ filter: 'blur(80px)', transform: 'scale(1.2)', opacity: currLoaded ? 0 : 0.9 }"
          />
          <img
            v-if="displayedCoverUrl"
            :src="displayedCoverUrl"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            :style="{ filter: 'blur(80px)', transform: 'scale(1.2)', opacity: currLoaded ? 0.9 : 0 }"
          />
          <div class="absolute inset-0 bg-black/40" />
          <div class="absolute inset-0" :style="{ background: accentOverlay }" />
        </div>

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

            <!-- Tab switcher (mobile only — desktop has the queue drawer) -->
            <div class="sm:hidden flex bg-white/10 rounded-full p-0.5">
              <button
                class="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                :class="activeTab === 'nowplaying' ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white'"
                @click="activeTab = 'nowplaying'"
              >Playing</button>
              <button
                class="px-3 py-1 rounded-full text-xs font-medium transition-colors"
                :class="activeTab === 'queue' ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white'"
                @click="activeTab = 'queue'"
              >Queue</button>
            </div>
            <span class="hidden sm:block text-xs uppercase tracking-widest text-zinc-400 font-medium">Now Playing</span>

            <!-- Love button (hidden in queue tab) -->
            <button
              v-if="activeTab === 'nowplaying'"
              class="p-1 -mr-1 rounded-full hover:bg-white/10 transition-colors"
              :class="state.currentTrack.isLoved
                ? (lovedUseAccent ? `text-${accentColor}-400` : 'text-red-400')
                : 'text-zinc-300 hover:text-white'"
              @click="toggleLove()"
              aria-label="Love track"
            >
              <Transition name="icon-swap" mode="out-in">
                <Icon v-if="state.currentTrack.isLoved" :path="mdiHeart" class="w-6 h-6" :key="'loved'" />
                <Icon v-else :path="mdiHeartOutline" class="w-6 h-6" :key="'unloved'" />
              </Transition>
            </button>
            <div v-else class="w-8 h-8 flex-shrink-0" aria-hidden="true" />
          </div>

          <!-- Tab content: both panels always mounted, crossfade via CSS opacity -->
          <div class="relative flex-1 min-h-0">

          <!-- Now Playing content -->
          <div
            class="absolute inset-0 flex flex-col transition-opacity duration-200"
            :class="activeTab === 'nowplaying' ? 'opacity-100' : 'opacity-0 pointer-events-none'"
          >

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

              <div
                class="relative aspect-square w-full rounded-xl overflow-hidden"
                style="box-shadow: 0 32px 80px rgba(0,0,0,0.6);"
              >
                <!-- Placeholder when no cover -->
                <div
                  v-if="!displayedCoverUrl"
                  class="absolute inset-0 bg-zinc-800 flex items-center justify-center"
                >
                  <svg class="w-24 h-24 text-zinc-700" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                  </svg>
                </div>

                <!-- Skeleton shown while new cover is loading -->
                <div
                  v-if="displayedCoverUrl && !currLoaded"
                  class="absolute inset-0 bg-zinc-800 flex items-center justify-center"
                >
                  <Spinner class="w-10 h-10 text-white/60" />
                </div>

                <!-- Current cover fading in when loaded -->
                <img
                  v-if="displayedCoverUrl"
                  :src="displayedCoverUrl"
                  alt="Album art"
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  :class="currLoaded ? 'opacity-100' : 'opacity-0'"
                  loading="eager"
                  @load="onCoverLoad"
                />
              </div>
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
              <span
                v-if="state.transcodeWaiting || state.transcodeActive"
                class="mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wide"
                :class="state.transcodeWaiting ? 'border-amber-400/40 text-amber-200' : 'border-emerald-400/40 text-emerald-200'"
              >
                <span class="h-1.5 w-1.5 rounded-full" :class="state.transcodeWaiting ? 'bg-amber-200 animate-pulse' : 'bg-emerald-200'" />
                {{ state.transcodeWaiting ? 'Transcoding audio' : 'Transcoded stream' }}
              </span>
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

          <!-- Queue tab (mobile only, always mounted) -->
          <div
            class="sm:hidden absolute inset-0 flex flex-col pb-[env(safe-area-inset-bottom)] transition-opacity duration-200"
            :class="activeTab === 'queue' ? 'opacity-100' : 'opacity-0 pointer-events-none'"
          >
            <div class="flex items-center justify-between px-3 py-2 border-b border-white/10">
              <div class="text-xs uppercase tracking-[0.18em] text-white/60">
                Queue
              </div>
              <QueueActions
                button-class="p-1 rounded-full hover:bg-white/10 transition-colors text-zinc-300 hover:text-white"
                icon-class="w-5 h-5"
              />
            </div>
            <QueueList ref="queueList" rowPaddingClass="px-3" @navigate="toggleNowPlaying" />
          </div>

          </div><!-- end tab panels wrapper -->

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
