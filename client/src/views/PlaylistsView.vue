<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { mdiPlus, mdiPlaylistMusic, mdiPlay, mdiShuffle } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { mosaicFromCovers } from '../composables/useMosaic.js';
import Icon from '../components/Icon.vue';
import IconButton from '../components/IconButton.vue';
import TransportButton from '../components/TransportButton.vue';
import Button from '../components/Button.vue';
import CreatePlaylistModal from '../components/CreatePlaylistModal.vue';

const api = useApi();
const router = useRouter();
const { playAlbum, playShuffled } = usePlayer();

const playlists = ref([]);
const loading = ref(true);
const showCreate = ref(false);
const loadError = ref(false);

function playlistDetail(playlist) {
  if (!playlist.trackCount) return 'Empty';
  return `${playlist.trackCount} track${playlist.trackCount !== 1 ? 's' : ''}`;
}

async function load() {
  loading.value = true;
  loadError.value = false;
  try {
    playlists.value = await api.getPlaylists();
  } catch (err) {
    console.error('Failed to load playlists:', err);
    playlists.value = [];
    loadError.value = true;
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

function onPlaylistCardKeydown(event, playlistId) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  goToPlaylist(playlistId);
}

</script>

<template>
  <div>
    <div class="flex items-start justify-between mb-6 gap-4">
      <h1 class="flex min-h-11 items-center text-2xl font-bold font-display">Playlists</h1>
      <IconButton :icon="mdiPlus" label="New playlist" variant="ghost" class="shrink-0" @click="showCreate = true" />
    </div>

    <!-- Loading skeleton -->
    <div v-if="loading" class="animate-pulse">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        <div v-for="i in 12" :key="`card-${i}`" class="overflow-hidden rounded-lg bg-zinc-900/35">
          <div class="aspect-square bg-zinc-800" />
          <div class="flex items-center gap-2 bg-zinc-900 px-3 py-2.5">
            <div class="min-w-0 flex-1">
              <div class="h-3 rounded bg-zinc-800" :style="{ width: `${42 + (i * 9) % 30}%` }" />
              <div class="mt-2 h-2.5 rounded bg-zinc-800/60" :style="{ width: `${22 + (i * 7) % 18}%` }" />
            </div>
            <div class="ml-2 flex items-center gap-1 shrink-0">
              <div class="hidden sm:block h-8 w-8 rounded-full bg-zinc-800/80" />
              <div class="h-8 w-8 rounded-full bg-zinc-800/80" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else-if="loadError" class="bg-zinc-900 rounded-lg border border-red-900/60 p-12 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiPlaylistMusic" class="w-10 h-10 text-red-400/80" />
      <p class="text-sm font-medium text-zinc-200">Couldn&apos;t load playlists</p>
      <p class="text-xs text-zinc-500">The server didn&apos;t return your playlists. Try again in a moment.</p>
      <Button class="mt-2" @click="load">Retry</Button>
    </div>

    <div v-else-if="playlists.length === 0" class="bg-zinc-900 rounded-lg border border-zinc-800 p-12 flex flex-col items-center gap-3 text-center">
      <Icon :path="mdiPlaylistMusic" class="w-10 h-10 text-zinc-600" />
      <p class="text-sm font-medium text-zinc-400">No playlists yet</p>
      <p class="text-xs text-zinc-600">Create a playlist and add tracks from the track menu.</p>
      <Button class="mt-2" @click="showCreate = true">
        <Icon :path="mdiPlus" class="w-4 h-4" />
        New playlist
      </Button>
    </div>

    <div v-else>
      <section class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        <div
          v-for="playlist in playlists"
          :key="playlist._id"
          class="group cursor-pointer"
          role="link"
          tabindex="0"
          :aria-label="`Open playlist ${playlist.name}`"
          @click="goToPlaylist(playlist._id)"
          @keydown="onPlaylistCardKeydown($event, playlist._id)"
        >
          <div class="overflow-hidden rounded-lg bg-zinc-900/35">
            <div class="relative aspect-square overflow-hidden bg-zinc-800">
              <template v-if="playlist.covers?.length">
                <div
                  class="h-full w-full grid transition-transform duration-500 group-hover:scale-[1.03]"
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
              <template v-else>
                <div class="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-700 to-zinc-950">
                  <Icon :path="mdiPlaylistMusic" class="w-14 h-14 text-zinc-600" />
                </div>
              </template>

              <div class="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent opacity-80 transition-opacity duration-200 group-hover:opacity-100" />
            </div>

            <div class="flex items-center gap-2 bg-zinc-900 px-3 py-2.5">
              <div class="min-w-0 flex-1">
                <div class="truncate font-display text-sm font-medium text-zinc-100">
                  {{ playlist.name }}
                </div>
                <div class="mt-0.5 truncate whitespace-nowrap text-xs text-zinc-500">
                  {{ playlistDetail(playlist) }}
                </div>
              </div>

              <div class="ml-2 hidden shrink-0 items-center gap-1 opacity-0 pointer-events-none transition-opacity duration-200 sm:flex group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto">
                <TransportButton
                  @click.stop="shufflePlaylist(playlist, $event)"
                  size="sm"
                  variant="subtle"
                  :icon="mdiShuffle"
                  label="Shuffle"
                  title="Shuffle"
                />
                <TransportButton
                  @click.stop="playPlaylist(playlist, $event)"
                  size="sm"
                  variant="accent"
                  :icon="mdiPlay"
                  label="Play"
                  title="Play"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <CreatePlaylistModal
      v-if="showCreate"
      @close="showCreate = false"
      @created="onCreated"
    />
  </div>
</template>
