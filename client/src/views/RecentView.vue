<script setup>
import { ref, watch, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import TrackList from '../components/TrackList.vue';

const api = useApi();
const { state: playerState } = usePlayer();
const { tracksColumns } = useTheme();
const tracks = ref([]);
const loading = ref(true);

async function loadRecent() {
  try {
    tracks.value = await api.getRecentTracks(100);
  } catch (err) {
    console.error('Failed to load recent tracks:', err);
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

    <div v-if="loading" class="space-y-1 animate-pulse">
      <div v-for="i in 15" :key="i" class="flex items-center gap-3 px-1 py-2">
        <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
        <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
        <div class="flex-1 min-w-0 space-y-1.5">
          <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${55 + (i * 13) % 30}%` }"></div>
          <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${30 + (i * 17) % 25}%` }"></div>
        </div>
        <div class="h-2.5 bg-zinc-800 rounded w-14 hidden sm:block"></div>
        <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
      </div>
    </div>

    <div v-else-if="tracks.length === 0" class="text-zinc-500">
      No recently played tracks yet. Start listening!
    </div>

    <TrackList v-else :tracks="tracks" show-cover show-artist show-album :show-plays="tracksColumns.plays" show-last-played />
  </div>
</template>
