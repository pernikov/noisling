<script setup>
import { ref, computed } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';
import CoverArt from './CoverArt.vue';
import QueueDrawer from './QueueDrawer.vue';
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
  mdiEqualizer,
} from '@mdi/js';
import Icon from './Icon.vue';

const { state, toggle, next, prev, seek, setVolume, toggleMute, toggleShuffle, toggleVisualizer, toggleNowPlaying, cycleRepeat, hasNext, hasPrev } = usePlayer();
const { accentColor } = useAccentColor();

const barStyle = computed(() => {
  if (!accentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${accentColor.value}, 0.25), rgba(${accentColor.value}, 0.1) 60%, transparent)`,
  };
});

const queueOpen = ref(false);

function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  if (!isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function onProgressClick(e) {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  seek(ratio * state.duration);
}

function onVolumeInput(e) {
  setVolume(parseFloat(e.target.value));
}

function progressPercent() {
  if (!state.duration) return 0;
  return (state.currentTime / state.duration) * 100;
}
</script>

<template>
  <!-- Mobile mini-player -->
  <div
    v-if="state.currentTrack"
    class="sm:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-40 flex items-center gap-3 px-4 py-2 cursor-pointer active:bg-white/5"
    :style="barStyle"
    @click="toggleNowPlaying"
  >
    <CoverArt :cover="state.currentTrack.cover" size="w-10 h-10" />
    <div class="flex-1 min-w-0">
      <div class="text-sm font-medium truncate">{{ state.currentTrack.title }}</div>
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
        <Icon v-if="state.isPlaying" :path="mdiPause" class="w-4 h-4" />
        <Icon v-else :path="mdiPlay" class="w-4 h-4" />
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

  <!-- Desktop full player bar -->
  <div
    v-if="state.currentTrack"
    class="hidden sm:flex fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 items-center justify-between gap-4 z-40"
    :style="barStyle"
  >
    <!-- Track info -->
    <div class="flex items-center gap-2 min-w-0 flex-none w-32 sm:w-56">
      <button class="flex-shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400" @click="toggleNowPlaying" aria-label="Open Now Playing">
        <CoverArt :cover="state.currentTrack.cover" size="w-9 h-9 sm:w-10 sm:h-10" />
      </button>
      <div class="min-w-0">
        <div class="text-sm font-medium truncate cursor-pointer hover:text-zinc-300 transition-colors" @click="toggleNowPlaying">{{ state.currentTrack.title }}</div>
        <span class="text-xs text-zinc-400 truncate block">
          <template v-for="(artist, ai) in state.currentTrack.artists" :key="ai">
            <span v-if="ai > 0">, </span>
            <router-link
              :to="{ name: 'artist', params: { name: artist } }"
              class="hover:text-zinc-100 hover:underline"
            >{{ artist }}</router-link>
          </template>
        </span>
      </div>
    </div>

    <!-- Controls + progress -->
    <div class="flex-1 flex flex-col items-center gap-1 max-w-xl min-w-0">
      <div class="flex items-center gap-2 sm:gap-4">
        <!-- Mobile-only: shuffle -->
        <button
          class="sm:hidden transition-colors"
          :class="state.shuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
          @click="toggleShuffle"
        >
          <Icon :path="mdiShuffle" class="w-4 h-4" />
        </button>

        <button
          :disabled="!hasPrev"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors"
          @click="prev"
        >
          <Icon :path="mdiSkipPrevious" class="w-5 h-5" />
        </button>

        <button
          class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center hover:scale-105 transition-transform"
          @click="toggle"
        >
          <Icon v-if="state.isPlaying" :path="mdiPause" class="w-4 h-4" />
          <Icon v-else :path="mdiPlay" class="w-4 h-4" />
        </button>

        <button
          :disabled="!hasNext"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors"
          @click="next"
        >
          <Icon :path="mdiSkipNext" class="w-5 h-5" />
        </button>

        <!-- Mobile-only: queue -->
        <button
          class="sm:hidden transition-colors"
          :class="queueOpen ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
          @click="queueOpen = !queueOpen"
        >
          <Icon :path="mdiPlaylistMusic" class="w-4 h-4" />
        </button>
      </div>

      <!-- Progress bar -->
      <div class="w-full flex items-center gap-2 text-xs text-zinc-500">
        <span class="w-10 text-right tabular-nums">{{ formatTime(state.currentTime) }}</span>
        <div
          class="flex-1 h-1 bg-zinc-700 rounded cursor-pointer group"
          @click="onProgressClick"
        >
          <div
            class="h-full bg-zinc-100 rounded group-hover:bg-emerald-400 transition-colors"
            :style="{ width: progressPercent() + '%' }"
          />
        </div>
        <span class="w-10 tabular-nums">{{ formatTime(state.duration) }}</span>
      </div>
    </div>

    <!-- Right group: shuffle, queue, volume -->
    <div class="hidden sm:flex items-center gap-3 w-56 flex-shrink-0 justify-end">
      <!-- Visualizer -->
      <button
        class="transition-colors"
        :class="state.showVisualizer ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="toggleVisualizer"
        title="Toggle visualizer"
      >
        <Icon :path="mdiEqualizer" class="w-4 h-4" />
      </button>

      <!-- Repeat -->
      <button
        class="transition-colors"
        :class="state.repeat !== 'off' ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="cycleRepeat"
        :title="'Repeat: ' + state.repeat"
      >
        <Icon v-if="state.repeat === 'one'" :path="mdiRepeatOnce" class="w-4 h-4" />
        <Icon v-else :path="mdiRepeat" class="w-4 h-4" />
      </button>

      <!-- Shuffle -->
      <button
        class="transition-colors"
        :class="state.shuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="toggleShuffle"
      >
        <Icon :path="mdiShuffle" class="w-4 h-4" />
      </button>

      <!-- Queue toggle -->
      <button
        class="transition-colors"
        :class="queueOpen ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="queueOpen = !queueOpen"
      >
        <Icon :path="mdiPlaylistMusic" class="w-4 h-4" />
      </button>

      <!-- Volume -->
      <div class="flex items-center gap-1.5 flex-1">
        <button class="text-zinc-400 hover:text-zinc-100 transition-colors flex-shrink-0" @click="toggleMute">
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

  <!-- Queue drawer -->
  <QueueDrawer :open="queueOpen" @close="queueOpen = false" />
</template>
