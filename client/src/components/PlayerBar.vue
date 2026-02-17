<script setup>
import { ref, computed } from 'vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useAccentColor } from '../composables/useAccentColor.js';
import CoverArt from './CoverArt.vue';
import QueueDrawer from './QueueDrawer.vue';

const { state, toggle, next, prev, seek, setVolume, toggleShuffle, toggleVisualizer, hasNext, hasPrev } = usePlayer();
const { accentColor } = useAccentColor();

const barStyle = computed(() => {
  if (!accentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${accentColor.value}, 0.25), rgba(${accentColor.value}, 0.1) 60%, transparent)`,
  };
});

const queueOpen = ref(false);

function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
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
  <div
    v-if="state.currentTrack"
    class="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 px-4 py-3 flex items-center justify-between gap-4 z-40"
    :style="barStyle"
  >
    <!-- Track info -->
    <div class="flex items-center gap-3 min-w-0 w-56 flex-shrink-0">
      <CoverArt :cover="state.currentTrack.cover" size="w-10 h-10" />
      <div class="min-w-0">
        <div class="text-sm font-medium truncate">{{ state.currentTrack.title }}</div>
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
    <div class="flex-1 flex flex-col items-center gap-1 max-w-xl">
      <div class="flex items-center gap-4">
        <button
          :disabled="!hasPrev"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors"
          @click="prev"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
          </svg>
        </button>

        <button
          class="w-8 h-8 rounded-full bg-zinc-100 text-zinc-900 flex items-center justify-center hover:scale-105 transition-transform"
          @click="toggle"
        >
          <svg v-if="state.isPlaying" class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 4h4v16H6zM14 4h4v16h-4z"/>
          </svg>
          <svg v-else class="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
        </button>

        <button
          :disabled="!hasNext"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700 transition-colors"
          @click="next"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
          </svg>
        </button>
      </div>

      <!-- Progress bar -->
      <div class="w-full flex items-center gap-2 text-xs text-zinc-500">
        <span class="w-10 text-right">{{ formatTime(state.currentTime) }}</span>
        <div
          class="flex-1 h-1 bg-zinc-700 rounded cursor-pointer group"
          @click="onProgressClick"
        >
          <div
            class="h-full bg-zinc-100 rounded group-hover:bg-emerald-400 transition-colors"
            :style="{ width: progressPercent() + '%' }"
          />
        </div>
        <span class="w-10">{{ formatTime(state.duration) }}</span>
      </div>
    </div>

    <!-- Right group: shuffle, queue, volume -->
    <div class="hidden sm:flex items-center gap-3 w-44 flex-shrink-0 justify-end">
      <!-- Visualizer -->
      <button
        class="transition-colors"
        :class="state.showVisualizer ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="toggleVisualizer"
        title="Toggle visualizer"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 18h2v-6H3v6zm4 0h2V6H7v12zm4 0h2v-8h-2v8zm4 0h2v-4h-2v4zm4 0h2V9h-2v9z"/>
        </svg>
      </button>

      <!-- Shuffle -->
      <button
        class="transition-colors"
        :class="state.shuffle ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="toggleShuffle"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
        </svg>
      </button>

      <!-- Queue toggle -->
      <button
        class="transition-colors"
        :class="queueOpen ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-100'"
        @click="queueOpen = !queueOpen"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M15 6H3v2h12V6zm0 4H3v2h12v-2zM3 16h8v-2H3v2zM17 6v8.18c-.31-.11-.65-.18-1-.18-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3V8h3V6h-5z"/>
        </svg>
      </button>

      <!-- Volume -->
      <div class="flex items-center gap-1.5 flex-1">
        <svg class="w-4 h-4 text-zinc-400 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
        </svg>
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
