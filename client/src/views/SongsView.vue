<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import TrackList from '../components/TrackList.vue';
import { mdiMagnify, mdiMusicNote } from '@mdi/js';
import Icon from '../components/Icon.vue';

const api = useApi();
const route = useRoute();
const router = useRouter();
const allTracks = ref([]);
const search = ref(route.query.search || '');
const loading = ref(true);
const page = ref(Number(route.query.page) || 1);
const total = ref(0);
const limit = 100;
let searchTimeout = null;
const searchExpanded = ref(!!route.query.search);
const searchInput = ref(null);

function expandSearch() {
  searchExpanded.value = true;
  nextTick(() => searchInput.value?.focus());
}

function onSearchBlur() {
  if (!search.value) searchExpanded.value = false;
}

function updateQuery() {
  const query = {};
  if (search.value) query.search = search.value;
  if (page.value > 1) query.page = String(page.value);
  router.replace({ query });
}

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
    updateQuery();
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
      <h1 class="text-2xl font-bold font-display">Songs</h1>
      <div class="relative flex items-center h-8">
        <input
          ref="searchInput"
          v-model="search"
          type="text"
          placeholder="Search songs..."
          class="bg-zinc-800 border border-transparent rounded pr-8 py-1.5 text-sm outline-none focus:border-zinc-700 transition-all duration-200 ease-in-out"
          :class="searchExpanded ? 'w-64 pl-3 opacity-100' : 'w-0 pl-0 opacity-0 border-transparent'"
          @blur="onSearchBlur"
        />
        <button
          class="absolute right-0 text-zinc-400 hover:text-zinc-100 h-8 w-8 flex items-center justify-center"
          @click="expandSearch"
        >
          <Icon :path="mdiMagnify" class="w-5 h-5" />
        </button>
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
      <p class="text-sm font-medium text-zinc-400">{{ search ? 'No songs found' : 'No songs yet' }}</p>
      <p class="text-xs text-zinc-600">{{ search ? 'Try a different search term.' : 'Scan your library in Settings to get started.' }}</p>
    </div>

    <template v-else>
      <TrackList :tracks="allTracks" show-cover show-artist show-album show-plays :start-index="(page - 1) * limit" :get-all-tracks="fetchAllTracks" />

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
