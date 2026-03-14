<script setup>
import { ref, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import { useToast } from '../composables/useToast.js';
import ArtistCover from '../components/ArtistCover.vue';
import { mdiMicrophone } from '@mdi/js';
import Icon from '../components/Icon.vue';

const api = useApi();
const { error: toastError } = useToast();
const route = useRoute();
const router = useRouter();
const artists = ref([]);
const loading = ref(true);
const page = ref(1);
const total = ref(0);
const limit = 60;

function parsePageQuery(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function updateQuery() {
  const query = {};
  if (page.value > 1) query.page = String(page.value);
  router.replace({ query });
}

async function loadArtists() {
  loading.value = true;
  try {
    const data = await api.getArtists(page.value, limit, '');
    artists.value = data.artists;
    total.value = data.total;
  } catch (err) {
    console.error('Failed to load artists:', err);
    toastError('Failed to load artists. Check your connection.');
  } finally {
    loading.value = false;
  }
}

watch(
  () => route.query.page,
  (value) => {
    page.value = parsePageQuery(value);
    loadArtists();
  },
  { immediate: true }
);
useLibraryEvents(loadArtists);

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

function goToArtist(name) {
  router.push({ name: 'artist', params: { name } });
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold font-display">Artists</h1>
    </div>

    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 animate-pulse">
      <div v-for="i in 18" :key="i" class="rounded-lg p-2 sm:p-4">
        <div class="aspect-square bg-zinc-800 rounded-lg mb-3"></div>
        <div class="h-3.5 bg-zinc-800 rounded mb-1.5" :style="{ width: `${50 + (i * 11) % 35}%` }"></div>
        <div class="h-2.5 bg-zinc-800/60 rounded w-2/3"></div>
      </div>
    </div>

    <div v-else-if="artists.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-10 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiMicrophone" class="w-8 h-8 text-zinc-600" />
      <p class="text-sm font-medium text-zinc-400">No artists yet</p>
      <p class="text-xs text-zinc-600"><router-link to="/settings?tab=library" class="text-zinc-400 hover:text-zinc-200 underline">Scan your library</router-link> to discover your music.</p>
    </div>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
        <div
          v-for="artist in artists"
          :key="artist.name"
          class="rounded-lg p-2 sm:p-4 hover:bg-zinc-900 cursor-pointer transition-colors group"
          @click="goToArtist(artist.name)"
        >
          <ArtistCover :covers="artist.covers || []" />
          <div class="font-medium font-display truncate">{{ artist.name }}</div>
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
