<script setup>
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import CoverArt from '../components/CoverArt.vue';
import TrackList from '../components/TrackList.vue';

const api = useApi();
const route = useRoute();
const router = useRouter();
const albumInfo = ref(null);
const tracks = ref([]);
const loading = ref(true);

async function load() {
  loading.value = true;
  try {
    const artist = decodeURIComponent(route.params.artist);
    const album = decodeURIComponent(route.params.album);
    const data = await api.getAlbum(artist, album);
    albumInfo.value = data.album;
    tracks.value = data.tracks;
  } catch (err) {
    console.error('Failed to load album:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
watch(() => route.params.album, load);
useLibraryEvents(load);

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

    <div v-if="loading" class="text-zinc-500">Loading...</div>

    <template v-else-if="albumInfo">
      <!-- Album header -->
      <div class="flex items-end gap-6 mb-8">
        <CoverArt :cover="albumInfo.cover" size="w-48 h-48" />
        <div>
          <div class="text-xs uppercase text-zinc-500 mb-1">Album</div>
          <h1 class="text-3xl font-bold mb-2">{{ albumInfo.name }}</h1>
          <div class="text-zinc-400">
            <template v-for="(artist, ai) in albumInfo.artists" :key="ai">
              <span v-if="ai > 0">, </span>
              <router-link
                :to="{ name: 'artist', params: { name: artist } }"
                class="hover:text-zinc-100 hover:underline"
              >{{ artist }}</router-link>
            </template>
            <span v-if="albumInfo.year" class="text-zinc-500"> &middot; {{ albumInfo.year }}</span>
            <span class="text-zinc-500">
              &middot; {{ albumInfo.trackCount }} tracks &middot; {{ formatDuration(albumInfo.duration) }}
            </span>
          </div>
        </div>
      </div>

      <TrackList :tracks="tracks" />
    </template>
  </div>
</template>
