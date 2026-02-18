<script setup>
import { ref, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import TrackList from '../components/TrackList.vue';
import CoverArt from '../components/CoverArt.vue';

const api = useApi();
const stats = ref(null);
const loading = ref(true);

async function loadStats() {
  try {
    stats.value = await api.getStats();
  } catch (err) {
    console.error('Failed to load stats:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(loadStats);

function formatDuration(seconds) {
  if (!seconds) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}
</script>

<template>
  <div class="space-y-10">
    <h1 class="text-2xl font-bold font-display">Stats</h1>

    <div v-if="loading" class="text-zinc-500 text-sm">Loading...</div>

    <template v-else-if="stats">
      <!-- Library Overview -->
      <section>
        <h2 class="text-lg font-semibold font-display mb-4">Library Overview</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <div class="bg-zinc-900 rounded-lg p-4">
            <div class="text-2xl font-bold font-display">{{ stats.totalTracks.toLocaleString() }}</div>
            <div class="text-xs text-zinc-400 mt-1">Tracks</div>
          </div>
          <div class="bg-zinc-900 rounded-lg p-4">
            <div class="text-2xl font-bold font-display">{{ stats.totalArtists.toLocaleString() }}</div>
            <div class="text-xs text-zinc-400 mt-1">Artists</div>
          </div>
          <div class="bg-zinc-900 rounded-lg p-4">
            <div class="text-2xl font-bold font-display">{{ stats.totalAlbums.toLocaleString() }}</div>
            <div class="text-xs text-zinc-400 mt-1">Albums</div>
          </div>
          <div class="bg-zinc-900 rounded-lg p-4">
            <div class="text-2xl font-bold font-display">{{ formatDuration(stats.totalDuration) }}</div>
            <div class="text-xs text-zinc-400 mt-1">Total Duration</div>
          </div>
          <div class="bg-zinc-900 rounded-lg p-4">
            <div class="text-2xl font-bold font-display">{{ formatSize(stats.totalFileSize) }}</div>
            <div class="text-xs text-zinc-400 mt-1">Library Size</div>
          </div>
          <div class="bg-zinc-900 rounded-lg p-4">
            <div class="text-2xl font-bold font-display">{{ stats.totalPlays.toLocaleString() }}</div>
            <div class="text-xs text-zinc-400 mt-1">Total Plays</div>
          </div>
        </div>
      </section>

      <!-- Format Breakdown -->
      <section v-if="stats.formats.length > 0">
        <h2 class="text-lg font-semibold font-display mb-4">Formats</h2>
        <div class="space-y-2 max-w-md">
          <div v-for="f in stats.formats" :key="f.format" class="flex items-center gap-3">
            <span class="text-sm text-zinc-300 w-14 text-right uppercase">{{ f.format || '?' }}</span>
            <div class="flex-1 h-2 bg-zinc-800 rounded overflow-hidden">
              <div
                class="h-full bg-emerald-500/60 rounded"
                :style="{ width: (f.count / stats.totalTracks * 100) + '%' }"
              />
            </div>
            <span class="text-xs text-zinc-500 w-12">{{ f.count }}</span>
          </div>
        </div>
      </section>

      <!-- Most Played Tracks -->
      <section v-if="stats.topTracks.length > 0">
        <h2 class="text-lg font-semibold font-display mb-4">Most Played Tracks</h2>
        <TrackList :tracks="stats.topTracks" show-cover show-artist show-album show-plays />
      </section>

      <!-- Top Artists -->
      <section v-if="stats.topArtists.length > 0">
        <h2 class="text-lg font-semibold font-display mb-4">Top Artists</h2>
        <div class="space-y-2">
          <router-link
            v-for="(artist, i) in stats.topArtists"
            :key="artist.name"
            :to="{ name: 'artist', params: { name: artist.name } }"
            class="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <span class="text-sm text-zinc-500 w-6 text-right">{{ i + 1 }}</span>
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ artist.name }}</div>
              <div class="text-xs text-zinc-500">{{ artist.trackCount }} track{{ artist.trackCount !== 1 ? 's' : '' }}</div>
            </div>
            <span class="text-sm text-zinc-400">{{ artist.plays }} play{{ artist.plays !== 1 ? 's' : '' }}</span>
          </router-link>
        </div>
      </section>

      <!-- Top Albums -->
      <section v-if="stats.topAlbums.length > 0">
        <h2 class="text-lg font-semibold font-display mb-4">Top Albums</h2>
        <div class="space-y-2">
          <router-link
            v-for="(album, i) in stats.topAlbums"
            :key="album.name"
            :to="{ name: 'album', params: { artist: album.artists?.[0], album: album.name } }"
            class="flex items-center gap-4 px-3 py-2 rounded-lg hover:bg-zinc-900 transition-colors"
          >
            <span class="text-sm text-zinc-500 w-6 text-right">{{ i + 1 }}</span>
            <CoverArt :cover="album.cover" size="w-10 h-10" />
            <div class="flex-1 min-w-0">
              <div class="text-sm font-medium truncate">{{ album.name }}</div>
              <div class="text-xs text-zinc-500 truncate">{{ album.artists?.join(', ') }}</div>
            </div>
            <span class="text-sm text-zinc-400">{{ album.plays }} play{{ album.plays !== 1 ? 's' : '' }}</span>
          </router-link>
        </div>
      </section>

      <!-- Empty state for listening stats -->
      <div v-if="stats.totalPlays === 0" class="text-zinc-500 text-sm">
        No listening data yet. Start playing some music!
      </div>
    </template>
  </div>
</template>
