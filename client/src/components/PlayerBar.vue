<script setup>
import { computed, ref } from "vue";
import { usePlayer } from "../composables/usePlayer.js";
import { useAccentColor } from "../composables/useAccentColor.js";
import { useTheme } from "../composables/useTheme.js";
import CoverArt from "./CoverArt.vue";
import QueueDrawer from "./QueueDrawer.vue";
import {
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
  mdiWaveform,
} from "@mdi/js";
import Icon from "./Icon.vue";

const {
  state,
  toggle,
  next,
  prev,
  seek,
  setVolume,
  toggleMute,
  toggleShuffle,
  toggleVisualizer,
  toggleNowPlaying,
  toggleQueue,
  cycleRepeat,
  hasNext,
  hasPrev,
} = usePlayer();
const { accentColor: albumAccentColor } = useAccentColor();
const { accentColor } = useTheme();

const barStyle = computed(() => {
  if (!albumAccentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${albumAccentColor.value}, 0.25), rgba(${albumAccentColor.value}, 0.1) 60%, transparent)`,
  };
});


function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return "0:00";
  if (!isFinite(seconds)) return "--:--";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// --- Progress scrubbing ---
// Track a separate visual position during drag so the bar follows the cursor
// exactly, regardless of where the audio element actually seeks to (browsers
// snap seeks to the nearest keyframe, which can be ±several seconds off).
const isScrubbing = ref(false);
const scrubPercent = ref(0);

const displayPercent = computed(() => {
  if (isScrubbing.value) return scrubPercent.value;
  if (!state.duration) return 0;
  return (state.currentTime / state.duration) * 100;
});

const displayTime = computed(() => {
  if (isScrubbing.value && state.duration) return scrubPercent.value / 100 * state.duration;
  return state.currentTime;
});

function onProgressMouseDown(e) {
  if (!state.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const clamp = (x) => Math.max(0, Math.min(100, (x - rect.left) / rect.width * 100));

  isScrubbing.value = true;
  scrubPercent.value = clamp(e.clientX);
  seek(scrubPercent.value / 100 * state.duration);

  const onMove = (ev) => {
    scrubPercent.value = clamp(ev.clientX);
    seek(scrubPercent.value / 100 * state.duration);
  };
  const onUp = (ev) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    scrubPercent.value = clamp(ev.clientX);
    seek(scrubPercent.value / 100 * state.duration);
    isScrubbing.value = false;
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function onVolumeInput(e) {
  setVolume(parseFloat(e.target.value));
}
</script>

<template>
  <!-- Mobile mini-player -->
  <Transition name="slide-up-bar">
  <div
    v-if="state.currentTrack"
    class="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-40 flex items-center gap-3 px-4 py-2 cursor-pointer active:bg-white/5"
    :style="barStyle"
    @click="toggleNowPlaying"
  >
    <CoverArt :cover="state.currentTrack.cover" size="w-10 h-10" />
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium truncate">
        {{ state.currentTrack.title }}
      </div>
      <span class="text-xs text-zinc-400 truncate block">
        <template v-for="(artist, ai) in state.currentTrack.artists" :key="ai">
          <span v-if="ai > 0">, </span>{{ artist }}
        </template>
      </span>
    </div>
    <div class="flex items-center gap-1 flex-shrink-0">
      <button
        :disabled="!hasPrev"
        class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors p-1"
        @click.stop="prev"
      >
        <Icon :path="mdiSkipPrevious" class="w-5 h-5" />
      </button>
      <button
        class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center"
        @click.stop="toggle"
      >
        <Transition name="icon-swap" mode="out-in">
          <Icon v-if="state.isPlaying" :path="mdiPause" class="w-4 h-4" :key="'pause-mobile'" />
          <Icon v-else :path="mdiPlay" class="w-4 h-4" :key="'play-mobile'" />
        </Transition>
      </button>
      <button
        :disabled="!hasNext"
        class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors p-1"
        @click.stop="next"
      >
        <Icon :path="mdiSkipNext" class="w-5 h-5" />
      </button>
    </div>
  </div>
  </Transition>

  <!-- Desktop full player bar -->
  <Transition name="slide-up-bar">
  <div
    v-if="state.currentTrack"
    class="hidden sm:flex fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 items-center justify-between gap-4 z-40"
    :style="barStyle"
  >
    <!-- Track info -->
    <div class="flex items-center gap-2 min-w-0 flex-none w-32 sm:w-56">
      <button
        class="flex-shrink-0 rounded focus:outline-none focus-visible:ring-2"
        :class="`focus-visible:ring-${accentColor}-400`"
        @click="toggleNowPlaying"
        aria-label="Open Now Playing"
      >
        <CoverArt
          :cover="state.currentTrack.cover"
          size="w-9 h-9 sm:w-10 sm:h-10"
        />
      </button>
      <Transition name="track-fade" mode="out-in">
      <div class="min-w-0" :key="state.currentTrack._id">
        <div
          class="text-sm font-medium truncate cursor-pointer hover:text-zinc-300 transition-colors"
          @click="toggleNowPlaying"
        >
          {{ state.currentTrack.title }}
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
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Mobile-only: shuffle -->
        <button
          class="sm:hidden transition-colors"
          :class="state.shuffle ? `text-${accentColor}-400` : 'text-zinc-400 hover:text-zinc-100'"
          @click="toggleShuffle"
        >
          <Icon :path="mdiShuffle" class="w-4 h-4" />
        </button>

        <button
          :disabled="!hasPrev"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors"
          title="(P) Previous song"
          @click="prev"
        >
          <Icon :path="mdiSkipPrevious" class="w-5 h-5" />
        </button>

        <button
          class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center hover:scale-105 transition-transform"
          @click="toggle"
          :title="'(Space) ' + (state.isPlaying ? 'Pause' : 'Play')"
        >
          <Transition name="icon-swap" mode="out-in">
            <Icon v-if="state.isPlaying" :path="mdiPause" class="w-4 h-4" :key="'pause-desktop'" />
            <Icon v-else :path="mdiPlay" class="w-4 h-4" :key="'play-desktop'" />
          </Transition>
        </button>

        <button
          :disabled="!hasNext"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors"
          title="(N) Next song"
          @click="next"
        >
          <Icon :path="mdiSkipNext" class="w-5 h-5" />
        </button>

        <!-- Mobile-only: queue -->
        <button
          class="sm:hidden transition-colors"
          :class="state.showQueue ? `text-${accentColor}-400` : 'text-zinc-400 hover:text-zinc-100'"
          @click="toggleQueue"
        >
          <Icon :path="mdiPlaylistMusic" class="w-4 h-4" />
        </button>
      </div>

      <!-- Progress bar -->
      <div class="w-full flex items-center gap-2 text-xs text-zinc-500 select-none">
        <span class="w-10 text-right tabular-nums">{{ formatTime(displayTime) }}</span>
        <!-- Tall hit area so the bar is easy to grab; visual bar stays h-1 -->
        <div
          class="flex-1 py-2 -my-2 group"
          :class="isScrubbing ? 'cursor-grabbing' : 'cursor-grab'"
          @mousedown.prevent="onProgressMouseDown"
        >
          <div class="relative h-1 bg-zinc-700 rounded">
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

    <!-- Right group: shuffle, queue, volume -->
    <div
      class="hidden sm:flex items-center gap-3 w-56 flex-shrink-0 justify-end"
    >
      <!-- Visualizer -->
      <button
        class="transition-colors disabled:text-zinc-700"
        :class="
          state.showVisualizer ? `text-${accentColor}-400` : 'text-zinc-400 hover:text-zinc-100'
        "
        :disabled="!state.currentTrack"
        @click="toggleVisualizer"
        title="(V) Toggle visualizer"
      >
        <Icon :path="mdiWaveform" class="w-4 h-4" />
      </button>

      <!-- Repeat -->
      <button
        class="transition-colors"
        :class="
          state.repeat !== 'off' ? `text-${accentColor}-400` : 'text-zinc-400 hover:text-zinc-100'
        "
        @click="cycleRepeat"
        :title="'(R) Repeat: ' + state.repeat"
      >
        <Icon
          v-if="state.repeat === 'one'"
          :path="mdiRepeatOnce"
          class="w-4 h-4"
        />
        <Icon v-else :path="mdiRepeat" class="w-4 h-4" />
      </button>

      <!-- Shuffle -->
      <button
        class="transition-colors"
        :class="
          state.shuffle ? `text-${accentColor}-400` : 'text-zinc-400 hover:text-zinc-100'
        "
        @click="toggleShuffle"
        :title="'(S) Shuffle: ' + (state.shuffle ? 'on' : 'off')"
      >
        <Icon :path="mdiShuffle" class="w-4 h-4" />
      </button>

      <!-- Queue toggle -->
      <button
        class="transition-colors"
        :class="
          state.showQueue ? `text-${accentColor}-400` : 'text-zinc-400 hover:text-zinc-100'
        "
        @click="toggleQueue"
        :title="'(Q) Queue (' + state.queue.length + ' tracks)'"
      >
        <Icon :path="mdiPlaylistMusic" class="w-4 h-4" />
      </button>

      <!-- Volume -->
      <div class="flex items-center gap-1.5 flex-1">
        <button
          class="text-zinc-400 hover:text-zinc-100 transition-colors flex-shrink-0"
          @click="toggleMute"
          :title="'(M) ' + (state.volume === 0 ? 'Unmute' : 'Mute')"
        >
          <Icon v-if="state.volume === 0" :path="mdiVolumeOff" class="w-4 h-4" />
          <Icon v-else :path="mdiVolumeHigh" class="w-4 h-4" />
        </button>
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

/* Play/pause and volume icon swaps */
.icon-swap-enter-active,
.icon-swap-leave-active {
  transition: opacity 0.1s ease;
}
.icon-swap-enter-from,
.icon-swap-leave-to {
  opacity: 0;
}
</style>
