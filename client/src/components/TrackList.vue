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
import { useAccentColor } from '../composables/useAccentColor.js';
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
const { accentColor: albumAccentRgb } = useAccentColor();
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

function currentTrackTint(track) {
  if (!isCurrentTrack(track)) return undefined;

  const rgb = albumAccentRgb.value || accentRgb.value;
  if (!rgb) return undefined;

  return {
    backgroundImage: `linear-gradient(90deg, rgba(${rgb}, 0.28), rgba(${rgb}, 0.14) 32%, rgba(39, 39, 42, 0.88) 78%, rgba(24, 24, 27, 0.96) 100%)`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.05), inset 2px 0 0 rgba(${rgb}, 0.58), inset 10px 0 18px -16px rgba(${rgb}, 0.42)`,
  };
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
          class="group grid grid-cols-[minmax(0,1fr),auto] items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200"
          :class="[
            track.deleted
              ? 'cursor-default opacity-40'
              : 'cursor-pointer hover:bg-zinc-800/55',
            isCurrentTrack(track) ? 'bg-zinc-800/80' : 'bg-zinc-800/35',
            { 'bg-zinc-800/75': menuRowIndex === i && !isCurrentTrack(track) },
            { 'opacity-40': draggable && dragIndex === i },
            { 'drop-above': draggable && dragOverIndex === i && dragIndex !== null && dragIndex > i },
            { 'drop-below': draggable && dragOverIndex === i && dragIndex !== null && dragIndex < i },
          ]"
          :style="{
            ...(draggable ? { '--indicator': `rgb(${accentRgb})` } : {}),
            ...(currentTrackTint(track) ?? {}),
          }"
          :draggable="draggable ? 'true' : 'false'"
          @click="!track.deleted && playTrack(i)"
          @mouseleave="scheduleCloseMenu"
          @dragstart="draggable && onDragStart($event, i)"
          @dragover="draggable && onDragOver($event, i)"
          @dragleave="draggable && onDragLeave($event)"
          @drop="draggable && onDrop($event, i)"
          @dragend="draggable && onDragEnd()"
        >
          <div class="grid min-w-0 items-center gap-3" :class="useTrackNumber ? 'grid-cols-[2.75rem,minmax(0,1fr)]' : 'grid-cols-[minmax(0,1fr)]'">
            <div
              v-if="useTrackNumber"
              class="flex h-10 items-center justify-center border-r border-white/5 pr-3 text-[11px] font-mono tabular-nums tracking-[0.16em]"
              :class="isCurrentTrack(track) ? `text-${accentColor}-300/90` : 'text-zinc-500/75'"
            >
              <span class="track-indicator-shell">
                <Transition name="track-indicator">
                  <span
                    v-if="isCurrentTrack(track) && state.isPlaying && state.repeat === 'one'"
                    key="repeat"
                    class="track-indicator-item animate-pulse"
                  >
                    <Icon :path="mdiRepeatOnce" class="w-3.5 h-3.5" />
                  </span>
                  <span
                    v-else-if="isCurrentTrack(track) && state.isPlaying"
                    key="play"
                    class="track-indicator-item"
                  >
                    <Icon :path="mdiPlay" class="w-3 h-3" />
                  </span>
                  <span v-else-if="track.trackNumber" key="track-number" class="track-indicator-item">{{ track.trackNumber }}</span>
                  <span v-else key="fallback-number" class="track-indicator-item opacity-30">{{ startIndex + i + 1 }}</span>
                </Transition>
              </span>
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
                      <span class="cover-indicator-shell">
                        <Transition name="cover-icon-swap">
                          <span
                            v-if="state.repeat === 'one'"
                            key="cover-repeat"
                            class="cover-indicator-item animate-pulse"
                          >
                            <Icon :path="mdiRepeatOnce" class="w-4 h-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                          </span>
                          <span
                            v-else
                            key="cover-play"
                            class="cover-indicator-item"
                          >
                            <Icon :path="mdiPlay" class="w-4 h-4 drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]" />
                          </span>
                        </Transition>
                      </span>
                    </div>
                  </Transition>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium transition-colors" :class="isCurrentTrack(track) ? 'text-zinc-50' : 'text-zinc-100 group-hover:text-zinc-50'">
                    {{ track.title }}
                  </p>

                  <div class="mt-1 min-w-0 text-xs text-zinc-500 transition-colors" :class="isCurrentTrack(track) ? 'text-zinc-300/75' : ''">
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

      <div class="flex items-center gap-3 shrink-0 sm:min-w-[8.5rem] sm:justify-end">
            <span
              class="hidden w-12 text-right text-[12px] font-medium tabular-nums tracking-[0.08em] sm:inline"
              :class="isCurrentTrack(track) ? 'text-zinc-200/70' : 'text-zinc-500/80'"
            >{{ formatTime(track.duration) }}</span>
            <div
              v-if="!track.deleted"
              class="flex items-center gap-1.5 text-zinc-500/70 transition-colors duration-200"
              :class="{
                'text-zinc-300': menuRowIndex === i || isCurrentTrack(track),
                'sm:group-hover:text-zinc-300': true,
              }"
            >
              <TransportButton
                size="sm"
                :icon="track.isLoved ? mdiHeart : mdiHeartOutline"
                :label="track.isLoved ? 'Unlove track' : 'Love track'"
                :active="track.isLoved"
                :active-style="{ color: '#fb7185' }"
                active-class="text-rose-400 hover:text-rose-300"
                @click.stop="toggleLove(track)"
              />
              <TransportButton
                size="sm"
                :icon="mdiDotsVertical"
                label="Track actions"
                @click.stop="openMenu($event, i, track)"
              />
            </div>
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
.track-indicator-shell {
  position: relative;
  display: inline-grid;
  width: 2rem;
  height: 1rem;
  place-items: center;
}
.track-indicator-item {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.cover-indicator-shell {
  position: relative;
  display: inline-grid;
  width: 1.25rem;
  height: 1.25rem;
  place-items: center;
}
.cover-indicator-item {
  position: absolute;
  inset: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cover-indicator-enter-active,
.cover-indicator-leave-active,
.track-indicator-enter-active,
.track-indicator-leave-active {
  transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1), transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.cover-icon-swap-enter-active,
.cover-icon-swap-leave-active {
  transition: opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
}

.cover-indicator-enter-from,
.cover-indicator-leave-to,
.track-indicator-enter-from,
.track-indicator-leave-to {
  opacity: 0;
}

.cover-icon-swap-enter-from,
.cover-icon-swap-leave-to {
  opacity: 0;
}

.cover-indicator-enter-from,
.cover-indicator-leave-to {
  transform: scale(0.92);
}

.track-indicator-enter-from,
.track-indicator-leave-to {
  transform: none;
}

.track-indicator-leave-active {
  pointer-events: none;
}

.cover-icon-swap-leave-active {
  pointer-events: none;
}

.track-indicator-leave-to {
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .cover-indicator-enter-active,
  .cover-indicator-leave-active,
  .track-indicator-enter-active,
  .track-indicator-leave-active,
  .cover-icon-swap-enter-active,
  .cover-icon-swap-leave-active {
    transition: none;
  }
}
</style>
