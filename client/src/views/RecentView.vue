<script setup>
import { ref, watch, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import TrackList from '../components/TrackList.vue';
import Icon from '../components/Icon.vue';
import { mdiHistory } from '@mdi/js';

const api = useApi();
const { state: playerState } = usePlayer();
const tracks = ref([]);
const loading = ref(true);
const loadError = ref(false);

async function loadRecent() {
  loading.value = true;
  loadError.value = false;
  try {
    tracks.value = await api.getRecentTracks(100);
  } catch (err) {
    console.error('Failed to load recent tracks:', err);
    tracks.value = [];
    loadError.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecent);

// Refresh when a play is recorded in the DB
watch(() => playerState.playReportCount, (count) => {
  if (count > 0) loadRecent();
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold font-display mb-6">Recently Played</h1>

    <div v-if="loading" class="animate-pulse">
      <div class="sm:hidden space-y-2">
        <div v-for="i in 6" :key="`mobile-${i}`" class="rounded-lg bg-zinc-900/35">
          <div class="flex items-center gap-3 px-3 py-3.5">
            <div class="w-11 h-11 bg-zinc-800 rounded-lg shrink-0"></div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${50 + (i * 13) % 35}%` }"></div>
              <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${45 + (i * 9) % 25}%` }"></div>
            </div>
            <div class="w-9 h-9 bg-zinc-800/80 rounded-full shrink-0"></div>
          </div>
        </div>
      </div>

      <div class="hidden sm:block">
        <div class="space-y-2">
          <div v-for="i in 8" :key="`desktop-${i}`" class="grid grid-cols-[minmax(0,1fr),auto] items-center gap-4 rounded-lg bg-zinc-900/35 px-3 py-3">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-10 h-10 bg-zinc-800 rounded-lg shrink-0"></div>
              <div class="min-w-0 flex-1 space-y-2">
                <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${45 + (i * 13) % 35}%` }"></div>
                <div class="flex flex-wrap gap-2">
                  <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${20 + (i * 7) % 15}%` }"></div>
                  <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${18 + (i * 5) % 14}%` }"></div>
                  <div class="h-2.5 bg-zinc-800/50 rounded w-20"></div>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
              <div class="w-9 h-9 bg-zinc-800/80 rounded-full"></div>
              <div class="w-9 h-9 bg-zinc-800/80 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="loadError" class="bg-zinc-900 rounded-lg border border-red-900/60 p-10 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiHistory" class="w-8 h-8 text-red-400/80" />
      <p class="text-sm font-medium text-zinc-200">Couldn't load recently played</p>
      <p class="text-xs text-zinc-500">The server didn't return your recent plays. Try again in a moment.</p>
      <button class="mt-1 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-700 transition-colors" @click="loadRecent">
        Retry
      </button>
    </div>

    <div v-else-if="tracks.length === 0" class="bg-zinc-900 rounded-lg border border-zinc-800 p-10 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiHistory" class="w-8 h-8 text-zinc-600" />
      <p class="text-sm font-medium text-zinc-400">No recently played tracks yet</p>
      <p class="text-xs text-zinc-600">Start listening and your recent plays will show up here.</p>
    </div>

    <TrackList v-else :tracks="tracks" show-cover show-artist show-album show-last-played />
  </div>
</template>
