<script setup>
import { ref, watch, computed } from 'vue';
import { mdiPlay, mdiShuffle, mdiHeart, mdiHeartOutline, mdiDotsVertical, mdiRepeatOnce, mdiChevronUp, mdiChevronDown } from '@mdi/js';
import Icon from './Icon.vue';
import IconButton from './IconButton.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { useApi } from '../composables/useApi.js';
import { useContextMenu } from '../composables/useContextMenu.js';
import { formatTime } from '../composables/useProgressScrub.js';
import CoverArt from './CoverArt.vue';
import TrackContextMenu from './TrackContextMenu.vue';

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
  draggable: { type: Boolean, default: false },
});

const emit = defineEmits(['sort', 'remove-from-playlist', 'reorder', 'track-updated']);

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

const { state, playAlbum, playAll: _playAll, playShuffled: _playShuffled, playFromQueue, queueMatches, toggleLove } = usePlayer();

const menuRowIndex = ref(null);
const { menuTrack, menuStyle, openMenu: _openMenu, closeMenu: _closeMenu, scheduleClose: scheduleCloseMenu, cancelClose: cancelCloseMenu } = useContextMenu({ menuWidth: 176, menuHeight: 208, align: 'left' });

// Keep menuRowIndex in sync with the composable's menuTrack
watch(menuTrack, (val) => { if (!val) menuRowIndex.value = null; });

function openMenu(event, index, track) {
  if (menuRowIndex.value === index) { _closeMenu(); return; }
  menuRowIndex.value = index;
  _openMenu(event, track);
}

function closeMenu() {
  _closeMenu();
}

function onMenuTrackUpdated(updatedTrack) {
  const match = props.tracks.find((track) => track._id === updatedTrack?._id);
  if (match) Object.assign(match, updatedTrack);
  emit('track-updated', updatedTrack);
}

const { accentColor, accentRgb, density, showCoverArt, lovedUseAccent } = useTheme();
const rowPy = computed(() => density.value === 'compact' ? 'py-1' : 'py-2');

// When any track's love status changes (from PlayerBar or another TrackList instance),
// keep the matching track object in this list in sync.
watch(() => state.loveToggled, (change) => {
  if (!change) return;
  const match = props.tracks.find(t => t._id === change.id);
  if (match) match.isLoved = change.isLoved;
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

function playAll() { _playAll(props.tracks, props.getAllTracks); }
function playShuffle() { _playShuffled(props.tracks, props.getAllTracks); }


function isCurrentTrack(track) {
  return state.currentTrack?._id === track._id;
}

// --- Drag and drop reordering (playlist mode) ---
const dragIndex = ref(null);
const dragOverIndex = ref(null);
let ghostEl = null;

function onDragStart(e, index) {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  const row = e.currentTarget;
  const rowH = row.offsetHeight;
  const track = props.tracks[index];

  ghostEl = document.createElement('div');
  Object.assign(ghostEl.style, {
    position: 'fixed', top: '-9999px', left: '0',
    width: '260px', height: rowH + 'px',
    background: 'rgb(39 39 42 / 0.97)',
    border: '1px solid rgb(63 63 70 / 0.8)',
    borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    pointerEvents: 'none', overflow: 'hidden',
    display: 'flex', alignItems: 'center',
    gap: '8px', padding: '0 12px',
    fontSize: '14px', fontWeight: '500', color: '#e4e4e7',
  });

  if (showCoverArt.value && track.cover) {
    const imgSize = rowH - 16;
    const img = document.createElement('img');
    img.src = api.coverUrl(track.cover);
    Object.assign(img.style, {
      width: imgSize + 'px', height: imgSize + 'px',
      borderRadius: '4px', objectFit: 'cover', flexShrink: '0',
    });
    ghostEl.appendChild(img);
  }

  const titleEl = document.createElement('span');
  titleEl.textContent = track.title;
  Object.assign(titleEl.style, { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
  ghostEl.appendChild(titleEl);

  document.body.appendChild(ghostEl);
  e.dataTransfer.setDragImage(ghostEl, 130, rowH / 2);
  requestAnimationFrame(() => {
    if (ghostEl) { document.body.removeChild(ghostEl); ghostEl = null; }
  });
}

function onDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  dragOverIndex.value = index;
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    dragOverIndex.value = null;
  }
}

function onDrop(e, toIndex) {
  e.preventDefault();
  const fromIndex = dragIndex.value;
  if (fromIndex !== null && fromIndex !== toIndex) {
    const reordered = [...props.tracks];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    emit('reorder', reordered);
  }
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
  if (ghostEl) { document.body.removeChild(ghostEl); ghostEl = null; }
}


defineExpose({ playAll, playShuffle });
</script>

<template>
  <div class="w-full">
    <!-- Play all / Shuffle buttons -->
    <div v-if="!hideControls" class="flex items-center gap-2 mb-3 justify-end">
      <IconButton :icon="mdiPlay" label="Play All" @click="playAll" />
      <IconButton :icon="mdiShuffle" label="Shuffle" @click="playShuffle" />
    </div>

    <table class="w-full table-fixed text-sm border-separate border-spacing-0">
      <thead>
        <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800 select-none">
          <th class="text-center py-2 px-1 w-8 hidden sm:table-cell">#</th>
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
              <span class="hidden sm:inline">Time</span>
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
            { 'max-sm:[&>td]:bg-zinc-800/50': isCurrentTrack(track) },
            { '[&>td]:bg-zinc-800/50': menuRowIndex === i },
            { 'opacity-40': draggable && dragIndex === i },
            { 'drop-above': draggable && dragOverIndex === i && dragIndex !== null && dragIndex > i },
            { 'drop-below': draggable && dragOverIndex === i && dragIndex !== null && dragIndex < i },
          ]"
          :style="draggable ? { '--indicator': `rgb(${accentRgb})` } : {}"
          :draggable="draggable ? 'true' : 'false'"
          @click="!track.deleted && playTrack(i)"
          @mouseleave="scheduleCloseMenu"
          @dragstart="draggable && onDragStart($event, i)"
          @dragover="draggable && onDragOver($event, i)"
          @dragleave="draggable && onDragLeave($event)"
          @drop="draggable && onDrop($event, i)"
          @dragend="draggable && onDragEnd()"
        >
          <td :class="[rowPy, 'px-1 text-zinc-500 text-center hidden sm:table-cell']">
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
          <td :class="[rowPy, 'px-3 font-medium overflow-hidden max-sm:rounded-l-md']">
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
            <span :class="menuRowIndex === i ? 'hidden' : 'group-hover:hidden sm:block hidden'" class="tabular-nums">{{ formatTime(track.duration) }}</span>
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

  <TrackContextMenu
    :track="menuTrack"
    :style="menuStyle"
    :playlist-id="playlistId"
    @close="closeMenu"
    @cancel-close="cancelCloseMenu"
    @track-updated="onMenuTrackUpdated"
    @remove-from-playlist="emit('remove-from-playlist', $event); closeMenu()"
  />
</template>

<style scoped>
.drop-above > td {
  box-shadow: inset 0 2px 0 var(--indicator);
}
.drop-below > td {
  box-shadow: inset 0 -2px 0 var(--indicator);
}
</style>
