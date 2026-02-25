<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import CoverArt from '../components/CoverArt.vue';
import { mdiPlay, mdiShuffle } from '@mdi/js';
import Icon from '../components/Icon.vue';

const api = useApi();
const { state: playerState, playAlbum } = usePlayer();
const route = useRoute();
const router = useRouter();
const artistName = ref('');
const albums = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const name = decodeURIComponent(route.params.name);
    artistName.value = name;
    const data = await api.getArtist(name);
    albums.value = data.albums;
  } catch (err) {
    console.error('Failed to load artist:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.params.name, load);
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
    <button class="text-zinc-500 hover:text-zinc-300 mb-4 text-sm" @click="router.back()">
      &larr; Back
    </button>

    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold font-display">{{ artistName }}</h1>
      <div class="flex items-center gap-2">
        <button
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          @click="playAll"
        >
          <Icon :path="mdiPlay" class="w-3.5 h-3.5" />
          Play All
        </button>
        <button
          class="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          @click="playShuffle"
        >
          <Icon :path="mdiShuffle" class="w-3.5 h-3.5" />
          Shuffle
        </button>
      </div>
    </div>

    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4 animate-pulse">
      <div v-for="i in 8" :key="i" class="rounded-lg p-2 sm:p-4">
        <div class="aspect-square bg-zinc-800 rounded-lg mb-3"></div>
        <div class="h-3.5 bg-zinc-800 rounded mb-1.5" :style="{ width: `${50 + (i * 11) % 35}%` }"></div>
        <div class="h-2.5 bg-zinc-800/60 rounded w-2/3"></div>
      </div>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-4">
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
  </div>
</template>
