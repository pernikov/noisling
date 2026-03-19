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

    <div v-if="loading" class="animate-pulse">
      <div class="sm:hidden space-y-2">
        <div v-for="i in 6" :key="`mobile-${i}`" class="rounded-2xl bg-zinc-900/35">
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
        <div class="grid grid-cols-[2rem,minmax(0,1fr),minmax(0,18%),minmax(0,18%),4rem,6rem,1rem,4rem] items-center gap-x-3 px-1 py-2 border-b border-zinc-800 text-zinc-500">
          <div class="h-3 bg-zinc-800/70 rounded"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-10 justify-self-center"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12 justify-self-center"></div>
          <div></div>
          <div class="h-3 bg-zinc-800/70 rounded w-10 justify-self-end"></div>
        </div>
        <div v-for="i in 8" :key="`desktop-${i}`" class="grid grid-cols-[2rem,minmax(0,1fr),minmax(0,18%),minmax(0,18%),4rem,6rem,1rem,4rem] items-center gap-x-3 px-1 py-2">
          <div class="h-3 bg-zinc-800 rounded w-4 justify-self-center"></div>
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
            <div class="min-w-0 space-y-1.5 flex-1">
              <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${45 + (i * 13) % 35}%` }"></div>
            </div>
          </div>
          <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${55 + (i * 7) % 25}%` }"></div>
          <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${50 + (i * 11) % 30}%` }"></div>
          <div class="h-2.5 bg-zinc-800 rounded w-8 justify-self-center"></div>
          <div class="h-2.5 bg-zinc-800 rounded w-14 justify-self-center"></div>
          <div class="w-4 h-4 bg-zinc-800/70 rounded-full justify-self-center"></div>
          <div class="h-2.5 bg-zinc-800 rounded w-10 justify-self-end"></div>
        </div>
      </div>
    </div>

    <div v-else-if="tracks.length === 0" class="text-zinc-500">
      No recently played tracks yet. Start listening!
    </div>

    <TrackList v-else :tracks="tracks" show-cover show-artist show-album show-last-played />
  </div>
</template>
