<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { mdiPlus, mdiPlaylistMusic, mdiPlay, mdiShuffle } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { mosaicFromCovers } from '../composables/useMosaic.js';
import Icon from '../components/Icon.vue';
import IconButton from '../components/IconButton.vue';
import CreatePlaylistModal from '../components/CreatePlaylistModal.vue';

const api = useApi();
const router = useRouter();
const { playAlbum, playShuffled } = usePlayer();
const { showCoverArt, accentColor, accentRgb } = useTheme();

const ACCENT_RGB = {
  rose:    [244, 63,  94 ],
  amber:   [245, 158, 11 ],
  yellow:  [250, 204, 21 ],
  emerald: [16,  185, 129],
  teal:    [45,  212, 191],
  sky:     [14,  165, 233],
  indigo:  [99,  102, 241],
  violet:  [139, 92,  246],
  slate:   [148, 163, 184],
}
function luminance([r, g, b]) {
  const f = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const accentTextColor = computed(() => {
  const rgb = ACCENT_RGB[accentColor.value]
  return rgb && luminance(rgb) > 0.179 ? '#0a0a0b' : '#ffffff'
})

const playlists = ref([]);
const loading = ref(true);
const showCreate = ref(false);

async function load() {
  try {
    playlists.value = await api.getPlaylists();
  } catch (err) {
    console.error('Failed to load playlists:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

function goToPlaylist(id) {
  router.push({ name: 'playlist', params: { id } });
}

async function playPlaylist(playlist, event) {
  event.stopPropagation();
  try {
    const data = await api.getPlaylist(playlist._id);
    if (data.tracks?.length) playAlbum(data.tracks, 0);
  } catch (err) {
    console.error('Failed to play playlist:', err);
  }
}

async function shufflePlaylist(playlist, event) {
  event.stopPropagation();
  try {
    const data = await api.getPlaylist(playlist._id);
    if (data.tracks?.length) {
      playShuffled(data.tracks);
    }
  } catch (err) {
    console.error('Failed to shuffle playlist:', err);
  }
}

function onCreated(playlist) {
  showCreate.value = false;
  router.push({ name: 'playlist', params: { id: playlist._id } });
}

</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-bold font-display">Playlists</h1>
      <IconButton :icon="mdiPlus" label="New playlist" @click="showCreate = true" />
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
      <div v-for="i in 8" :key="i" class="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
        <div class="aspect-square bg-zinc-800" />
        <div class="p-3 space-y-1.5">
          <div class="h-3.5 bg-zinc-800 rounded w-3/4" />
          <div class="h-2.5 bg-zinc-700 rounded w-1/3" />
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="playlists.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-12 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiPlaylistMusic" class="w-10 h-10 text-zinc-600" />
      <p class="text-sm font-medium text-zinc-400">No playlists yet</p>
      <p class="text-xs text-zinc-600">Create a playlist and add tracks from the track menu.</p>
      <button
        @click="showCreate = true"
        class="mt-2 flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
      >
        <Icon :path="mdiPlus" class="w-4 h-4" />
        New playlist
      </button>
    </div>

    <!-- Cards grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      <div
        v-for="playlist in playlists"
        :key="playlist._id"
        class="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden cursor-pointer hover:border-zinc-700 hover:bg-zinc-800/60 transition-colors group"
        @click="goToPlaylist(playlist._id)"
      >
        <!-- Cover art collage / fallback -->
        <div class="aspect-square relative overflow-hidden bg-zinc-800">
          <!-- Cover mosaic -->
          <template v-if="showCoverArt && playlist.covers?.length">
            <div
              class="w-full h-full grid"
              :style="mosaicFromCovers(playlist.covers).style"
            >
              <div
                v-for="(cover, i) in mosaicFromCovers(playlist.covers).cells"
                :key="i"
                class="overflow-hidden bg-zinc-700"
              >
                <img v-if="cover" :src="api.coverUrl(cover)" class="w-full h-full object-cover" style="opacity:0;transition:opacity 0.3s ease" @load="e => e.target.style.opacity='1'" alt="" />
              </div>
            </div>
          </template>
          <!-- No covers / cover art disabled -->
          <template v-else>
            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-900">
              <Icon :path="mdiPlaylistMusic" class="w-12 h-12 text-zinc-600" />
            </div>
          </template>

        </div>

        <!-- Info -->
        <div class="px-3 py-2.5 flex items-center gap-2">
          <div class="min-w-0 flex-1">
            <div class="font-medium font-display truncate text-sm">{{ playlist.name }}</div>
            <div class="text-xs text-zinc-500 mt-0.5">{{ playlist.trackCount }} track{{ playlist.trackCount !== 1 ? 's' : '' }}</div>
          </div>
          <div class="hidden sm:flex items-center gap-1 shrink-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto">
            <button
              @click.stop="shufflePlaylist(playlist, $event)"
              class="flex items-center justify-center w-7 h-7 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700/60 active:scale-95 transition-all duration-150"
              title="Shuffle"
            >
              <Icon :path="mdiShuffle" class="w-3.5 h-3.5" />
            </button>
            <button
              @click.stop="playPlaylist(playlist, $event)"
              class="flex items-center justify-center w-7 h-7 rounded-md active:scale-95 hover:brightness-110 transition-all duration-150"
              :style="{ backgroundColor: `rgb(${accentRgb})`, color: accentTextColor }"
              title="Play"
            >
              <Icon :path="mdiPlay" class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <CreatePlaylistModal
      v-if="showCreate"
      @close="showCreate = false"
      @created="onCreated"
    />
  </div>
</template>
