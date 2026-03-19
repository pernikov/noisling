<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import CoverArt from '../components/CoverArt.vue';
import { mdiPlay, mdiShuffle, mdiChevronRight } from '@mdi/js';
import Icon from '../components/Icon.vue';
import IconButton from '../components/IconButton.vue';
import NotFoundPage from '../components/NotFoundPage.vue';

const api = useApi();
const { state: playerState, playAlbum } = usePlayer();
const route = useRoute();
const router = useRouter();
const artistName = ref('');
const albums = ref([]);
const loading = ref(true);
const notFound = ref(false);
const page = ref(1);
const totalAlbums = ref(0);
const limit = 20;

const totalPages = computed(() => Math.ceil(totalAlbums.value / limit));

async function load() {
  loading.value = true;
  notFound.value = false;
  try {
    const name = decodeURIComponent(route.params.name);
    artistName.value = name;
    const data = await api.getArtist(name, page.value, limit);
    albums.value = data.albums;
    totalAlbums.value = data.total;
  } catch (err) {
    notFound.value = true;
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.params.name, () => { page.value = 1; load(); });
watch(page, load);
useLibraryEvents(load);

function goToAlbum(album) {
  router.push({ name: 'album', params: { artist: artistName.value, album: album.name } });
}

async function playAll() {
  const tracks = await api.getArtistTracks(artistName.value);
  if (tracks.length) playAlbum(tracks, 0);
}

async function playShuffle() {
  const tracks = await api.getArtistTracks(artistName.value);
  if (!tracks.length) return;
  const randomIndex = Math.floor(Math.random() * tracks.length);
  playerState.shuffle = true;
  playAlbum(tracks, randomIndex);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  return `${m} min`;
}
</script>

<template>
  <div>
    <NotFoundPage v-if="!loading && notFound" type="artist" :name="artistName" />

    <template v-else>
      <div v-if="loading" class="animate-pulse">
        <div class="flex items-center justify-between mb-6 gap-4">
          <div class="h-8 bg-zinc-800 rounded w-48 max-w-[60%]"></div>
          <div class="flex items-center gap-2 shrink-0">
            <div class="h-10 w-24 bg-zinc-800 rounded-lg"></div>
            <div class="h-10 w-24 bg-zinc-800 rounded-lg"></div>
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
          <div v-for="i in 8" :key="i" class="rounded-lg p-2 sm:p-4">
            <div class="aspect-square bg-zinc-800 rounded-lg mb-3"></div>
            <div class="h-3.5 bg-zinc-800 rounded mb-1.5" :style="{ width: `${50 + (i * 11) % 35}%` }"></div>
            <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${40 + (i * 9) % 35}%` }"></div>
          </div>
        </div>
      </div>

      <template v-else>
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold font-display">{{ artistName }}</h1>
          <div class="flex items-center gap-2">
            <IconButton :icon="mdiPlay" label="Play All" @click="playAll" />
            <IconButton :icon="mdiShuffle" label="Shuffle" @click="playShuffle" />
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
          <div
            v-for="album in albums"
            :key="album.name"
            class="rounded-lg p-2 sm:p-4 hover:bg-zinc-900 cursor-pointer transition-colors"
            @click="goToAlbum(album)"
          >
            <CoverArt :cover="album.cover" size="w-full aspect-square mb-3" />
            <div class="font-medium font-display truncate">{{ album.name }}</div>
            <div class="text-xs text-zinc-500">
              {{ album.year || '' }}
              {{ album.year ? '·' : '' }}
              {{ album.trackCount }} track{{ album.trackCount !== 1 ? 's' : '' }}
              &middot;
              {{ formatDuration(album.duration) }}
            </div>
          </div>
        </div>
      </template>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-3 mt-8">
        <button
          :disabled="page === 1"
          class="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          @click="page--"
        >
          <Icon :path="mdiChevronLeft" class="w-4 h-4" />
        </button>
        <span class="text-sm text-zinc-400">{{ page }} / {{ totalPages }}</span>
        <button
          :disabled="page === totalPages"
          class="p-1.5 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          @click="page++"
        >
          <Icon :path="mdiChevronRight" class="w-4 h-4" />
        </button>
      </div>
    </template>
  </div>
</template>
