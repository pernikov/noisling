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
import AddToPlaylistModal from './AddToPlaylistModal.vue';
import TransportButton from './TransportButton.vue';
import DeferredImage from './DeferredImage.vue';
import { useToast } from '../composables/useToast.js';
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
  mdiPlaylistPlus,
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
  openAddToPlaylist,
  closeAddToPlaylist,
  toggleLove,
  hasNext,
  hasPrev,
} = usePlayer();

const { accentColor: albumAccentColor } = useAccentColor();
const { accentColor, accentRgb } = useTheme();
const { show: showToast } = useToast();
const api = useApi();
const coverUrl = computed(() =>
  state.currentTrack?.cover ? api.coverUrl(state.currentTrack.cover) : null
);

function onPlaylistAdded(playlistName) {
  if (playlistName) showToast(`Added to "${playlistName}"`);
  else showToast('Failed to add to playlist');
}

// --- Tab state ---
const activeTab = ref('nowplaying');
const queueList = ref(null);
const modalRoot = ref(null);
const coverDragEl = ref(null);
const prevHintEl = ref(null);
const nextHintEl = ref(null);

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
let coverSwapToken = 0;

watch(coverUrl, (newUrl) => {
  const previousUrl = displayedCoverUrl.value;
  prevCoverUrl.value = previousUrl && previousUrl !== newUrl ? previousUrl : null;
  displayedCoverUrl.value = newUrl;
  currLoaded.value = !newUrl; // no image → nothing to wait for
  coverSwapToken += 1;
}, { immediate: true });

function onCoverLoad() {
  currLoaded.value = true;
  const swapToken = coverSwapToken;
  window.setTimeout(() => {
    if (swapToken === coverSwapToken) prevCoverUrl.value = null;
  }, 350);
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
let touchStartY = 0;
let touchStartX = 0;
let swipeActive = false;
let swipeDirection = null; // 'vertical' | 'horizontal' | null — locked after first 10px
let dragX = 0;
let dragY = 0;
let gestureFrame = 0;
const isClosingByDrag = ref(false);
let verticalPeakY = 0;
let verticalCloseCancelled = false;

function setHintOpacity(el, opacity) {
  if (!el) return;
  el.style.opacity = String(opacity);
}

function applyGestureFrame() {
  gestureFrame = 0;

  if (swipeDirection === 'vertical') {
    if (modalRoot.value) {
      modalRoot.value.style.transform = dragY > 0 ? `translateY(${dragY}px)` : '';
    }
    if (coverDragEl.value) {
      coverDragEl.value.style.transform = '';
      coverDragEl.value.style.transition = '';
    }
    setHintOpacity(prevHintEl.value, 0);
    setHintOpacity(nextHintEl.value, 0);
    return;
  }

  if (swipeDirection === 'horizontal') {
    if (coverDragEl.value) {
      const translateX = dragX * 0.45;
      const rotate = Math.max(-12, Math.min(12, dragX * 0.08));
      const scale = 1 + Math.min(Math.abs(dragX) * 0.0003, 0.03);
      coverDragEl.value.style.transition = 'none';
      coverDragEl.value.style.transform = `translateX(${translateX}px) rotate(${rotate}deg) scale(${scale})`;
    }

    const threshold = 60;
    const opacity = Math.min(1, Math.max(0, (Math.abs(dragX) - 15) / (threshold - 15)));
    setHintOpacity(prevHintEl.value, dragX > 0 && hasPrev.value ? opacity : 0);
    setHintOpacity(nextHintEl.value, dragX < 0 && hasNext.value ? opacity : 0);
    return;
  }

  if (modalRoot.value) modalRoot.value.style.transform = '';
  if (coverDragEl.value) {
    coverDragEl.value.style.transform = '';
    coverDragEl.value.style.transition = '';
  }
  setHintOpacity(prevHintEl.value, 0);
  setHintOpacity(nextHintEl.value, 0);
}

function scheduleGestureFrame() {
  if (gestureFrame) return;
  gestureFrame = window.requestAnimationFrame(applyGestureFrame);
}

function resetGestureStyles() {
  if (gestureFrame) {
    window.cancelAnimationFrame(gestureFrame);
    gestureFrame = 0;
  }
  if (modalRoot.value) {
    modalRoot.value.style.transform = '';
    modalRoot.value.style.transition = '';
  }
  if (coverDragEl.value) {
    coverDragEl.value.style.transform = '';
    coverDragEl.value.style.transition = '';
  }
  setHintOpacity(prevHintEl.value, 0);
  setHintOpacity(nextHintEl.value, 0);
}

function onTouchStart(e) {
  if (activeTab.value === 'queue') { swipeActive = false; return; }
  if (e.target.closest('[data-no-swipe]')) { swipeActive = false; return; }
  touchStartY = e.touches[0].clientY;
  touchStartX = e.touches[0].clientX;
  swipeActive = true;
  dragY = 0;
  dragX = 0;
  verticalPeakY = 0;
  verticalCloseCancelled = false;
  swipeDirection = null;
  resetGestureStyles();
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
    const nextDragY = Math.max(0, deltaY);
    if (nextDragY > verticalPeakY) {
      verticalPeakY = nextDragY;
      verticalCloseCancelled = false;
    } else if (verticalPeakY > 80 && nextDragY < verticalPeakY - 14) {
      // Let a deliberate upward reversal cancel the close gesture.
      verticalCloseCancelled = true;
    }
    dragY = nextDragY;
    scheduleGestureFrame();
  } else if (swipeDirection === 'horizontal') {
    dragX = deltaX;
    scheduleGestureFrame();
  }
}

function onTouchEnd() {
  if (!swipeActive) return;
  swipeActive = false;

  if (swipeDirection === 'vertical') {
    if (dragY > 80 && !verticalCloseCancelled) {
      isClosingByDrag.value = true;
      if (modalRoot.value) {
        modalRoot.value.style.transition = 'transform 0.38s cubic-bezier(0.22, 0.78, 0, 1)';
        modalRoot.value.style.transform = `translateY(${window.innerHeight}px)`;
      }
      setTimeout(() => {
        dragY = 0;
        toggleNowPlaying();
      }, 380);
    } else {
      dragY = 0;
      if (modalRoot.value) {
        modalRoot.value.style.transition = 'transform 0.34s cubic-bezier(0.22, 1, 0.36, 1)';
        modalRoot.value.style.transform = '';
      }
      setTimeout(() => {
        if (modalRoot.value) modalRoot.value.style.transition = '';
      }, 340);
    }
  } else if (swipeDirection === 'horizontal') {
    const THRESHOLD = 60;
    const triggered = (dragX < -THRESHOLD && hasNext.value) || (dragX > THRESHOLD && hasPrev.value);
    if (!triggered) {
      if (coverDragEl.value) {
        coverDragEl.value.style.transition = 'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1)';
        coverDragEl.value.style.transform = '';
      }
      setHintOpacity(prevHintEl.value, 0);
      setHintOpacity(nextHintEl.value, 0);
      setTimeout(() => {
        if (coverDragEl.value) coverDragEl.value.style.transition = '';
      }, 480);
    }
    if (dragX < -THRESHOLD && hasNext.value) next();
    else if (dragX > THRESHOLD && hasPrev.value) prev();
    dragX = 0;
    if (triggered) resetGestureStyles();
  } else {
    resetGestureStyles();
  }

  swipeDirection = null;
  verticalPeakY = 0;
  verticalCloseCancelled = false;
}

const outerStyle = computed(() => ({
  zIndex: 60,
  touchAction: activeTab.value === 'queue' ? 'pan-y' : 'none',
}));

watch(
  () => state.showNowPlaying,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) {
      activeTab.value = 'nowplaying';
      isClosingByDrag.value = false;
      resetGestureStyles();
      return;
    }

    nextTick(() => {
      resetGestureStyles();
      isClosingByDrag.value = false;
    });
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
  resetGestureStyles();
  if (state.showNowPlaying) {
    document.body.style.overflow = '';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition :name="isClosingByDrag ? '' : 'slide-up'">
      <div
        v-if="state.showNowPlaying && state.currentTrack"
        ref="modalRoot"
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
          <DeferredImage
            v-if="prevCoverUrl"
            :src="prevCoverUrl"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            :style="{ filter: 'blur(80px)', transform: 'scale(1.2)', opacity: currLoaded ? 0 : 0.9 }"
            eager
            priority="high"
          />
          <DeferredImage
            v-if="displayedCoverUrl"
            :src="displayedCoverUrl"
            alt=""
            aria-hidden="true"
            class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
            :style="{ filter: 'blur(80px)', transform: 'scale(1.2)', opacity: currLoaded ? 0.9 : 0 }"
            eager
            priority="high"
          />
          <div class="absolute inset-0 bg-black/40" />
          <div class="absolute inset-0" :style="{ background: accentOverlay }" />
        </div>

        <!-- Content -->
        <div class="now-playing-modal relative z-10 flex flex-col h-full px-6">

          <!-- Drag pill -->
          <div class="flex justify-center pt-[calc(0.75rem+env(safe-area-inset-top))] pb-1 flex-shrink-0">
            <div class="w-10 h-1 bg-white/30 rounded-full" />
          </div>

          <!-- Top bar -->
          <div class="relative flex items-center py-3 flex-shrink-0">
            <button
              class="text-zinc-300 hover:text-white transition-colors p-1 -ml-1 rounded-full hover:bg-white/10"
              @click="toggleNowPlaying"
              aria-label="Close Now Playing"
            >
              <Icon :path="mdiChevronDown" class="w-7 h-7" />
            </button>

            <!-- Compact layout tab switcher (desktop has the queue drawer) -->
            <div class="now-playing-mobile-tabs absolute left-1/2 -translate-x-1/2 flex bg-white/10 rounded-full p-1">
              <button
                class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                :class="activeTab === 'nowplaying' ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white'"
                @click="activeTab = 'nowplaying'"
              >Playing</button>
              <button
                class="px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors"
                :class="activeTab === 'queue' ? 'bg-white text-zinc-900' : 'text-white/70 hover:text-white'"
                @click="activeTab = 'queue'"
              >Queue</button>
            </div>
            <span class="now-playing-desktop-title pointer-events-none absolute left-1/2 -translate-x-1/2 text-xs uppercase tracking-widest text-zinc-400 font-medium">Now Playing</span>

            <!-- Track actions (hidden in queue tab) -->
            <div v-if="activeTab === 'nowplaying'" class="ml-auto flex items-center gap-0.5 -mr-1">
              <TransportButton
                size="md"
                :icon="mdiPlaylistPlus"
                label="Add to playlist"
                variant="bare"
                @click="openAddToPlaylist"
              />
              <TransportButton
                size="md"
                :icon="state.currentTrack.isLoved ? mdiHeart : mdiHeartOutline"
                :label="state.currentTrack.isLoved ? 'Unlove' : 'Love'"
                variant="bare"
                :active="state.currentTrack.isLoved"
                :active-style="{ color: '#fb7185' }"
                active-class="text-rose-400 hover:text-rose-300"
                @click="toggleLove()"
              />
            </div>
            <div v-else class="ml-auto w-[5.5rem] h-11 flex-shrink-0" aria-hidden="true" />
          </div>

          <!-- Tab content: both panels always mounted, crossfade via CSS opacity -->
          <div class="relative flex-1 min-h-0">

          <!-- Now Playing content -->
          <div
            class="now-playing-panel absolute inset-0 flex flex-col transition-opacity duration-200"
            :class="activeTab === 'nowplaying' ? 'opacity-100' : 'opacity-0 pointer-events-none'"
          >

            <!-- Album art -->
            <div class="now-playing-art-wrap flex-1 flex items-center justify-center py-2 min-h-0">
            <div
              ref="coverDragEl"
              class="now-playing-art relative w-full"
              style="max-width: min(100%, 60vh, 400px);"
            >
              <!-- Swipe-to-prev hint (dragging right) -->
              <div
                ref="prevHintEl"
                class="absolute inset-y-0 left-0 flex items-center pointer-events-none z-10"
                style="opacity: 0;"
              >
                <div class="bg-black/70 rounded-full p-3 shadow-lg -translate-x-1/2 backdrop-blur-sm">
                  <Icon :path="mdiSkipPrevious" class="w-7 h-7 text-white" />
                </div>
              </div>
              <!-- Swipe-to-next hint (dragging left) -->
              <div
                ref="nextHintEl"
                class="absolute inset-y-0 right-0 flex items-center pointer-events-none z-10"
                style="opacity: 0;"
              >
                <div class="bg-black/70 rounded-full p-3 shadow-lg translate-x-1/2 backdrop-blur-sm">
                  <Icon :path="mdiSkipNext" class="w-7 h-7 text-white" />
                </div>
              </div>

              <div
                class="relative aspect-square w-full rounded-lg overflow-hidden"
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

                <!-- Previous cover stays mounted until the new one is ready -->
                <DeferredImage
                  v-if="prevCoverUrl"
                  :key="`prev-${prevCoverUrl}`"
                  :src="prevCoverUrl"
                  alt=""
                  aria-hidden="true"
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  :class="currLoaded ? 'opacity-0' : 'opacity-100'"
                  loaded-class=""
                  pending-class=""
                  eager
                  priority="high"
                />

                <!-- Current cover fading in when loaded -->
                <DeferredImage
                  v-if="displayedCoverUrl"
                  :key="displayedCoverUrl"
                  :src="displayedCoverUrl"
                  alt="Album art"
                  class="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                  :class="currLoaded ? 'opacity-100' : 'opacity-0'"
                  loading="eager"
                  fetchpriority="low"
                  eager
                  priority="high"
                  loaded-class=""
                  pending-class=""
                  @loaded="onCoverLoad"
                />
              </div>
            </div>
            </div>

            <!-- Bottom section -->
            <div class="now-playing-details flex flex-col gap-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex-shrink-0" data-no-swipe>

            <!-- Track info -->
            <div class="now-playing-track-info">
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
            <div class="now-playing-progress">
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
            <div class="now-playing-controls flex items-center justify-between">
              <TransportButton
                size="md"
                :icon="mdiShuffle"
                label="Shuffle"
                variant="bare"
                :active="state.shuffle"
                :active-style="{ color: `rgb(${accentRgb})` }"
                @click="toggleShuffle"
              />

              <TransportButton
                :disabled="!hasPrev"
                size="md"
                :icon="mdiSkipPrevious"
                label="Previous"
                variant="bare"
                @click="prev"
              />

              <TransportButton
                size="lg"
                variant="solid"
                :label="state.isPlaying ? 'Pause' : 'Play'"
                @click="toggle"
              >
                <template #icon>
                  <Transition name="icon-swap" mode="out-in">
                    <Icon v-if="state.isPlaying" :path="mdiPause" class="w-8 h-8" :key="'pause'" />
                    <Icon v-else :path="mdiPlay" class="w-8 h-8" :key="'play'" />
                  </Transition>
                </template>
              </TransportButton>

              <TransportButton
                :disabled="!hasNext"
                size="md"
                :icon="mdiSkipNext"
                label="Next"
                variant="bare"
                @click="next"
              />

              <TransportButton
                size="md"
                :icon="state.repeat === 'one' ? mdiRepeatOnce : mdiRepeat"
                label="Repeat"
                variant="bare"
                :active="state.repeat !== 'off'"
                :active-style="{ color: `rgb(${accentRgb})` }"
                @click="cycleRepeat"
              />
            </div>


          </div>
          </div>

          <!-- Queue tab (compact layout only, always mounted) -->
          <div
            v-if="activeTab === 'queue'"
            class="now-playing-queue-panel absolute inset-0 flex flex-col pb-[env(safe-area-inset-bottom)] transition-opacity duration-200 opacity-100"
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
            <QueueList ref="queueList" rowPaddingClass="px-3" roomy-mobile @navigate="toggleNowPlaying" />
          </div>

          </div><!-- end tab panels wrapper -->

        </div>
      </div>
    </Transition>
  </Teleport>

  <AddToPlaylistModal
    v-if="state.showAddToPlaylist && state.currentTrack"
    :track="state.currentTrack"
    @close="closeAddToPlaylist"
    @added="onPlaylistAdded"
  />
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

.now-playing-mobile-tabs,
.now-playing-queue-panel {
  display: none;
}

.now-playing-desktop-title {
  display: block;
}

@media (max-width: 1199px) {
  .now-playing-mobile-tabs,
  .now-playing-queue-panel {
    display: flex;
  }

  .now-playing-desktop-title {
    display: none;
  }
}

@media (orientation: landscape) and (max-height: 500px) and (pointer: coarse) {
  .now-playing-modal > .flex.justify-center {
    display: none;
  }

  .now-playing-modal > .relative.flex.items-center.py-3 {
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .now-playing-modal {
    padding-left: 1rem;
    padding-right: 1rem;
  }

  .now-playing-panel {
    flex-direction: row;
    align-items: stretch;
    gap: 1rem;
    overflow-y: auto;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom));
  }

  .now-playing-art-wrap {
    flex: 0 0 auto;
    width: min(42vw, calc(100vh - 8rem));
    align-items: flex-start;
    justify-content: center;
    padding-top: 0.25rem;
    padding-bottom: 0.25rem;
  }

  .now-playing-art {
    width: min(42vw, calc(100vh - 8rem)) !important;
    max-width: min(42vw, calc(100vh - 8rem)) !important;
  }

  .now-playing-details {
    flex: 1 1 auto;
    min-width: 0;
    justify-content: center;
    gap: 0.875rem;
    padding-bottom: 0;
  }

  .now-playing-track-info .text-xl {
    font-size: 1.125rem;
    line-height: 1.4rem;
  }

  .now-playing-track-info .text-sm {
    margin-top: 0.25rem;
  }

  .now-playing-progress .h-8 {
    height: 1.5rem;
  }

  .now-playing-controls {
    gap: 0.25rem;
  }
}

</style>
