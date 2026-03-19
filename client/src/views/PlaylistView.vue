<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { mdiPlay, mdiShuffle, mdiTrashCan, mdiPencil, mdiPlaylistMusic, mdiPlus } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { useMosaic } from '../composables/useMosaic.js';
import TrackList from '../components/TrackList.vue';
import Icon from '../components/Icon.vue';
import IconButton from '../components/IconButton.vue';
import ConfirmModal from '../components/ConfirmModal.vue';
import BulkAddToPlaylistModal from '../components/BulkAddToPlaylistModal.vue';
import CreatePlaylistModal from '../components/CreatePlaylistModal.vue';

const route = useRoute();
const router = useRouter();
const api = useApi();
const { playAlbum, playShuffled, state: playerState } = usePlayer();
const { tracksColumns, showCoverArt } = useTheme();

const playlist = ref(null);
const tracks = ref([]);

const mosaicCovers = computed(() => {
  const seen = new Set();
  const result = [];
  for (const t of tracks.value) {
    if (t.cover && !seen.has(t.cover)) {
      seen.add(t.cover);
      result.push(t.cover);
    }
  }
  return result;
});

const { mosaicCells, mosaicStyle } = useMosaic(mosaicCovers);
const loading = ref(true);
const confirm = ref(null);
const showBulkAdd = ref(false);
const bulkAddToast = ref('');

const renamingName = ref(false);

async function load() {
  loading.value = true;
  try {
    const data = await api.getPlaylist(route.params.id);
    playlist.value = data;
    tracks.value = data.tracks ?? [];
  } catch (err) {
    console.error('Failed to load playlist:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(load);

watch(() => playerState.playReportCount, () => {
  const id = playerState.currentTrack?._id;
  if (!id) return;
  const track = tracks.value.find(t => t._id === id);
  if (track) track.playCount = (track.playCount ?? 0) + 1;
});

function playAll() {
  if (tracks.value.length) playAlbum(tracks.value, 0);
}

function playShuffle() {
  if (!tracks.value.length) return;
  playShuffled(tracks.value);
}

function startEditName() {
  renamingName.value = true;
}

function onRenamed(updated) {
  playlist.value.name = updated.name;
  renamingName.value = false;
}

async function reorderTracks(reordered) {
  const prev = tracks.value;
  tracks.value = reordered;
  try {
    await api.updatePlaylist(playlist.value._id, { trackIds: reordered.map(t => t._id) });
  } catch (err) {
    console.error('Failed to reorder tracks:', err);
    tracks.value = prev;
  }
}

async function removeTrack(trackId) {
  try {
    await api.removeFromPlaylist(playlist.value._id, trackId);
    tracks.value = tracks.value.filter(t => t._id !== trackId);
  } catch (err) {
    console.error('Failed to remove track:', err);
  }
}

function promptDelete() {
  confirm.value = {
    title: 'Delete playlist?',
    message: playlist.value.name + ' will be permanently deleted.',
    confirmLabel: 'Delete',
    destructive: true,
    onConfirm: deletePlaylist,
  };
}

let toastTimer = null;
async function onBulkAdded(count) {
  await load();
  bulkAddToast.value = `Added ${count} track${count !== 1 ? 's' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { bulkAddToast.value = ''; }, 3000);
}

async function deletePlaylist() {
  try {
    await api.deletePlaylist(playlist.value._id);
    router.replace({ name: 'playlists' });
  } catch (err) {
    console.error('Failed to delete playlist:', err);
  }
}
</script>

<template>
  <div>
    <div v-if="loading" class="animate-pulse">
      <div class="flex flex-col sm:flex-row sm:items-end gap-5 mb-8">
        <div class="shrink-0 w-full aspect-square sm:w-48 sm:h-48 sm:aspect-auto rounded-xl bg-zinc-800"></div>
        <div class="min-w-0 flex-1">
          <div class="h-2.5 bg-zinc-800/70 rounded w-16 mb-3"></div>
          <div class="h-8 bg-zinc-800 rounded w-56 max-w-[75%] mb-2"></div>
          <div class="h-3 bg-zinc-800/60 rounded w-24 mb-5"></div>
          <div class="flex items-center gap-2">
            <div class="h-10 w-24 bg-zinc-800 rounded-lg"></div>
            <div class="h-10 w-24 bg-zinc-800 rounded-lg"></div>
            <div class="h-10 w-28 bg-zinc-800 rounded-lg"></div>
            <div class="ml-auto w-8 h-8 rounded bg-zinc-800/80"></div>
          </div>
        </div>
      </div>

      <div class="sm:hidden space-y-2">
        <div v-for="i in 6" :key="`mobile-${i}`" class="rounded-2xl bg-zinc-900/35">
          <div class="flex items-center gap-3 px-3 py-3.5">
            <div class="w-11 h-11 bg-zinc-800 rounded-lg shrink-0"></div>
            <div class="flex-1 min-w-0 space-y-2">
              <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${50 + (i * 13) % 35}%` }"></div>
              <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${40 + (i * 9) % 30}%` }"></div>
            </div>
            <div class="w-9 h-9 bg-zinc-800/80 rounded-full shrink-0"></div>
          </div>
        </div>
      </div>

      <div class="hidden sm:block">
        <div class="grid grid-cols-[2rem,minmax(0,1fr),minmax(0,18%),minmax(0,18%),4rem,1rem,4rem] items-center gap-x-3 px-1 py-2 border-b border-zinc-800">
          <div class="h-3 bg-zinc-800/70 rounded"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-12"></div>
          <div class="h-3 bg-zinc-800/70 rounded w-10 justify-self-center"></div>
          <div></div>
          <div class="h-3 bg-zinc-800/70 rounded w-10 justify-self-end"></div>
        </div>
        <div v-for="i in 8" :key="`desktop-${i}`" class="grid grid-cols-[2rem,minmax(0,1fr),minmax(0,18%),minmax(0,18%),4rem,1rem,4rem] items-center gap-x-3 px-1 py-2">
          <div class="h-3 bg-zinc-800 rounded w-4 justify-self-center"></div>
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
            <div class="min-w-0 space-y-1.5 flex-1">
              <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${45 + (i * 13) % 35}%` }"></div>
            </div>
          </div>
          <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${55 + (i * 7) % 25}%` }"></div>
          <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${50 + (i * 11) % 30}%` }"></div>
          <div class="h-2.5 bg-zinc-800 rounded w-8 justify-self-center"></div>
          <div class="w-4 h-4 bg-zinc-800/70 rounded-full justify-self-center"></div>
          <div class="h-2.5 bg-zinc-800 rounded w-10 justify-self-end"></div>
        </div>
      </div>
    </div>

    <template v-else-if="playlist">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end gap-5 mb-8">
        <!-- Cover mosaic -->
        <div
          v-if="showCoverArt"
          class="shrink-0 w-full aspect-square sm:w-48 sm:h-48 sm:aspect-auto rounded-xl overflow-hidden bg-zinc-800"
        >
          <TransitionGroup
            v-if="mosaicCovers.length"
            tag="div"
            name="mosaic"
            class="w-full h-full grid"
            :style="mosaicStyle"
          >
            <div v-for="cover in mosaicCells" :key="cover" class="overflow-hidden bg-zinc-700">
              <img :src="api.coverUrl(cover)" class="w-full h-full object-cover" style="opacity:0;transition:opacity 0.3s ease" @load="e => e.target.style.opacity='1'" alt="" />
            </div>
          </TransitionGroup>
          <div v-else class="w-full h-full flex items-center justify-center">
            <Icon :path="mdiPlaylistMusic" class="w-14 h-14 text-zinc-600" />
          </div>
        </div>

        <!-- Info + controls -->
        <div class="min-w-0 flex-1">
          <p class="text-xs uppercase text-zinc-500 mb-1 tracking-wider">Playlist</p>
          <div class="flex items-center gap-2 mb-1">
            <h1 class="text-2xl sm:text-3xl font-bold font-display truncate">{{ playlist.name }}</h1>
            <button @click="startEditName" class="text-zinc-600 hover:text-zinc-400 p-1 shrink-0">
              <Icon :path="mdiPencil" class="w-4 h-4" />
            </button>
          </div>
          <p class="text-sm text-zinc-500 mb-4">{{ tracks.length }} track{{ tracks.length !== 1 ? 's' : '' }}</p>

          <div class="flex items-center gap-2">
            <IconButton :icon="mdiPlay" label="Play all" :disabled="!tracks.length" @click="playAll" />
            <IconButton :icon="mdiShuffle" label="Shuffle" :disabled="!tracks.length" @click="playShuffle" />
            <IconButton :icon="mdiPlus" label="Add tracks" @click="showBulkAdd = true" />
            <Transition name="fade">
              <span v-if="bulkAddToast" class="text-xs text-zinc-400 ml-1">{{ bulkAddToast }}</span>
            </Transition>
            <button
              @click="promptDelete"
              class="ml-auto text-zinc-600 hover:text-red-400 transition-colors p-1.5"
              title="Delete playlist"
            >
              <Icon :path="mdiTrashCan" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Track list -->
      <div v-if="tracks.length === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-10 text-center">
        <p class="text-sm text-zinc-500">No tracks yet.</p>
        <p class="text-xs text-zinc-600 mt-1">Add tracks via the "..." menu in any track list.</p>
      </div>

      <TrackList
        v-else
        :tracks="tracks"
        show-cover
        :show-artist="tracksColumns.artist"
        :show-album="tracksColumns.album"
        :show-plays="tracksColumns.plays"
        hide-controls
        draggable
        :playlist-id="playlist._id"
        @remove-from-playlist="removeTrack"
        @reorder="reorderTracks"
      />
    </template>

    <CreatePlaylistModal
      v-if="renamingName"
      :playlist="playlist"
      @close="renamingName = false"
      @renamed="onRenamed"
    />

    <ConfirmModal
      v-if="confirm"
      :title="confirm.title"
      :message="confirm.message"
      :confirm-label="confirm.confirmLabel"
      :destructive="confirm.destructive"
      @confirm="confirm.onConfirm(); confirm = null"
      @cancel="confirm = null"
    />

    <BulkAddToPlaylistModal
      v-if="showBulkAdd"
      :playlist-id="playlist._id"
      @close="showBulkAdd = false"
      @added="onBulkAdded"
    />
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.4s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.mosaic-move {
  transition: transform 0.4s ease;
}
.mosaic-enter-active,
.mosaic-leave-active {
  transition: opacity 0.3s ease;
}
.mosaic-enter-from,
.mosaic-leave-to {
  opacity: 0;
}
</style>
