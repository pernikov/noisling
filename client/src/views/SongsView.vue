<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import TrackList from '../components/TrackList.vue';

const api = useApi();
const allTracks = ref([]);
const search = ref('');
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const limit = 100;
let searchTimeout = null;

async function loadTracks() {
  loading.value = true;
  try {
    const data = await api.getTracks(page.value, limit, search.value.trim());
    allTracks.value = data.tracks;
    total.value = data.total;
  } catch (err) {
    console.error('Failed to load tracks:', err);
  } finally {
    loading.value = false;
  }
}

watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    loadTracks();
  }, 300);
});

onMounted(loadTracks);
useLibraryEvents(loadTracks);

async function fetchAllTracks() {
  return api.getAllTracks(search.value.trim());
}

const totalPages = computed(() => Math.ceil(total.value / limit));

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    loadTracks();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    loadTracks();
  }
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Songs</h1>
      <input
        v-model="search"
        type="text"
        placeholder="Search songs..."
        class="bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm outline-none focus:border-zinc-500 w-64"
      />
    </div>

    <div v-if="loading" class="text-zinc-500">Loading...</div>

    <div v-else-if="allTracks.length === 0" class="text-zinc-500">
      No songs found. Scan your library first.
    </div>

    <template v-else>
      <TrackList :tracks="allTracks" show-artist show-album show-plays :get-all-tracks="fetchAllTracks" />

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
