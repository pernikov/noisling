<script setup>
import { computed, onBeforeUnmount, ref } from "vue";
import { usePlayer } from "../composables/usePlayer.js";
import { useAccentColor } from "../composables/useAccentColor.js";
import { useTheme } from "../composables/useTheme.js";
import { useProgressScrub, formatTime } from "../composables/useProgressScrub.js";
import CoverArt from "./CoverArt.vue";
import QueueDrawer from "./QueueDrawer.vue";
import {
  mdiChevronUp,
  mdiSkipPrevious,
  mdiSkipNext,
  mdiPlay,
  mdiPause,
  mdiVolumeHigh,
  mdiVolumeOff,
  mdiRepeat,
  mdiRepeatOnce,
  mdiShuffle,
  mdiPlaylistMusic,
  mdiPlaylistPlus,
  mdiEyeOutline,
  mdiHeart,
  mdiHeartOutline,
} from "@mdi/js";
import Icon from "./Icon.vue";
import Tooltip from "./Tooltip.vue";
import TransportButton from "./TransportButton.vue";

const {
  state,
  toggle,
  pause,
  resume,
  next,
  prev,
  seek,
  setVolume,
  toggleMute,
  toggleShuffle,
  toggleVisualizer,
  toggleNowPlaying,
  toggleQueue,
  openAddToPlaylist,
  toggleLove,
  cycleRepeat,
  hasNext,
  hasPrev,
} = usePlayer();
const { accentColor: albumAccentColor } = useAccentColor();
const { accentColor, accentRgb } = useTheme();

const barStyle = computed(() => {
  if (!albumAccentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${albumAccentColor.value}, 0.25), rgba(${albumAccentColor.value}, 0.1) 60%, transparent)`,
  };
});

const activeAccentStyle = computed(() => ({
  color: `rgb(${accentRgb.value})`,
}));


// --- Progress scrubbing ---
const { isScrubbing, scrubPercent, displayPercent, displayTime, startMouseScrub } = useProgressScrub({ state, seek });
const hoverPercent = ref(null);
const showVolTooltip = ref(false);
const fullscreenBarDismissed = ref(false);
let fullscreenBarHideTimer = 0;

function revealFullscreenBar() {
  if (fullscreenBarHideTimer) {
    window.clearTimeout(fullscreenBarHideTimer);
    fullscreenBarHideTimer = 0;
  }
  fullscreenBarDismissed.value = false;
}

function scheduleFullscreenBarHide() {
  if (document.fullscreenElement !== document.documentElement) return;
  if (fullscreenBarHideTimer) window.clearTimeout(fullscreenBarHideTimer);
  fullscreenBarHideTimer = window.setTimeout(() => {
    fullscreenBarHideTimer = 0;
    fullscreenBarDismissed.value = true;
  }, 1800);
}

onBeforeUnmount(() => {
  if (fullscreenBarHideTimer) window.clearTimeout(fullscreenBarHideTimer);
});

function onProgressMouseDown(e) {
  const wasPlaying = state.isPlaying;
  startMouseScrub(e, {
    seekDuringDrag: false,
    onStart: () => { if (wasPlaying) pause(); },
    onEnd: () => { if (wasPlaying) resume(); },
  });
}

function onVolumeInput(e) {
  setVolume(parseFloat(e.target.value));
}

function onVolumeWheel(e) {
  const direction = e.deltaY > 0 ? -1 : 1;
  setVolume(Math.min(1, Math.max(0, state.volume + direction * 0.05)));
}

function onProgressMouseMove(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  hoverPercent.value = Math.max(0, Math.min(100, (e.clientX - rect.left) / rect.width * 100));
}

function onProgressMouseLeave() {
  hoverPercent.value = null;
}

// During scrubbing use the scrub position; otherwise use the mouse hover position.
const activeTooltipPercent = computed(() => {
  if (isScrubbing.value) return scrubPercent.value;
  return hoverPercent.value;
});

const hoverTime = computed(() => {
  const pct = activeTooltipPercent.value;
  if (pct === null || !state.duration) return null;
  return formatTime(pct / 100 * state.duration);
});
</script>

<template>
  <!-- Mobile mini-player -->
  <Transition name="slide-up-bar">
  <div
    v-if="state.currentTrack"
    class="player-bar-mobile sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-40 flex flex-col cursor-pointer active:bg-white/5"
    :style="barStyle"
    @click="toggleNowPlaying"
  >
    <div class="flex items-center gap-3 px-4 py-3">
      <div class="relative w-11 h-11 flex-shrink-0">
        <Transition name="cover-fade">
          <CoverArt
            :key="state.currentTrack._id"
            :cover="state.currentTrack.cover"
            size="w-11 h-11"
            show-spinner
            eager
            priority="high"
            fetchpriority="low"
          />
        </Transition>
      </div>
      <Transition name="track-fade" mode="out-in">
        <div
          :key="`${state.currentTrack._id}-${state.transcodeWaiting ? 'waiting' : state.transcodeActive ? 'active' : 'native'}`"
          class="flex-1 min-w-0"
        >
          <div class="flex items-center gap-1 min-w-0 text-[15px] font-medium">
            <span class="truncate">{{ state.currentTrack.title }}</span>
            <span
              v-if="state.transcodeWaiting || state.transcodeActive"
              class="inline-flex flex-none h-1.5 w-1.5 rounded-full"
              :class="state.transcodeWaiting ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'"
              aria-label="Transcode status"
              :title="state.transcodeWaiting ? 'Transcoding' : 'Transcoded'"
            />
          </div>
          <span class="text-[13px] text-zinc-400 truncate block mt-0.5">
            <template v-for="(artist, ai) in state.currentTrack.artists" :key="ai">
              <span v-if="ai > 0">, </span>{{ artist }}
            </template>
          </span>
        </div>
      </Transition>
      <div class="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500/90">
        <Icon :path="mdiChevronUp" class="h-4 w-4" aria-hidden="true" />
      </div>
    </div>
  </div>
  </Transition>

  <!-- Desktop full player bar -->
  <Transition name="slide-up-bar">
  <div
    v-if="state.currentTrack"
    class="player-bar-desktop hidden sm:flex flex-col fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-40"
    :class="{ 'player-bar--dismissed': fullscreenBarDismissed }"
    :style="barStyle"
    @pointerenter="revealFullscreenBar"
    @focusin="revealFullscreenBar"
    @click.capture="scheduleFullscreenBarHide"
  >
    <div class="flex items-center justify-between gap-4 px-4 py-3">
    <!-- Track info -->
    <div class="flex items-center gap-2 min-w-0 flex-none w-32 sm:w-56">
      <button
        class="relative flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded focus:outline-none focus-visible:ring-2"
        :class="`focus-visible:ring-${accentColor}-400`"
        @click="toggleNowPlaying"
        aria-label="Open Now Playing"
      >
        <Transition name="cover-fade">
          <CoverArt
            :key="state.currentTrack._id"
            :cover="state.currentTrack.cover"
            size="w-9 h-9 sm:w-10 sm:h-10"
            show-spinner
            eager
            priority="high"
            fetchpriority="low"
          />
        </Transition>
      </button>
      <Transition name="track-fade" mode="out-in">
      <div class="min-w-0" :key="state.currentTrack._id">
        <div
          class="flex items-center gap-1 min-w-0 text-sm font-medium cursor-pointer hover:text-zinc-300 transition-colors"
          @click="toggleNowPlaying"
        >
          <span class="truncate">{{ state.currentTrack.title }}</span>
          <span
            v-if="state.transcodeWaiting || state.transcodeActive"
            class="inline-flex flex-none items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.08em]"
            :class="state.transcodeWaiting ? 'border-amber-400/40 text-amber-300 bg-amber-500/10' : 'border-emerald-400/40 text-emerald-300 bg-emerald-500/10'"
            aria-label="Transcode status"
            :title="state.transcodeWaiting ? 'Transcoding' : 'Transcoded'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="state.transcodeWaiting ? 'bg-amber-300 animate-pulse' : 'bg-emerald-300'" />
            T
          </span>
        </div>
        <span class="text-xs text-zinc-400 truncate block">
          <template
            v-for="(artist, ai) in state.currentTrack.artists"
            :key="ai"
          >
            <span v-if="ai > 0">, </span>
            <router-link
              :to="{ name: 'artist', params: { name: artist } }"
              class="hover:text-zinc-100 hover:underline"
              >{{ artist }}</router-link
            >
          </template>
        </span>
      </div>
      </Transition>
    </div>

    <!-- Controls + progress -->
    <div class="flex-1 flex flex-col items-center gap-1 max-w-xl min-w-0">
      <div class="flex items-center gap-3">
        <!-- Shuffle -->
        <Tooltip label="Shuffle" :shortcut="state.shuffle ? 'S · on' : 'S'">
          <TransportButton
            size="sm"
            variant="bare"
            :icon="mdiShuffle"
            label="Shuffle"
            :active="state.shuffle"
            :active-style="activeAccentStyle"
            @click="toggleShuffle"
          />
        </Tooltip>

        <Tooltip label="Previous" shortcut="P">
          <TransportButton
            :disabled="!hasPrev"
            size="sm"
            variant="bare"
            :icon="mdiSkipPrevious"
            label="Previous"
            @click="prev"
          />
        </Tooltip>

        <Tooltip :label="state.isPlaying ? 'Pause' : 'Play'" shortcut="Space">
          <TransportButton size="sm" variant="solid" :label="state.isPlaying ? 'Pause' : 'Play'" @click="toggle">
            <template #icon>
              <Transition name="icon-swap" mode="out-in">
                <Icon v-if="state.isPlaying" :path="mdiPause" class="w-4 h-4" :key="'pause-desktop'" />
                <Icon v-else :path="mdiPlay" class="w-4 h-4" :key="'play-desktop'" />
              </Transition>
            </template>
          </TransportButton>
        </Tooltip>

        <Tooltip label="Next" shortcut="N">
          <TransportButton
            :disabled="!hasNext"
            size="sm"
            variant="bare"
            :icon="mdiSkipNext"
            label="Next"
            @click="next"
          />
        </Tooltip>

        <!-- Repeat -->
        <Tooltip :label="state.repeat === 'one' ? 'Repeat one' : state.repeat === 'all' ? 'Repeat all' : 'Repeat off'" shortcut="R">
          <TransportButton
            size="sm"
            variant="bare"
            :icon="state.repeat === 'one' ? mdiRepeatOnce : mdiRepeat"
            label="Repeat"
            :active="state.repeat !== 'off'"
            :active-style="activeAccentStyle"
            @click="cycleRepeat"
          />
        </Tooltip>
      </div>

      <!-- Progress bar -->
      <div class="w-full flex items-center gap-2 text-xs text-zinc-500 select-none">
        <span class="w-10 text-right tabular-nums">{{ formatTime(displayTime) }}</span>
        <!-- Tall hit area so the bar is easy to grab; visual bar stays h-1 -->
        <div
          class="flex-1 py-2 -my-2 group"
          :class="isScrubbing ? 'cursor-grabbing' : 'cursor-grab'"
          @mousedown.prevent="onProgressMouseDown"
          @mousemove="onProgressMouseMove"
          @mouseleave="onProgressMouseLeave"
        >
          <div class="relative h-1 bg-zinc-700 rounded">
            <Transition name="tooltip-fade">
              <div
                v-if="hoverTime"
                class="absolute -top-9 text-xs text-zinc-100 bg-zinc-800/95 backdrop-blur border border-zinc-700/60 px-2 py-1 rounded-md shadow-xl pointer-events-none tabular-nums z-10 bar-tooltip"
                :style="{ left: `clamp(24px, ${activeTooltipPercent}%, calc(100% - 24px))` }"
              >{{ hoverTime }}</div>
            </Transition>
            <div
              class="h-full rounded"
              :class="isScrubbing ? `bg-${accentColor}-400` : `bg-zinc-100 group-hover:bg-${accentColor}-400`"
              :style="{ width: displayPercent + '%' }"
            />
            <div
              class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow -translate-x-1/2 pointer-events-none transition-opacity"
              :class="isScrubbing ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
              :style="{ left: displayPercent + '%' }"
            />
          </div>
        </div>
        <span class="w-10 tabular-nums">{{ formatTime(state.duration) }}</span>
      </div>
    </div>

    <!-- Right group: love, visualizer, queue, volume -->
    <div
      class="player-bar-right-group hidden sm:flex items-center gap-px w-56 flex-shrink-0 justify-end"
    >
      <!-- Love -->
      <Tooltip :label="state.currentTrack.isLoved ? 'Unlove' : 'Love'" shortcut="L">
        <TransportButton
          size="xs"
          variant="bare"
          :icon="state.currentTrack.isLoved ? mdiHeart : mdiHeartOutline"
          :label="state.currentTrack.isLoved ? 'Unlove' : 'Love'"
          :active="state.currentTrack.isLoved"
          :active-style="{ color: '#fb7185' }"
          active-class="text-rose-400 hover:text-rose-300"
          @click="toggleLove()"
        />
      </Tooltip>

      <Tooltip label="Add to playlist" shortcut="A">
        <TransportButton
          size="xs"
          variant="bare"
          :icon="mdiPlaylistPlus"
          label="Add to playlist"
          @click="openAddToPlaylist"
        />
      </Tooltip>
      <!-- Queue toggle -->
      <Tooltip :label="'Queue (' + state.queue.length + ')'" shortcut="Q">
        <TransportButton
          size="xs"
          variant="bare"
          :icon="mdiPlaylistMusic"
          label="Queue"
          :active="state.showQueue"
          :active-style="activeAccentStyle"
          @click="toggleQueue"
        />
      </Tooltip>

      <!-- Visualizer -->
      <Tooltip label="Visualizer" shortcut="V">
        <TransportButton
          size="xs"
          variant="bare"
          :icon="mdiEyeOutline"
          label="Visualizer"
          :active="state.showVisualizer"
          :active-style="activeAccentStyle"
          :disabled="!state.currentTrack"
          @click="toggleVisualizer"
        />
      </Tooltip>

      <!-- Volume -->
      <div class="ml-1.5 flex items-center gap-1.5 w-32 flex-none" @wheel.prevent="onVolumeWheel">
        <Tooltip :label="state.volume === 0 ? 'Unmute' : 'Mute'" shortcut="M">
          <TransportButton
            size="xs"
            variant="bare"
            :icon="state.volume === 0 ? mdiVolumeOff : mdiVolumeHigh"
            :label="state.volume === 0 ? 'Unmute' : 'Mute'"
            @click="toggleMute"
          />
        </Tooltip>
        <div class="relative flex-1 flex items-center" @mouseenter="showVolTooltip = true" @mouseleave="showVolTooltip = false">
          <Transition name="tooltip-fade">
            <div
              v-if="showVolTooltip"
              class="absolute -top-9 text-xs text-zinc-100 bg-zinc-800/95 backdrop-blur border border-zinc-700/60 px-2 py-1 rounded-md shadow-xl pointer-events-none tabular-nums z-10 bar-tooltip"
              :style="{ left: `clamp(20px, ${state.volume * 100}%, calc(100% - 20px))` }"
            >{{ Math.round(state.volume * 100) }}%</div>
          </Transition>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="state.volume"
            class="w-full h-1 appearance-none bg-zinc-700 rounded outline-none accent-zinc-100"
            @input="onVolumeInput"
          />
        </div>
      </div>
    </div>
    </div>
  </div>
  </Transition>

  <!-- Queue drawer -->
  <QueueDrawer :open="state.showQueue" @close="toggleQueue" />
</template>

<style scoped>
/* Player bar slides up from the bottom on first appearance */
.slide-up-bar-enter-active {
  transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.3s ease;
}
.slide-up-bar-leave-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.slide-up-bar-enter-from,
.slide-up-bar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Track title/artist fades between tracks */
.track-fade-enter-active,
.track-fade-leave-active {
  transition: opacity 0.15s ease;
}
.track-fade-enter-from,
.track-fade-leave-to {
  opacity: 0;
}

/* Album cover crossfades between tracks */
.cover-fade-enter-active,
.cover-fade-leave-active {
  transition: opacity 0.2s ease;
}
.cover-fade-leave-active {
  position: absolute;
  inset: 0;
}
.cover-fade-enter-from,
.cover-fade-leave-to {
  opacity: 0;
}

/* Shared progress/volume tooltip */
.bar-tooltip {
  transform: translateX(-50%);
}
.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(5px) scale(0.93);
}

/* Play/pause and volume icon swaps */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 0.1s ease;
}
.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
}

@media (max-width: 1199px) {
  .player-bar-mobile {
    display: flex;
  }

  .player-bar-desktop {
    display: none;
  }

  .player-bar-right-group {
    display: none;
  }
}

@media (min-width: 1200px) and (hover: hover) and (pointer: fine) {
  :global(html:fullscreen .player-bar-desktop) {
    opacity: 0;
    transform: translateY(calc(100% - 0.75rem));
    transition:
      transform 0.24s cubic-bezier(0.32, 0.72, 0, 1),
      opacity 0.18s ease;
  }

  :global(html:fullscreen .player-bar-desktop:hover:not(.player-bar--dismissed)),
  :global(html:fullscreen .player-bar-desktop:focus-within:not(.player-bar--dismissed)) {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
