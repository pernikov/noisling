<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import { useToast } from '../composables/useToast.js';
import { useTheme } from '../composables/useTheme.js';
import { usePlayer } from '../composables/usePlayer.js';
import TrackList from '../components/TrackList.vue';
import { mdiMusicNote, mdiPlay, mdiShuffle } from '@mdi/js';
import Icon from '../components/Icon.vue';
import IconButton from '../components/IconButton.vue';

const api = useApi();
const { tracksColumns, tracksSort, setTracksSort } = useTheme();
const { state: playerState, playAlbum } = usePlayer();
const { error: toastError } = useToast();
const router = useRouter();
const allTracks = ref([]);
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const limit = 100;

function updateQuery() {
  const query = {};
  if (page.value > 1) query.page = String(page.value);
  router.replace({ query });
}

async function loadTracks() {
  loading.value = true;
  try {
    const data = await api.getTracks(page.value, limit, '', tracksSort.value.field, tracksSort.value.dir);
    allTracks.value = data.tracks;
    total.value = data.total;
  } catch (err) {
    console.error('Failed to load tracks:', err);
    toastError('Failed to load tracks. Check your connection.');
  } finally {
    loading.value = false;
  }
}

async function refreshTracksLive() {
  try {
    const data = await api.getTracks(page.value, limit, '', tracksSort.value.field, tracksSort.value.dir);
    allTracks.value = data.tracks;
    total.value = data.total;
  } catch (err) {
    console.error('Failed to live-refresh tracks:', err);
  }
}

function onSort({ field, dir }) {
  setTracksSort(field, dir);
  page.value = 1;
  updateQuery();
  loadTracks();
}

onMounted(loadTracks);
useLibraryEvents(loadTracks);

watch(() => playerState.playReportCount, (count) => {
  if (count > 0) refreshTracksLive();
});

async function fetchAllTracks() {
  return api.getAllTracks('', tracksSort.value.field, tracksSort.value.dir);
}

async function playAll() {
  const tracks = await fetchAllTracks();
  if (tracks.length) playAlbum(tracks, 0);
}

async function playShuffle() {
  const tracks = await fetchAllTracks();
  if (!tracks.length) return;
  playAlbum(tracks, Math.floor(Math.random() * tracks.length));
}

const totalPages = computed(() => Math.ceil(total.value / limit));

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    updateQuery();
    loadTracks();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    updateQuery();
    loadTracks();
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold font-display">Tracks</h1>
      <div class="flex items-center gap-2">
        <IconButton :icon="mdiPlay" label="Play All" @click="playAll" />
        <IconButton :icon="mdiShuffle" label="Shuffle" @click="playShuffle" />
      </div>
    </div>

    <div v-if="loading" class="space-y-1 animate-pulse">
      <div v-for="i in 15" :key="i" class="flex items-center gap-3 px-1 py-2">
        <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
        <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
        <div class="flex-1 min-w-0 space-y-1.5">
          <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${55 + (i * 13) % 30}%` }"></div>
          <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${30 + (i * 17) % 25}%` }"></div>
        </div>
        <div class="h-2.5 bg-zinc-800 rounded w-20 hidden sm:block"></div>
        <div class="h-2.5 bg-zinc-800 rounded w-16 hidden md:block"></div>
        <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
      </div>
    </div>

    <div v-else-if="allTracks.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-10 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiMusicNote" class="w-8 h-8 text-zinc-600" />
      <p class="text-sm font-medium text-zinc-400">No tracks yet</p>
      <p class="text-xs text-zinc-600"><router-link to="/settings?tab=library" class="text-zinc-400 hover:text-zinc-200 underline">Scan your library</router-link> to discover your music.</p>
    </div>

    <template v-else>
      <TrackList
        :tracks="allTracks"
        show-cover
        :show-artist="tracksColumns.artist"
        :show-album="tracksColumns.album"
        :show-plays="tracksColumns.plays"
        :show-last-played="tracksColumns.lastPlayed"
        sortable
        :sort-by="tracksSort.field"
        :sort-dir="tracksSort.dir"
        @sort="onSort"
        :start-index="(page - 1) * limit"
        :get-all-tracks="fetchAllTracks"
        hide-controls
      />

      <div v-if="totalPages > 1" class="flex items-center justify-center gap-4 mt-6 text-sm">
        <button
          :disabled="page <= 1"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700"
          @click="prevPage"
        >
          Previous
        </button>
        <span class="text-zinc-500">Page {{ page }} of {{ totalPages }}</span>
        <button
          :disabled="page >= totalPages"
          class="text-zinc-400 hover:text-zinc-100 disabled:text-zinc-700"
          @click="nextPage"
        >
          Next
        </button>
      </div>
    </template>
  </div>
</template>
