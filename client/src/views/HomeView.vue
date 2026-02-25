<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { mdiShuffle, mdiFire, mdiHeart } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import TrackList from '../components/TrackList.vue';
import ArtistCover from '../components/ArtistCover.vue';
import Icon from '../components/Icon.vue';

const api = useApi();
const router = useRouter();
const { state: playerState, playAlbum, toggleShuffle } = usePlayer();

const lovedTracks = ref([]);
const recentTracks = ref([]);
const artists = ref([]);
const loadingRecent = ref(true);
const loadingArtists = ref(true);

const GREETINGS = [
  'Hello again.',
  'Welcome back.',
  'Good to see you.',
  'Ready to listen?',
  "What's on today?",
  'Pick something good.',
  'Let the music play.',
  'Nice to have you back.',
  'What are we feeling?',
  'Play something.',
];
const greeting = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

const loadingShuffleAll = ref(false);
const loadingTopTracks = ref(false);

async function playShuffleAll() {
  loadingShuffleAll.value = true;
  try {
    const tracks = await api.getAllTracks();
    if (!tracks.length) return;
    if (!playerState.shuffle) toggleShuffle();
    const startIndex = Math.floor(Math.random() * tracks.length);
    playAlbum(tracks, startIndex);
  } finally {
    loadingShuffleAll.value = false;
  }
}

async function playTopTracks() {
  loadingTopTracks.value = true;
  try {
    const tracks = await api.getAllTracks();
    if (!tracks.length) return;
    const sorted = [...tracks].sort((a, b) => (b.playCount || 0) - (a.playCount || 0));
    playAlbum(sorted.slice(0, 50), 0);
  } finally {
    loadingTopTracks.value = false;
  }
}

async function loadLoved() {
  try {
    lovedTracks.value = await api.getLovedTracks();
  } catch (err) {
    console.error('Failed to load loved tracks:', err);
  }
}

function playLovedSongs() {
  if (!lovedTracks.value.length) return;
  playAlbum(lovedTracks.value, 0);
}

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
  loadLoved();
  loadRecent();
  loadArtists();
});

useLibraryEvents(() => {
  loadRecent();
  loadArtists();
});

watch(() => playerState.playReportCount, (count) => {
  if (count > 0) loadRecent();
});

function goToArtist(name) {
  router.push({ name: 'artist', params: { name } });
}
</script>

<template>
  <div class="space-y-10">
    <h1 class="text-2xl font-bold font-display">{{ greeting }}</h1>

    <!-- Quick Actions -->
    <section>
      <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Quick Play</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <!-- Shuffle All -->
        <button
          @click="playShuffleAll"
          :disabled="loadingShuffleAll"
          class="relative overflow-hidden rounded-xl p-5 text-left bg-gradient-to-br from-violet-500 to-purple-700 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
        >
          <div v-if="loadingShuffleAll" class="absolute inset-0 flex items-center justify-center bg-black/20">
            <svg class="w-8 h-8 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <Icon :path="mdiShuffle" class="w-8 h-8 mb-3 text-white/90" />
          <div class="text-lg font-bold font-display text-white">Shuffle All</div>
          <div class="text-sm text-white/70 mt-0.5">Play your entire library in random order</div>
        </button>

        <!-- Top Tracks -->
        <button
          @click="playTopTracks"
          :disabled="loadingTopTracks"
          class="relative overflow-hidden rounded-xl p-5 text-left bg-gradient-to-br from-amber-500 to-orange-600 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
        >
          <div v-if="loadingTopTracks" class="absolute inset-0 flex items-center justify-center bg-black/20">
            <svg class="w-8 h-8 animate-spin text-white" viewBox="0 0 24 24" fill="none">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
          </div>
          <Icon :path="mdiFire" class="w-8 h-8 mb-3 text-white/90" />
          <div class="text-lg font-bold font-display text-white">Top Songs</div>
          <div class="text-sm text-white/70 mt-0.5">Your 50 most listened-to songs</div>
        </button>

        <!-- Loved Songs -->
        <button
          v-if="lovedTracks.length > 0"
          @click="playLovedSongs"
          class="relative overflow-hidden rounded-xl p-5 text-left bg-gradient-to-br from-rose-500 to-pink-700 hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg"
        >
          <Icon :path="mdiHeart" class="w-8 h-8 mb-3 text-white/90" />
          <div class="text-lg font-bold font-display text-white">Loved Songs</div>
          <div class="text-sm text-white/70 mt-0.5">{{ lovedTracks.length }} song{{ lovedTracks.length !== 1 ? 's' : '' }} you love</div>
        </button>
      </div>
    </section>

    <!-- Recently Played -->
    <section>
      <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Recently Played</h2>

      <div v-if="loadingRecent" class="space-y-1 animate-pulse">
        <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-1 py-2">
          <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
          <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
          <div class="flex-1 min-w-0 space-y-1.5">
            <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${55 + (i * 13) % 30}%` }"></div>
            <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${30 + (i * 17) % 25}%` }"></div>
          </div>
          <div class="h-2.5 bg-zinc-800 rounded w-14 hidden sm:block"></div>
          <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
        </div>
      </div>

      <div v-else-if="recentTracks.length === 0" class="text-zinc-500 text-sm">
        No recently played tracks yet. Start listening!
      </div>

      <TrackList v-else :tracks="recentTracks" show-cover show-artist show-album show-last-played hide-controls @love-toggled="loadLoved" />
    </section>

    <!-- Artists -->
    <section>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider">Your Artists</h2>
        <router-link
          v-if="artists.length > 0"
          to="/artists"
          class="text-xs px-3 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          View all
        </router-link>
      </div>

      <div v-if="loadingArtists" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 animate-pulse">
        <div v-for="i in 12" :key="i" class="rounded-lg p-2 sm:p-4">
          <div class="aspect-square bg-zinc-800 rounded-lg mb-3"></div>
          <div class="h-3.5 bg-zinc-800 rounded mb-1.5" :style="{ width: `${50 + (i * 11) % 35}%` }"></div>
          <div class="h-2.5 bg-zinc-800/60 rounded w-2/3"></div>
        </div>
      </div>

      <div v-else-if="artists.length === 0" class="text-zinc-500 text-sm">
        No artists yet. Scan your library in
        <router-link to="/settings" class="text-zinc-300 hover:text-zinc-100 underline">Settings</router-link>.
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
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
    </section>
  </div>
</template>
