<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue';
import { useRouter } from 'vue-router';
import { mdiShuffle, mdiFire, mdiHeart, mdiHistory, mdiAlbum } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useLibraryEvents } from '../composables/useLibraryEvents.js';
import { useTheme } from '../composables/useTheme.js';
import TrackList from '../components/TrackList.vue';
import CoverArt from '../components/CoverArt.vue';
import Icon from '../components/Icon.vue';
import Spinner from '../components/Spinner.vue';

const api = useApi();
const router = useRouter();
const { state: playerState, playAlbum, shuffleAll } = usePlayer();
const { homeShowQuickPlay, homeShowRecent, homeShowAlbums, tracksColumns, accentRgb, accentDarkRgb, lovedUseAccent } = useTheme();

const lovedTracks = ref([]);
const recentTracks = ref([]);
const recentAlbums = ref([]);
const loadingLoved = ref(true);
const loadingRecent = ref(true);
const loadingRecentAlbums = ref(true);

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
const lastIdx = parseInt(localStorage.getItem('noisling-greeting-idx') ?? '-1', 10);
const nextIdx = (lastIdx + 1) % GREETINGS.length;
localStorage.setItem('noisling-greeting-idx', String(nextIdx));
const greeting = GREETINGS[nextIdx];

const loadingShuffleAll = ref(false);
const loadingTopTracks = ref(false);
const recentlySavedTrackId = ref(null);
const completingRecentTrack = ref(null);
let recentSavedAnimationTimer = null;
let completingRecentTimer = null;
let completingRecentFadeTimer = null;

const recentTracksForDisplay = computed(() => {
  const currentTrack = playerState.currentTrack;
  const completingTrackId = completingRecentTrack.value?._id?.toString?.() ?? completingRecentTrack.value?._id ?? null;

  if (completingRecentTrack.value) {
    const dedupedRecentTracks = recentTracks.value.filter((track) => {
      const trackId = track._id?.toString?.() ?? track._id;
      return trackId !== completingTrackId;
    });

    return [
      {
        ...completingRecentTrack.value,
        historyId: completingTrackId,
        _pendingRecentPhase: completingRecentTrack.value._pendingRecentPhase,
      },
      ...dedupedRecentTracks.slice(0, 9),
    ];
  }

  if (!currentTrack || playerState.currentTrackReported) return recentTracks.value;

  const currentTrackId = currentTrack._id?.toString?.() ?? currentTrack._id;
  const dedupedRecentTracks = recentTracks.value.filter((track) => {
    const trackId = track._id?.toString?.() ?? track._id;
    return trackId !== currentTrackId;
  });

  return [
    {
      ...currentTrack,
      historyId: `pending-${currentTrackId}`,
      _pendingRecentPhase: 'counting',
    },
    ...dedupedRecentTracks.slice(0, 9),
  ];
});

async function playShuffleAll() {
  loadingShuffleAll.value = true;
  try {
    await shuffleAll();
  } finally {
    loadingShuffleAll.value = false;
  }
}

async function playTopTracks() {
  loadingTopTracks.value = true;
  try {
    const tracks = await api.getTopTracks(50);
    if (tracks.length) playAlbum(tracks, 0);
  } finally {
    loadingTopTracks.value = false;
  }
}

async function loadLoved() {
  try {
    lovedTracks.value = await api.getLovedTracks();
  } catch (err) {
    console.error('Failed to load loved tracks:', err);
  } finally {
    loadingLoved.value = false;
  }
}

function playLovedTracks() {
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

function triggerRecentSavedAnimation(trackId) {
  if (!trackId) return;
  recentlySavedTrackId.value = trackId;
  clearTimeout(recentSavedAnimationTimer);
  recentSavedAnimationTimer = setTimeout(() => {
    if (recentlySavedTrackId.value === trackId) recentlySavedTrackId.value = null;
  }, 900);
}

function clearCompletingRecentRow() {
  clearTimeout(completingRecentTimer);
  clearTimeout(completingRecentFadeTimer);
  completingRecentTimer = null;
  completingRecentFadeTimer = null;
  completingRecentTrack.value = null;
}

function stageCompletedPendingRow(trackId) {
  if (!trackId) return;

  const recentMatch = recentTracks.value.find((track) => (track._id?.toString?.() ?? track._id) === trackId);
  const currentTrackId = playerState.currentTrack?._id?.toString?.() ?? playerState.currentTrack?._id ?? null;
  const completedTrack = recentMatch ?? (currentTrackId === trackId ? playerState.currentTrack : null);
  if (!completedTrack) return;

  clearCompletingRecentRow();
  completingRecentTrack.value = {
    ...completedTrack,
    _pendingRecentPhase: 'completed',
  };
  triggerRecentSavedAnimation(trackId);
  completingRecentFadeTimer = setTimeout(() => {
    if ((completingRecentTrack.value?._id?.toString?.() ?? completingRecentTrack.value?._id) === trackId) {
      completingRecentTrack.value = {
        ...completingRecentTrack.value,
        _pendingRecentPhase: 'fading',
      };
    }
    completingRecentFadeTimer = null;
  }, 1760);
  completingRecentTimer = setTimeout(() => {
    if ((completingRecentTrack.value?._id?.toString?.() ?? completingRecentTrack.value?._id) === trackId) {
      completingRecentTrack.value = null;
    }
    completingRecentTimer = null;
  }, 2000);
}

async function loadRecentAlbums() {
  try {
    recentAlbums.value = await api.getRecentAlbums(12);
  } catch (err) {
    console.error('Failed to load recent albums:', err);
  } finally {
    loadingRecentAlbums.value = false;
  }
}

onMounted(() => {
  if (homeShowQuickPlay.value) loadLoved();
  if (homeShowRecent.value)    loadRecent();
  if (homeShowAlbums.value)   loadRecentAlbums();
});

onBeforeUnmount(() => {
  clearTimeout(recentSavedAnimationTimer);
  clearCompletingRecentRow();
});

useLibraryEvents(() => {
  if (homeShowRecent.value)  loadRecent();
  if (homeShowAlbums.value)  loadRecentAlbums();
});

watch(() => playerState.playReportCount, async (count) => {
  if (count > 0 && homeShowRecent.value) {
    stageCompletedPendingRow(playerState.lastReportedTrackId);
    await loadRecent();
  }
});

watch(() => playerState.currentTrack?._id?.toString?.() ?? playerState.currentTrack?._id ?? null, (trackId) => {
  const completingTrackId = completingRecentTrack.value?._id?.toString?.() ?? completingRecentTrack.value?._id ?? null;
  if (completingTrackId && trackId && completingTrackId !== trackId) {
    clearCompletingRecentRow();
  }
});

watch(() => playerState.loveToggled, (change) => {
  if (!change || !homeShowQuickPlay.value) return;
  if (change.isLoved) {
    loadLoved(); // reload to get the full track object
  } else {
    lovedTracks.value = lovedTracks.value.filter(t => t._id !== change.id);
  }
});

function goToAlbum(album) {
  router.push({ name: 'album', params: { artist: album.artistsNorm[0], album: album.name } });
}
</script>

<template>
  <div class="space-y-10">
    <h1 class="text-2xl font-bold font-display">{{ greeting }}</h1>

    <!-- Quick Actions -->
    <section v-if="homeShowQuickPlay">
      <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-3">Quick Play</h2>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <!-- Shuffle All -->
        <button
          @click="playShuffleAll"
          :disabled="loadingShuffleAll"
          class="relative overflow-hidden rounded-xl p-5 text-left bg-gradient-to-br from-violet-500 to-purple-700 hover:scale-[1.02] active:scale-[0.98] transition-transform disabled:opacity-60 disabled:cursor-not-allowed shadow-lg"
        >
          <div v-if="loadingShuffleAll" class="absolute inset-0 flex items-center justify-center bg-black/20">
            <Spinner class="w-8 h-8 text-white" />
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
            <Spinner class="w-8 h-8 text-white" />
          </div>
          <Icon :path="mdiFire" class="w-8 h-8 mb-3 text-white/90" />
          <div class="text-lg font-bold font-display text-white">Top Tracks</div>
          <div class="text-sm text-white/70 mt-0.5">Your 50 most listened-to tracks</div>
        </button>

        <!-- Loved Tracks -->
        <button
          @click="playLovedTracks"
          :disabled="loadingLoved || lovedTracks.length === 0"
          class="relative overflow-hidden rounded-xl p-5 text-left bg-gradient-to-br from-rose-500 to-pink-700 hover:scale-[1.02] active:scale-[0.98] transition-[transform,opacity] duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg"
          :style="lovedUseAccent ? { backgroundImage: `linear-gradient(to bottom right, rgb(${accentRgb}), rgb(${accentDarkRgb}))` } : undefined"
        >
          <Icon :path="mdiHeart" class="w-8 h-8 mb-3 text-white/90" />
          <div class="text-lg font-bold font-display text-white">Loved Tracks</div>
          <div class="text-sm text-white/70 mt-0.5 relative h-5 overflow-hidden">
            <Transition
              enter-active-class="transition-opacity duration-300"
              leave-active-class="transition-opacity duration-150 absolute inset-0"
              enter-from-class="opacity-0"
              leave-to-class="opacity-0"
              mode="out-in"
            >
              <span v-if="loadingLoved" key="loading" class="flex items-center">
                <Spinner class="w-4 h-4 text-white/70" />
              </span>
              <span v-else-if="lovedTracks.length === 0" key="empty">Love some tracks to play them here</span>
              <span v-else key="count">{{ lovedTracks.length }} track{{ lovedTracks.length !== 1 ? 's' : '' }} you love</span>
            </Transition>
          </div>
        </button>


      </div>
    </section>

    <!-- Recently Played -->
    <section v-if="homeShowRecent">
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

      <div v-else-if="recentTracksForDisplay.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-8 flex flex-col items-center gap-3 text-center">
        <Icon :path="mdiHistory" class="w-8 h-8 text-zinc-600" />
        <p class="text-sm font-medium text-zinc-400">Nothing played yet</p>
        <p class="text-xs text-zinc-600">Your recently played tracks will show up here.</p>
      </div>

      <TrackList
        v-else
        :tracks="recentTracksForDisplay"
        show-cover
        :show-artist="tracksColumns.artist"
        :show-album="tracksColumns.album"
        :show-plays="tracksColumns.plays"
        :show-last-played="tracksColumns.lastPlayed"
        :saved-track-id="recentlySavedTrackId"
        show-pending-state
        hide-controls
      />
    </section>

    <!-- Recently Added Albums -->
    <section v-if="homeShowAlbums">
      <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Recently Added</h2>

      <div v-if="loadingRecentAlbums" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4 animate-pulse">
        <div v-for="i in 12" :key="i" class="rounded-lg p-2 sm:p-4">
          <div class="aspect-square bg-zinc-800 rounded-lg mb-3"></div>
          <div class="h-3.5 bg-zinc-800 rounded mb-1.5" :style="{ width: `${50 + (i * 11) % 35}%` }"></div>
          <div class="h-2.5 bg-zinc-800/60 rounded w-2/3"></div>
        </div>
      </div>

      <div v-else-if="recentAlbums.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-8 flex flex-col items-center gap-3 text-center">
        <Icon :path="mdiAlbum" class="w-8 h-8 text-zinc-600" />
        <p class="text-sm font-medium text-zinc-400">No albums yet</p>
        <p class="text-xs text-zinc-600">
          <router-link to="/settings?tab=library" class="text-zinc-400 hover:text-zinc-200 underline">Scan your library</router-link> to discover your music.
        </p>
      </div>

      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-4">
        <div
          v-for="album in recentAlbums"
          :key="album.name"
          class="rounded-lg p-2 sm:p-4 hover:bg-zinc-900 cursor-pointer transition-colors group"
          @click="goToAlbum(album)"
        >
          <div class="w-full aspect-square rounded-lg overflow-hidden bg-zinc-800 mb-3">
            <CoverArt :cover="album.cover" size="w-full h-full" />
          </div>
          <div class="font-medium font-display truncate">{{ album.name }}</div>
          <div class="text-xs text-zinc-500 truncate">{{ album.artists[0] }}</div>
        </div>
      </div>
    </section>
  </div>
</template>
