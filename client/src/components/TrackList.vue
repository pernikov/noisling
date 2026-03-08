<script setup>
import { ref, watch, computed, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { mdiPlay, mdiShuffle, mdiHeart, mdiHeartOutline, mdiDotsVertical, mdiPlaylistPlay, mdiPlaylistPlus, mdiPlaylistMinus, mdiCheck, mdiRepeatOnce, mdiChevronUp, mdiChevronDown } from '@mdi/js';
import Icon from './Icon.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { useAccentColor } from '../composables/useAccentColor.js';
import { useApi } from '../composables/useApi.js';
import CoverArt from './CoverArt.vue';
import AddToPlaylistModal from './AddToPlaylistModal.vue';

const router = useRouter();
const api = useApi();

const props = defineProps({
  tracks: { type: Array, required: true },
  showCover: { type: Boolean, default: false },
  showArtist: { type: Boolean, default: false },
  showAlbum: { type: Boolean, default: false },
  showPlays: { type: Boolean, default: false },
  showLastPlayed: { type: Boolean, default: false },
  startIndex: { type: Number, default: 0 },
  getAllTracks: { type: Function, default: null }, // () => Promise<Track[]> for full library play/shuffle
  hideControls: { type: Boolean, default: false },
  useTrackNumber: { type: Boolean, default: false },
  sortable: { type: Boolean, default: false },
  sortBy: { type: String, default: '' },
  sortDir: { type: String, default: 'asc' },
  playlistId: { type: String, default: null }, // if set, shows "Remove from playlist" in menu
});

const emit = defineEmits(['love-toggled', 'sort', 'remove-from-playlist']);

function handleSort(field) {
  if (props.sortBy === field && props.sortDir === 'desc') {
    // Third click: reset to default (no explicit sort)
    emit('sort', { field: '', dir: 'asc' });
    return;
  }
  const dir = props.sortBy === field ? 'desc' : 'asc';
  emit('sort', { field, dir });
}

function sortIcon(field) {
  return props.sortBy === field && props.sortDir === 'desc' ? mdiChevronDown : mdiChevronUp;
}

const { state, playAlbum, playFromQueue, queueMatches, addToQueue, playNext } = usePlayer();

const menuTrack = ref(null);
const menuRowIndex = ref(null);
const menuStyle = ref({});

function openMenu(event, index, track) {
  event.stopPropagation();
  if (menuRowIndex.value === index) {
    closeMenu();
    return;
  }
  const rect = event.currentTarget.getBoundingClientRect();
  const MENU_HEIGHT = 96;
  const MENU_WIDTH = 176;
  const top = rect.bottom + 4 + MENU_HEIGHT > window.innerHeight
    ? rect.top - MENU_HEIGHT - 4
    : rect.bottom + 4;
  menuRowIndex.value = index;
  menuTrack.value = track;
  menuStyle.value = {
    top: `${Math.max(0, top)}px`,
    left: `${Math.min(rect.left, window.innerWidth - MENU_WIDTH)}px`,
  };
}

function closeMenu() {
  menuTrack.value = null;
  menuRowIndex.value = null;
}

let menuCloseTimer = null;

function scheduleCloseMenu() {
  menuCloseTimer = setTimeout(() => { menuTrack.value = null; menuRowIndex.value = null; }, 120);
}

function cancelCloseMenu() {
  clearTimeout(menuCloseTimer);
}

onBeforeUnmount(() => {
  clearTimeout(menuCloseTimer);
  clearTimeout(toastTimer);
});

const toastMessage = ref('');
const toastVisible = ref(false);
let toastTimer = null;

function showToast(message) {
  toastMessage.value = message;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, 2000);
}
const { accentColor, density, showCoverArt, lovedUseAccent, showPlaylists } = useTheme();
const rowPy = computed(() => density.value === 'compact' ? 'py-1' : 'py-2');
const { accentColor: albumAccentColor } = useAccentColor();
const toastStyle = computed(() => {
  if (!albumAccentColor.value) return {};
  return {
    background: `linear-gradient(to right, rgba(${albumAccentColor.value}, 0.35), rgba(${albumAccentColor.value}, 0.15) 60%, transparent)`,
  };
});

// When the current track's isLoved is toggled from the player bar,
// keep the matching track object in props.tracks in sync.
watch(() => state.currentTrack?.isLoved, (isLoved) => {
  if (!state.currentTrack) return;
  const match = props.tracks.find(t => t._id === state.currentTrack._id);
  if (match) match.isLoved = isLoved;
});

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function playTrack(index) {
  if (queueMatches(props.tracks)) {
    const queueIdx = state.shuffle
      ? state.queue.findIndex(t => t._id === props.tracks[index]._id)
      : index;
    playFromQueue(queueIdx);
  } else {
    playAlbum(props.tracks, index);
  }
}

function playAll() {
  // Start playback synchronously so iOS autoplay policy is satisfied.
  // If getAllTracks is provided, extend the queue after the fetch.
  if (!props.tracks.length) return;
  playAlbum(props.tracks, 0);

  if (props.getAllTracks) {
    props.getAllTracks().then(allTracks => {
      if (allTracks.length > props.tracks.length) {
        const currentId = state.currentTrack?._id;
        const idx = allTracks.findIndex(t => t._id === currentId);
        state.queue = allTracks;
        state.originalQueue = [...allTracks];
        state.queueIndex = idx >= 0 ? idx : 0;
      }
    });
  }
}

function playShuffle() {
  if (!props.tracks.length) return;
  const randomIndex = Math.floor(Math.random() * props.tracks.length);
  state.shuffle = true;
  playAlbum(props.tracks, randomIndex);

  if (props.getAllTracks) {
    props.getAllTracks().then(allTracks => {
      if (allTracks.length > props.tracks.length) {
        const current = state.currentTrack;
        const rest = allTracks.filter(t => t._id !== current?._id);
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        state.queue = current ? [current, ...rest] : rest;
        state.originalQueue = [...allTracks];
        state.queueIndex = 0;
      }
    });
  }
}

async function toggleLove(track) {
  track.isLoved = !track.isLoved;
  if (state.currentTrack?._id === track._id) state.currentTrack.isLoved = track.isLoved;
  try {
    const { isLoved } = await api.toggleLove(track._id);
    track.isLoved = isLoved;
    if (state.currentTrack?._id === track._id) state.currentTrack.isLoved = isLoved;
    emit('love-toggled', { id: track._id, isLoved });
  } catch {
    track.isLoved = !track.isLoved;
    if (state.currentTrack?._id === track._id) state.currentTrack.isLoved = track.isLoved;
  }
}

function isCurrentTrack(track) {
  return state.currentTrack?._id === track._id;
}

// Add to playlist modal
const addToPlaylistTrack = ref(null);

function openAddToPlaylist() {
  addToPlaylistTrack.value = menuTrack.value;
  closeMenu();
}

function onPlaylistAdded(playlistName) {
  if (playlistName) showToast(`Added to "${playlistName}"`);
  else showToast('Failed to add to playlist');
}

defineExpose({ playAll, playShuffle });
</script>

<template>
  <div class="w-full">
    <!-- Play all / Shuffle buttons -->
    <div v-if="!hideControls" class="flex items-center gap-2 mb-3 justify-end">
      <button
        class="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
        @click="playAll"
      >
        <Icon :path="mdiPlay" class="w-4 h-4" />
        Play All
      </button>
      <button
        class="flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
        @click="playShuffle"
      >
        <Icon :path="mdiShuffle" class="w-4 h-4" />
        Shuffle
      </button>
    </div>

    <table class="w-full table-fixed text-sm border-separate border-spacing-0">
      <thead>
        <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800 select-none">
          <th class="text-center py-2 px-1 w-8">#</th>
          <th
            class="text-left py-2 px-3"
            :class="{ 'cursor-pointer hover:text-zinc-300': sortable }"
            @click="sortable && handleSort('title')"
          >
            <span class="inline-flex items-center gap-0.5">
              Title
              <Icon v-if="sortable" :path="sortIcon('title')" class="w-3 h-3 transition-opacity" :class="sortBy === 'title' ? 'opacity-70' : 'opacity-0'" />
            </span>
          </th>
          <th
            v-if="showArtist"
            class="text-left py-2 px-3 w-1/4 hidden sm:table-cell"
            :class="{ 'cursor-pointer hover:text-zinc-300': sortable }"
            @click="sortable && handleSort('artist')"
          >
            <span class="inline-flex items-center gap-0.5">
              Artist
              <Icon v-if="sortable" :path="sortIcon('artist')" class="w-3 h-3 transition-opacity" :class="sortBy === 'artist' ? 'opacity-70' : 'opacity-0'" />
            </span>
          </th>
          <th
            v-if="showAlbum"
            class="text-left py-2 px-3 w-1/4 hidden md:table-cell"
            :class="{ 'cursor-pointer hover:text-zinc-300': sortable }"
            @click="sortable && handleSort('album')"
          >
            <span class="inline-flex items-center gap-0.5">
              Album
              <Icon v-if="sortable" :path="sortIcon('album')" class="w-3 h-3 transition-opacity" :class="sortBy === 'album' ? 'opacity-70' : 'opacity-0'" />
            </span>
          </th>
          <th
            v-if="showPlays"
            class="text-center py-2 px-3 w-16 hidden sm:table-cell"
            :class="{ 'cursor-pointer hover:text-zinc-300': sortable }"
            @click="sortable && handleSort('plays')"
          >
            <span class="inline-flex items-center justify-center gap-0.5">
              Plays
              <Icon v-if="sortable" :path="sortIcon('plays')" class="w-3 h-3 transition-opacity" :class="sortBy === 'plays' ? 'opacity-70' : 'opacity-0'" />
            </span>
          </th>
          <th
            v-if="showLastPlayed"
            class="text-center py-2 px-3 w-24 hidden sm:table-cell"
            :class="{ 'cursor-pointer hover:text-zinc-300': sortable }"
            @click="sortable && handleSort('lastPlayed')"
          >
            <span class="inline-flex items-center justify-center gap-0.5">
              Played
              <Icon v-if="sortable" :path="sortIcon('lastPlayed')" class="w-3 h-3 transition-opacity" :class="sortBy === 'lastPlayed' ? 'opacity-70' : 'opacity-0'" />
            </span>
          </th>
          <th class="w-8"></th>
          <th
            class="text-right py-2 px-3 w-16"
            :class="{ 'cursor-pointer hover:text-zinc-300': sortable }"
            @click="sortable && handleSort('duration')"
          >
            <span class="inline-flex items-center justify-end gap-0.5">
              <Icon v-if="sortable" :path="sortIcon('duration')" class="w-3 h-3 transition-opacity" :class="sortBy === 'duration' ? 'opacity-70' : 'opacity-0'" />
              Time
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(track, i) in tracks"
          :key="track.historyId ?? track._id"
          class="group [&>td]:transition-colors [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md [&:first-child>td:first-child]:rounded-tl-none [&:first-child>td:last-child]:rounded-tr-none"
          :class="[
            track.deleted
              ? 'cursor-default opacity-40'
              : 'cursor-pointer [&:hover>td]:bg-zinc-800/50',
            { [`text-${accentColor}-400`]: isCurrentTrack(track) },
            { '[&>td]:bg-zinc-800/50': menuRowIndex === i },
          ]"
          @click="!track.deleted && playTrack(i)"
          @mouseleave="scheduleCloseMenu"
        >
          <td :class="[rowPy, 'px-1 text-zinc-500 text-center']">
            <span v-if="isCurrentTrack(track) && state.isPlaying && state.repeat === 'one'" class="flex items-center justify-center animate-pulse" :class="`text-${accentColor}-400`">
              <Icon :path="mdiRepeatOnce" class="w-3.5 h-3.5" />
            </span>
            <span v-else-if="isCurrentTrack(track) && state.isPlaying" class="flex items-center justify-center" :class="`text-${accentColor}-400`">
              <Icon :path="mdiPlay" class="w-3 h-3" />
            </span>
            <template v-else-if="useTrackNumber">
              <span v-if="track.trackNumber">{{ track.trackNumber }}</span>
              <span v-else class="opacity-30">{{ startIndex + i + 1 }}</span>
            </template>
            <span v-else>{{ startIndex + i + 1 }}</span>
          </td>
          <td :class="[rowPy, 'px-3 font-medium overflow-hidden']">
            <div class="flex items-center gap-2 min-w-0">
              <CoverArt v-if="showCover && showCoverArt" :cover="track.deleted ? '' : track.cover" :size="density === 'compact' ? 'w-6 h-6 shrink-0' : 'w-8 h-8 shrink-0'" />
              <span class="truncate">{{ track.title }}</span>
            </div>
          </td>
          <td v-if="showArtist" :class="[rowPy, 'px-3 text-zinc-400 hidden sm:table-cell overflow-hidden']">
            <div class="truncate">
              <template v-for="(artist, ai) in track.artists" :key="ai">
                <span v-if="ai > 0">, </span>
                <router-link
                  :to="{ name: 'artist', params: { name: artist } }"
                  class="hover:text-zinc-100 hover:underline"
                  @click.stop
                >{{ artist }}</router-link>
              </template>
            </div>
          </td>
          <td v-if="showAlbum" :class="[rowPy, 'px-3 text-zinc-400 hidden md:table-cell overflow-hidden']">
            <router-link
              :to="{ name: 'album', params: { artist: track.artists[0], album: track.album } }"
              class="hover:text-zinc-100 hover:underline truncate block"
              @click.stop
            >{{ track.album }}</router-link>
          </td>
          <td v-if="showPlays" :class="[rowPy, 'px-3 text-center text-zinc-500 hidden sm:table-cell']">{{ track.playCount || 0 }}</td>
          <td v-if="showLastPlayed" :class="[rowPy, 'px-3 text-center text-zinc-500 hidden sm:table-cell']">{{ (track.playedAt ?? track.lastPlayedAt) ? timeAgo(track.playedAt ?? track.lastPlayedAt) : '' }}</td>
          <td :class="[rowPy, 'px-1 align-middle']">
            <button
              v-if="!track.deleted"
              class="flex items-center justify-center w-full transition-opacity"
              :class="track.isLoved
                ? (lovedUseAccent ? `text-${accentColor}-400` : 'text-rose-400')
                : 'opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-zinc-400'"
              @click.stop="toggleLove(track)"
            >
              <Icon :path="track.isLoved ? mdiHeart : mdiHeartOutline" class="w-3.5 h-3.5" />
            </button>
          </td>
          <td :class="[rowPy, 'px-3 text-right text-zinc-500']">
            <span :class="menuRowIndex === i ? 'hidden' : 'group-hover:hidden sm:block hidden'" class="tabular-nums">{{ formatDuration(track.duration) }}</span>
            <button
              v-if="!track.deleted"
              :class="menuRowIndex === i ? 'flex' : 'flex sm:hidden sm:group-hover:flex'"
              class="items-center justify-end w-full text-zinc-500 hover:text-zinc-300"
              @click.stop="openMenu($event, i, track)"
            >
              <Icon :path="mdiDotsVertical" class="w-3.5 h-3.5" />
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <Teleport to="body">
    <Transition name="menu">
      <div
        v-if="menuTrack"
        class="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 min-w-[160px]"
        :style="menuStyle"
        @mouseenter="cancelCloseMenu"
        @mouseleave="closeMenu"
      >
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="playNext(menuTrack); showToast('Playing next'); closeMenu()"
        >
          <Icon :path="mdiPlaylistPlay" class="w-4 h-4 text-zinc-400" />
          Play next
        </button>
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="addToQueue(menuTrack); showToast('Added to queue'); closeMenu()"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to queue
        </button>
        <!-- Add to playlist -->
        <button
          v-if="showPlaylists"
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="openAddToPlaylist"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to playlist
        </button>
        <!-- Remove from playlist (only when inside a playlist view) -->
        <button
          v-if="playlistId"
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
          @click="emit('remove-from-playlist', menuTrack._id); closeMenu()"
        >
          <Icon :path="mdiPlaylistMinus" class="w-4 h-4" />
          Remove from playlist
        </button>
      </div>
    </Transition>

    <Transition name="toast">
      <div
        v-if="toastVisible"
        class="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-full text-sm shadow-lg whitespace-nowrap"
        :style="toastStyle"
      >
        <Icon :path="mdiCheck" class="w-4 h-4 text-green-400 shrink-0" />
        {{ toastMessage }}
      </div>
    </Transition>

    <AddToPlaylistModal
      v-if="addToPlaylistTrack"
      :track="addToPlaylistTrack"
      @close="addToPlaylistTrack = null"
      @added="onPlaylistAdded"
    />
  </Teleport>
</template>

<style scoped>
.menu-enter-active, .menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top left;
}
.menu-enter-from, .menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

.toast-enter-active, .toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}
.toast-enter-to, .toast-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
