<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { mdiPlay, mdiShuffle, mdiTrashCan, mdiPencil, mdiPlaylistMusic } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import TrackList from '../components/TrackList.vue';
import Icon from '../components/Icon.vue';
import Spinner from '../components/Spinner.vue';
import BaseModal from '../components/BaseModal.vue';
import ConfirmModal from '../components/ConfirmModal.vue';

const route = useRoute();
const router = useRouter();
const api = useApi();
const { playAlbum, state: playerState } = usePlayer();
const { songsColumns, showCoverArt } = useTheme();

// Unique covers from loaded tracks, up to 9
const mosaicCovers = computed(() => {
  const seen = new Set();
  const result = [];
  for (const t of tracks.value) {
    if (t.cover && !seen.has(t.cover)) {
      seen.add(t.cover);
      result.push(t.cover);
      if (result.length === 9) break;
    }
  }
  return result;
});

// Grid columns: 1 cover → 1×1, 2–4 → 2×2, 5+ → 3×3
const mosaicCols = computed(() => {
  const n = mosaicCovers.value.length;
  if (n >= 5) return 3;
  if (n >= 2) return 2;
  return 1;
});

const mosaicCells = computed(() => {
  const cols = mosaicCols.value;
  const total = cols * cols;
  const covers = mosaicCovers.value.slice(0, total);
  // Pad with nulls so the grid is always full
  while (covers.length < total) covers.push(null);
  return covers;
});

const playlist = ref(null);
const tracks = ref([]);
const loading = ref(true);
const confirm = ref(null);

const renamingName = ref(false);
const editName = ref('');
const savingName = ref(false);

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
  if (track) track.plays = (track.plays ?? 0) + 1;
});

function playAll() {
  if (tracks.value.length) playAlbum(tracks.value, 0);
}

function playShuffle() {
  if (!tracks.value.length) return;
  const idx = Math.floor(Math.random() * tracks.value.length);
  playAlbum(tracks.value, idx);
}

function startEditName() {
  editName.value = playlist.value.name;
  renamingName.value = true;
}

async function saveEditName() {
  if (!editName.value.trim() || editName.value.trim() === playlist.value.name) {
    renamingName.value = false;
    return;
  }
  savingName.value = true;
  try {
    const updated = await api.updatePlaylist(playlist.value._id, { name: editName.value.trim() });
    playlist.value.name = updated.name;
    renamingName.value = false;
  } catch (err) {
    console.error('Failed to rename playlist:', err);
  } finally {
    savingName.value = false;
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
    <div v-if="loading" class="animate-pulse space-y-4">
      <div class="h-8 bg-zinc-800 rounded w-48" />
      <div class="h-4 bg-zinc-800 rounded w-24" />
    </div>

    <template v-else-if="playlist">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-end gap-5 mb-8">
        <!-- Cover mosaic -->
        <div
          v-if="showCoverArt"
          class="shrink-0 w-full aspect-square sm:w-48 sm:h-48 sm:aspect-auto rounded-xl overflow-hidden bg-zinc-800"
        >
          <div
            v-if="mosaicCovers.length"
            class="w-full h-full grid"
            :class="{
              'grid-cols-1': mosaicCols === 1,
              'grid-cols-2': mosaicCols === 2,
              'grid-cols-3': mosaicCols === 3,
            }"
          >
            <div v-for="(cover, i) in mosaicCells" :key="i" class="overflow-hidden bg-zinc-700">
              <img v-if="cover" :src="api.coverUrl(cover)" class="w-full h-full object-cover" alt="" />
            </div>
          </div>
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
            <button
              @click="playAll"
              :disabled="!tracks.length"
              class="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
            >
              <Icon :path="mdiPlay" class="w-4 h-4" />
              Play all
            </button>
            <button
              @click="playShuffle"
              :disabled="!tracks.length"
              class="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
            >
              <Icon :path="mdiShuffle" class="w-4 h-4" />
              Shuffle
            </button>
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
        :show-artist="songsColumns.artist"
        :show-album="songsColumns.album"
        :show-plays="songsColumns.plays"
        hide-controls
        :playlist-id="playlist._id"
        @love-toggled="() => {}"
        @remove-from-playlist="removeTrack"
      />
    </template>

    <!-- Rename modal -->
    <BaseModal :show="renamingName" @close="renamingName = false">
      <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
        <h2 class="text-lg font-bold font-display mb-5">Rename playlist</h2>
        <input
          v-model="editName"
          type="text"
          placeholder="Playlist name"
          class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
          autofocus
          @keydown.enter="saveEditName"
          @keydown.escape="renamingName = false"
        />
        <div class="flex justify-end gap-2 mt-5">
          <button
            @click="renamingName = false"
            class="px-4 py-2 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >Cancel</button>
          <button
            @click="saveEditName"
            :disabled="savingName"
            class="px-4 py-2 text-sm rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <Spinner v-if="savingName" class="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </BaseModal>

    <ConfirmModal
      v-if="confirm"
      :title="confirm.title"
      :message="confirm.message"
      :confirm-label="confirm.confirmLabel"
      :destructive="confirm.destructive"
      @confirm="confirm.onConfirm(); confirm = null"
      @cancel="confirm = null"
    />
  </div>
</template>
