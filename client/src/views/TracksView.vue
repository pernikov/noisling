<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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
const { tracksSort, setTracksSort } = useTheme();
const { state: playerState, playAlbum, playShuffled } = usePlayer();
const { error: toastError } = useToast();
const route = useRoute();
const router = useRouter();
const allTracks = ref([]);
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const limit = 100;

function parsePageQuery(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

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

watch(
  () => route.query.page,
  (value) => {
    page.value = parsePageQuery(value);
    loadTracks();
  },
  { immediate: true }
);
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
  playShuffled(tracks);
}

const totalPages = computed(() => Math.ceil(total.value / limit));

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    updateQuery();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    updateQuery();
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

    <div v-if="loading" class="animate-pulse">
      <div class="sm:hidden space-y-2">
        <div v-for="i in 8" :key="`mobile-${i}`" class="rounded-2xl bg-zinc-900/35">
          <div class="flex items-center gap-3 px-3 py-3.5">
            <div class="w-11 h-11 bg-zinc-800 rounded-lg shrink-0"></div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${50 + (i * 13) % 35}%` }"></div>
              <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${40 + (i * 9) % 30}%` }"></div>
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
        <div v-for="i in 10" :key="`desktop-${i}`" class="grid grid-cols-[2rem,minmax(0,1fr),minmax(0,18%),minmax(0,18%),4rem,6rem,1rem,4rem] items-center gap-x-3 px-1 py-2">
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

    <div v-else-if="allTracks.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-10 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiMusicNote" class="w-8 h-8 text-zinc-600" />
      <p class="text-sm font-medium text-zinc-400">No tracks yet</p>
      <p class="text-xs text-zinc-600"><router-link to="/settings?tab=library" class="text-zinc-400 hover:text-zinc-200 underline">Scan your library</router-link> to discover your music.</p>
    </div>

    <template v-else>
      <TrackList
        :tracks="allTracks"
        show-cover
        show-artist
        show-album
        show-plays
        show-last-played
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
