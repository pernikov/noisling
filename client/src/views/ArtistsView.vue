<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import ArtistCover from '../components/ArtistCover.vue';

const api = useApi();
const route = useRoute();
const router = useRouter();
const artists = ref([]);
const search = ref(route.query.search || '');
const loading = ref(true);
const page = ref(Number(route.query.page) || 1);
const total = ref(0);
const limit = 60;
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

async function loadArtists() {
  loading.value = true;
  try {
    const data = await api.getArtists(page.value, limit, search.value.trim());
    artists.value = data.artists;
    total.value = data.total;
  } catch (err) {
    console.error('Failed to load artists:', err);
  } finally {
    loading.value = false;
  }
}

watch(search, () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    page.value = 1;
    updateQuery();
    loadArtists();
  }, 300);
});

onMounted(loadArtists);
useLibraryEvents(loadArtists);

const totalPages = computed(() => Math.ceil(total.value / limit));

function nextPage() {
  if (page.value < totalPages.value) {
    page.value++;
    updateQuery();
    loadArtists();
  }
}

function prevPage() {
  if (page.value > 1) {
    page.value--;
    updateQuery();
    loadArtists();
  }
}

function goToArtist(name) {
  router.push({ name: 'artist', params: { name } });
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold">Artists</h1>
      <div class="relative flex items-center h-8">
        <input
          ref="searchInput"
          v-model="search"
          type="text"
          placeholder="Search artists..."
          class="bg-zinc-800 border border-zinc-700 rounded pr-8 py-1.5 text-sm outline-none focus:border-zinc-500 transition-all duration-200 ease-in-out"
          :class="searchExpanded ? 'w-64 pl-3 opacity-100' : 'w-0 pl-0 opacity-0 border-transparent'"
          @blur="onSearchBlur"
        />
        <button
          class="absolute right-0 text-zinc-400 hover:text-zinc-100 h-8 w-8 flex items-center justify-center"
          @click="expandSearch"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </button>
      </div>
    </div>

    <div v-if="loading" class="text-zinc-500">Loading...</div>

    <div v-else-if="artists.length === 0" class="text-zinc-500">
      No artists found. Scan your library first.
    </div>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div
          v-for="artist in artists"
          :key="artist.name"
          class="rounded-lg p-4 hover:bg-zinc-900 cursor-pointer transition-colors group"
          @click="goToArtist(artist.name)"
        >
          <ArtistCover :covers="artist.covers || []" />
          <div class="font-medium truncate">{{ artist.name }}</div>
          <div class="text-xs text-zinc-500">
            {{ artist.albumCount }} album{{ artist.albumCount !== 1 ? 's' : '' }}
            &middot;
            {{ artist.trackCount }} track{{ artist.trackCount !== 1 ? 's' : '' }}
          </div>
        </div>
      </div>

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
