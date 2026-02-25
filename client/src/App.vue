<script setup>
import { computed, watch } from 'vue';
import { mdiCog } from '@mdi/js';
import Icon from './components/Icon.vue';
import { useRoute } from 'vue-router';
import PlayerBar from './components/PlayerBar.vue';
import NowPlayingModal from './components/NowPlayingModal.vue';
import SpectrogramVisualizer from './components/SpectrogramVisualizer.vue';
import { usePlayer } from './composables/usePlayer.js';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js';
import { useAccentColor } from './composables/useAccentColor.js';
import { useTheme } from './composables/useTheme.js';

const { loadTheme } = useTheme();
loadTheme();

const { loadPlayerPrefs } = usePlayer();
loadPlayerPrefs();

const route = useRoute();
const { state: playerState } = usePlayer();

watch(() => route.path, () => {
  playerState.showVisualizer = false;
  playerState.showNowPlaying = false;
});

const { accentColor } = useAccentColor();

const navStyle = computed(() => {
  if (!accentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${accentColor.value}, 0.25), rgba(${accentColor.value}, 0.1) 60%, transparent)`,
  };
});
useKeyboardShortcuts();
</script>

<template>
  <div
    class="flex flex-col"
    :class="playerState.showVisualizer
      ? 'h-screen overflow-hidden'
      : { 'min-h-screen': true, 'pb-24': playerState.currentTrack }"
  >
    <!-- Top nav -->
    <nav class="sticky top-0 bg-zinc-950/95 backdrop-blur-xl border-b border-zinc-800 z-40" :style="navStyle">
      <div class="max-w-6xl mx-auto px-4 flex items-center justify-between h-14">
        <div class="flex items-center gap-6">
          <router-link to="/" class="flex items-center gap-2 text-lg font-bold tracking-tight">
            <img src="@/assets/img/logo.png" alt="Noisling" class="h-7 w-7 rounded" />
            Noisling
          </router-link>
          <div class="flex gap-4 text-sm">
            <router-link
            to="/songs"
            class="text-zinc-400 hover:text-zinc-100 transition-colors"
            active-class="!text-zinc-100"
            >
            Songs
          </router-link>
          <router-link
            to="/artists"
            class="text-zinc-400 hover:text-zinc-100 transition-colors"
            active-class="!text-zinc-100"
          >
            Artists
          </router-link>
          </div>
        </div>

        <router-link
          to="/settings"
          class="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded hover:bg-zinc-800"
          active-class="!text-zinc-100"
        >
          <Icon :path="mdiCog" class="w-5 h-5" />
        </router-link>
      </div>
    </nav>

    <!-- Main content -->
    <main v-if="!playerState.showVisualizer" class="w-full max-w-6xl mx-auto px-4 py-6">
      <router-view />
    </main>

    <!-- Spectrogram visualizer -->
    <SpectrogramVisualizer v-else class="flex-1" />

    <!-- Player bar -->
    <PlayerBar />

    <!-- Now Playing full-screen modal -->
    <NowPlayingModal />
  </div>
</template>
