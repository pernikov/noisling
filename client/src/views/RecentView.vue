<script setup>
import { ref, watch, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import TrackList from '../components/TrackList.vue';

const api = useApi();
const { state: playerState } = usePlayer();
const tracks = ref([]);
const loading = ref(true);

async function loadRecent() {
  try {
    tracks.value = await api.getRecentTracks(30);
  } catch (err) {
    console.error('Failed to load recent tracks:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadRecent);

// Refresh when a new track starts playing (covers the play-report)
watch(() => playerState.currentTrack?._id, (newId, oldId) => {
  if (oldId && newId !== oldId) loadRecent();
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Recently Played</h1>

    <div v-if="loading" class="text-zinc-500">Loading...</div>

    <div v-else-if="tracks.length === 0" class="text-zinc-500">
      No recently played tracks yet. Start listening!
    </div>

    <TrackList v-else :tracks="tracks" show-artist show-album />
  </div>
</template>
