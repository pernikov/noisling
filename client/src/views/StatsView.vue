<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import TrackList from '../components/TrackList.vue';
import CoverArt from '../components/CoverArt.vue';

const router = useRouter();
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
        <table class="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800">
              <th class="text-left py-2 px-3 w-10">#</th>
              <th class="text-left py-2 px-3">Artist</th>
              <th class="text-right py-2 px-3 w-16">Plays</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(artist, i) in stats.topArtists"
              :key="artist.name"
              class="cursor-pointer [&:hover>td]:bg-zinc-800/50 [&>td]:transition-colors [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md [&:first-child>td:first-child]:rounded-tl-none [&:first-child>td:last-child]:rounded-tr-none"
              @click="router.push({ name: 'artist', params: { name: artist.name } })"
            >
              <td class="py-2 px-3 text-zinc-500">{{ i + 1 }}</td>
              <td class="py-2 px-3">
                <div class="font-medium truncate">{{ artist.name }}</div>
                <div class="text-xs text-zinc-500">{{ artist.trackCount }} track{{ artist.trackCount !== 1 ? 's' : '' }}</div>
              </td>
              <td class="py-2 px-3 text-right text-zinc-500">{{ artist.plays }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Top Albums -->
      <section v-if="stats.topAlbums.length > 0">
        <h2 class="text-lg font-semibold font-display mb-4">Top Albums</h2>
        <table class="w-full text-sm border-separate border-spacing-0">
          <thead>
            <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800">
              <th class="text-left py-2 px-3 w-10">#</th>
              <th class="text-left py-2 px-3">Album</th>
              <th class="text-right py-2 px-3 w-16">Plays</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(album, i) in stats.topAlbums"
              :key="album.name"
              class="cursor-pointer [&:hover>td]:bg-zinc-800/50 [&>td]:transition-colors [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md [&:first-child>td:first-child]:rounded-tl-none [&:first-child>td:last-child]:rounded-tr-none"
              @click="router.push({ name: 'album', params: { artist: album.artists?.[0], album: album.name } })"
            >
              <td class="py-2 px-3 text-zinc-500">{{ i + 1 }}</td>
              <td class="py-2 px-3">
                <div class="flex items-center gap-2">
                  <CoverArt :cover="album.cover" size="w-8 h-8" />
                  <div class="min-w-0">
                    <div class="font-medium truncate">{{ album.name }}</div>
                    <div class="text-xs text-zinc-500 truncate">{{ album.artists?.join(', ') }}</div>
                  </div>
                </div>
              </td>
              <td class="py-2 px-3 text-right text-zinc-500">{{ album.plays }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- Empty state for listening stats -->
      <div v-if="stats.totalPlays === 0" class="text-zinc-500 text-sm">
        No listening data yet. Start playing some music!
      </div>
    </template>
  </div>
</template>
