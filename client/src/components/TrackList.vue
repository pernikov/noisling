<script setup>
import { ref, watch, computed } from 'vue';
import { mdiPlay, mdiShuffle, mdiHeart, mdiHeartOutline, mdiDotsVertical, mdiRepeatOnce, mdiChevronUp, mdiChevronDown } from '@mdi/js';
import Icon from './Icon.vue';
import IconButton from './IconButton.vue';
import TransportButton from './TransportButton.vue';
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
  playTracks: { type: Array, default: null },
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
const { menuTrack, menuStyle, openMenu: _openMenu, closeMenu: _closeMenu, scheduleClose: scheduleCloseMenu, cancelClose: cancelCloseMenu } = useContextMenu({ menuWidth: 196, menuHeight: 208, align: 'left' });

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

const { accentColor, accentRgb } = useTheme();
// When any track's love status changes (from PlayerBar or another TrackList instance),
// keep the matching track object in this list in sync.
watch(() => state.loveToggled, (change) => {
  if (!change) return;
  const match = props.tracks.find(t => t._id === change.id);
  if (match) match.isLoved = change.isLoved;
});

watch(() => state.playReportCount, (count) => {
  if (!count) return;
  const reportedId = state.lastReportedTrackId?.toString?.() ?? state.lastReportedTrackId;
  if (!reportedId) return;

  const match = props.tracks.find((track) => {
    const trackId = track._id?.toString?.() ?? track._id;
    return trackId === reportedId;
  });

  if (!match) return;

  const playedAt = new Date().toISOString();
  match.playCount = (match.playCount || 0) + 1;
  match.lastPlayedAt = playedAt;
  match.playedAt = playedAt;
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
  const sourceTracks = Array.isArray(props.playTracks) && props.playTracks.length ? props.playTracks : props.tracks;
  const sourceTrack = sourceTracks[index];
  if (!sourceTrack) return;

  if (queueMatches(sourceTracks)) {
    const queueIdx = state.shuffle
      ? state.queue.findIndex(t => t._id === sourceTrack._id)
      : index;
    playFromQueue(queueIdx);
  } else {
    playAlbum(sourceTracks, index);
  }
}

function playAll() {
  const sourceTracks = Array.isArray(props.playTracks) && props.playTracks.length ? props.playTracks : props.tracks;
  _playAll(sourceTracks, props.getAllTracks);
}
function playShuffle() {
  const sourceTracks = Array.isArray(props.playTracks) && props.playTracks.length ? props.playTracks : props.tracks;
  _playShuffled(sourceTracks, props.getAllTracks);
}


function isCurrentTrack(track) {
  return state.currentTrack?._id === track._id;
}

function isPlayingTrack(track) {
  return isCurrentTrack(track) && state.isPlaying;
}

function mobileMeta(track) {
  const bits = [];
  if (showArtistValue.value && track.artists?.length) bits.push(track.artists.join(', '));
  if (showAlbumValue.value && track.album) bits.push(track.album);
  if (showPlaysValue.value) bits.push(`${track.playCount || 0} play${(track.playCount || 0) === 1 ? '' : 's'}`);
  if (showLastPlayedValue.value && (track.playedAt ?? track.lastPlayedAt)) bits.push(timeAgo(track.playedAt ?? track.lastPlayedAt));
  return bits.join(' · ');
}

const showArtistValue = computed(() => props.showArtist);
const showAlbumValue = computed(() => props.showAlbum);
const showPlaysValue = computed(() => props.showPlays);
const showLastPlayedValue = computed(() => props.showLastPlayed);

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

  if (track.cover) {
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

    <div class="space-y-2">
        <div
          v-for="(track, i) in tracks"
          :key="track.historyId ?? track._id"
          class="group grid grid-cols-[minmax(0,1fr),auto] items-center gap-4 rounded-lg px-3 py-3 transition-all"
          :class="[
            track.deleted
              ? 'cursor-default opacity-40'
              : 'cursor-pointer hover:bg-zinc-800/55',
            isCurrentTrack(track) ? 'bg-zinc-800/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]' : 'bg-zinc-800/35',
            { 'bg-zinc-800/75': menuRowIndex === i },
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
          <div class="grid min-w-0 items-center gap-3" :class="useTrackNumber ? 'grid-cols-[2rem,minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]'">
            <div
              v-if="useTrackNumber"
              class="text-center text-xs tabular-nums"
              :class="isCurrentTrack(track) ? `text-${accentColor}-400` : 'text-zinc-500'"
            >
              <Transition name="track-indicator" mode="out-in">
                <span
                  v-if="isCurrentTrack(track) && state.isPlaying && state.repeat === 'one'"
                  key="repeat"
                  class="flex items-center justify-center animate-pulse"
                >
                  <Icon :path="mdiRepeatOnce" class="w-3.5 h-3.5" />
                </span>
                <span
                  v-else-if="isCurrentTrack(track) && state.isPlaying"
                  key="play"
                  class="flex items-center justify-center"
                >
                  <Icon :path="mdiPlay" class="w-3 h-3" />
                </span>
                <span v-else-if="track.trackNumber" key="track-number">{{ track.trackNumber }}</span>
                <span v-else key="fallback-number" class="opacity-30">{{ startIndex + i + 1 }}</span>
              </Transition>
            </div>

            <div class="min-w-0">
              <div class="flex items-center gap-3 min-w-0">
                <div v-if="showCover" class="relative shrink-0">
                  <CoverArt
                    :cover="track.deleted ? '' : track.cover"
                    size="w-10 h-10 shrink-0"
                    :class="isPlayingTrack(track) && !useTrackNumber ? 'opacity-45' : ''"
                  />
                  <Transition name="cover-indicator">
                    <div
                      v-if="isPlayingTrack(track) && !useTrackNumber"
                      class="absolute inset-0 flex items-center justify-center"
                      :class="`text-${accentColor}-100`"
                    >
                      <Icon :path="state.repeat === 'one' ? mdiRepeatOnce : mdiPlay" class="w-4 h-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                    </div>
                  </Transition>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium" :class="isCurrentTrack(track) ? `text-${accentColor}-400` : 'text-zinc-100'">
                    {{ track.title }}
                  </p>

                  <div class="mt-1 min-w-0 text-xs text-zinc-500">
                    <div class="flex min-w-0 items-center gap-x-1 whitespace-nowrap overflow-hidden sm:hidden">
                      <template v-if="showArtist || showAlbum">
                        <div v-if="showArtist" class="truncate text-zinc-400">
                          <template v-for="(artist, ai) in track.artists" :key="ai">
                            <span v-if="ai > 0">, </span>
                            <router-link
                              :to="{ name: 'artist', params: { name: artist } }"
                              class="hover:text-zinc-100 hover:underline"
                              @click.stop
                            >{{ artist }}</router-link>
                          </template>
                        </div>

                        <router-link
                          v-if="showAlbum && !showArtist"
                          :to="{ name: 'album', params: { artist: track.artists[0], album: track.album } }"
                          class="truncate text-zinc-400 hover:text-zinc-100 hover:underline"
                          @click.stop
                        >{{ track.album }}</router-link>
                      </template>

                      <template v-else>
                        <span v-if="showPlays" class="shrink-0">{{ track.playCount || 0 }} play{{ (track.playCount || 0) === 1 ? '' : 's' }}</span>
                        <span
                          v-if="showPlays && showLastPlayed && (track.playedAt ?? track.lastPlayedAt)"
                          class="shrink-0 px-0.5 text-white/10"
                          aria-hidden="true"
                        >•</span>
                        <span v-if="showLastPlayed && (track.playedAt ?? track.lastPlayedAt)" class="shrink-0">
                          Last played {{ timeAgo(track.playedAt ?? track.lastPlayedAt) }}
                        </span>
                      </template>
                    </div>

                    <div class="hidden min-w-0 overflow-hidden sm:block">
                      <div class="inline-flex max-w-full items-center gap-x-1 whitespace-nowrap align-top">
                      <div v-if="showArtist" class="shrink-0 text-zinc-400">
                        <template v-for="(artist, ai) in track.artists" :key="ai">
                          <span v-if="ai > 0">, </span>
                          <router-link
                          :to="{ name: 'artist', params: { name: artist } }"
                          class="hover:text-zinc-100 hover:underline"
                          @click.stop
                        >{{ artist }}</router-link>
                      </template>
                      </div>

                      <span
                        v-if="showArtist && showAlbum"
                        class="shrink-0 px-0.5 text-white/10"
                        aria-hidden="true"
                      >•</span>
                      <router-link
                        v-if="showAlbum"
                        :to="{ name: 'album', params: { artist: track.artists[0], album: track.album } }"
                        class="shrink-0 text-zinc-400 hover:text-zinc-100 hover:underline"
                        @click.stop
                      >{{ track.album }}</router-link>

                      <span
                        v-if="showPlays && (showArtist || showAlbum)"
                        class="shrink-0 px-0.5 text-white/10"
                        aria-hidden="true"
                      >•</span>
                      <span v-if="showPlays" class="shrink-0">{{ track.playCount || 0 }} play{{ (track.playCount || 0) === 1 ? '' : 's' }}</span>

                      <span
                        v-if="showLastPlayed && (track.playedAt ?? track.lastPlayedAt) && (showArtist || showAlbum || showPlays)"
                        class="shrink-0 px-0.5 text-white/10"
                        aria-hidden="true"
                      >•</span>
                      <span v-if="showLastPlayed && (track.playedAt ?? track.lastPlayedAt)" class="shrink-0">
                        Last played {{ timeAgo(track.playedAt ?? track.lastPlayedAt) }}
                      </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0">
            <span
              class="hidden pr-1 text-sm tabular-nums sm:inline"
              :class="menuRowIndex === i ? 'hidden' : 'text-zinc-500'"
            >{{ formatTime(track.duration) }}</span>
            <TransportButton
              v-if="!track.deleted"
              size="sm"
              :icon="track.isLoved ? mdiHeart : mdiHeartOutline"
              :label="track.isLoved ? 'Unlove track' : 'Love track'"
              :active="track.isLoved"
              :active-style="{ color: '#fb7185' }"
              active-class="text-rose-400 hover:text-rose-300"
              @click.stop="toggleLove(track)"
            />
            <TransportButton
              v-if="!track.deleted"
              size="sm"
              :icon="mdiDotsVertical"
              label="Track actions"
              @click.stop="openMenu($event, i, track)"
            />
          </div>
        </div>
      </div>
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
.drop-above {
  box-shadow: inset 0 2px 0 var(--indicator);
}
.drop-below {
  box-shadow: inset 0 -2px 0 var(--indicator);
}
.cover-indicator-enter-active,
.cover-indicator-leave-active,
.track-indicator-enter-active,
.track-indicator-leave-active {
  transition: opacity 180ms ease, transform 180ms ease;
}

.cover-indicator-enter-from,
.cover-indicator-leave-to,
.track-indicator-enter-from,
.track-indicator-leave-to {
  opacity: 0;
}

.cover-indicator-enter-from,
.cover-indicator-leave-to {
  transform: scale(0.92);
}

.track-indicator-enter-from,
.track-indicator-leave-to {
  transform: translateY(2px);
}
@media (prefers-reduced-motion: reduce) {
  .cover-indicator-enter-active,
  .cover-indicator-leave-active,
  .track-indicator-enter-active,
  .track-indicator-leave-active {
    transition: none;
  }
}
</style>
