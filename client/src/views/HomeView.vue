<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import TrackList from '../components/TrackList.vue';
import ArtistCover from '../components/ArtistCover.vue';

const api = useApi();
const router = useRouter();
const { state: playerState } = usePlayer();

const recentTracks = ref([]);
const artists = ref([]);
const loadingRecent = ref(true);
const loadingArtists = ref(true);

async function loadRecent() {
  try {
    recentTracks.value = await api.getRecentTracks(10);
  } catch (err) {
    console.error('Failed to load recent tracks:', err);
  } finally {
    loadingRecent.value = false;
  }
}

async function loadArtists() {
  try {
    artists.value = await api.getRandomArtists(12);
  } catch (err) {
    console.error('Failed to load artists:', err);
  } finally {
    loadingArtists.value = false;
  }
}

onMounted(() => {
  loadRecent();
  loadArtists();
});

useLibraryEvents(() => {
  loadRecent();
  loadArtists();
});

watch(() => playerState.currentTrack?._id, (newId, oldId) => {
  if (oldId && newId !== oldId) loadRecent();
});

function goToArtist(name) {
  router.push({ name: 'artist', params: { name } });
}
</script>

<template>
  <div class="space-y-10">
    <!-- Recently Played -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold font-display">Recently Played</h2>
        <router-link
          v-if="recentTracks.length > 0"
          to="/recent"
          class="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          View all
        </router-link>
      </div>

      <div v-if="loadingRecent" class="text-zinc-500 text-sm">Loading...</div>

      <div v-else-if="recentTracks.length === 0" class="text-zinc-500 text-sm">
        No recently played tracks yet. Start listening!
      </div>

      <TrackList v-else :tracks="recentTracks" show-cover show-artist show-album show-last-played />
    </section>

    <!-- Artists -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold font-display">Your Artists</h2>
        <router-link
          v-if="artists.length > 0"
          to="/artists"
          class="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          View all
        </router-link>
      </div>

      <div v-if="loadingArtists" class="text-zinc-500 text-sm">Loading...</div>

      <div v-else-if="artists.length === 0" class="text-zinc-500 text-sm">
        No artists yet. Scan your library in
        <router-link to="/settings" class="text-zinc-300 hover:text-zinc-100 underline">Settings</router-link>.
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div
          v-for="artist in artists"
          :key="artist.name"
          class="rounded-lg p-4 hover:bg-zinc-900 cursor-pointer transition-colors group"
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
    </section>
  </div>
</template>
