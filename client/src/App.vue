<script setup>
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from './composables/useApi.js';
import PlayerBar from './components/PlayerBar.vue';
import { usePlayer } from './composables/usePlayer.js';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js';
import { useAccentColor } from './composables/useAccentColor.js';

const api = useApi();
const router = useRouter();
const { state: playerState } = usePlayer();
const { accentColor } = useAccentColor();

const navStyle = computed(() => {
  if (!accentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${accentColor.value}, 0.25), rgba(${accentColor.value}, 0.1) 60%, transparent)`,
  };
});
useKeyboardShortcuts();
const scanning = ref(false);
const scanResult = ref(null);

async function scanLibrary() {
  scanning.value = true;
  scanResult.value = null;
  try {
    scanResult.value = await api.scanLibrary();
  } catch (err) {
    scanResult.value = { error: err.message };
  } finally {
    scanning.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen" :class="{ 'pb-24': playerState.currentTrack }">
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
              to="/artists"
              class="text-zinc-400 hover:text-zinc-100 transition-colors"
              active-class="!text-zinc-100"
            >
              Artists
            </router-link>
            <router-link
              to="/songs"
              class="text-zinc-400 hover:text-zinc-100 transition-colors"
              active-class="!text-zinc-100"
            >
              Songs
            </router-link>
            <router-link
              to="/recent"
              class="text-zinc-400 hover:text-zinc-100 transition-colors"
              active-class="!text-zinc-100"
            >
              Recent
            </router-link>
          </div>
        </div>

        <button
          @click="scanLibrary"
          :disabled="scanning"
          class="text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {{ scanning ? 'Scanning...' : 'Scan Library' }}
        </button>
      </div>
    </nav>

    <!-- Main content -->
    <main class="max-w-6xl mx-auto px-4 py-6">
      <router-view />
    </main>

    <!-- Player bar -->
    <PlayerBar />
  </div>
</template>
