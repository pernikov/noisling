<script setup>
import { ref, watch, computed, TransitionGroup, onUnmounted } from 'vue';
import { mdiPlay, mdiShuffle, mdiHeart, mdiHeartOutline, mdiDotsVertical, mdiRepeatOnce, mdiChevronUp, mdiChevronDown, mdiCheck, mdiDragVertical } from '@mdi/js';
import Icon from './Icon.vue';
import IconButton from './IconButton.vue';
import TransportButton from './TransportButton.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { useApi } from '../composables/useApi.js';
import { useContextMenu } from '../composables/useContextMenu.js';
import { useAccentColor } from '../composables/useAccentColor.js';
import { formatTime } from '../composables/useProgressScrub.js';
import { findScrollTarget, useDragAutoScroll } from '../composables/useDragAutoScroll.js';
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
  animateList: { type: Boolean, default: false },
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
  if (!isPendingRecentTrack(match)) {
    match.playCount = (match.playCount || 0) + 1;
  }
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

function clampProgress(progress) {
  return Math.max(0, Math.min(1, Number(progress) || 0));
}

function pendingRecentPhase(track) {
  return track?._pendingRecentPhase ?? '';
}

function isPendingRecentTrack(track) {
  return ['counting', 'completed', 'fading'].includes(pendingRecentPhase(track));
}

function isPrimaryPendingRecentTrack(track, index) {
  return index === 0 && isPendingRecentTrack(track);
}

function pendingRecentStatus(track) {
  const phase = pendingRecentPhase(track);
  if (!phase) return '';
  if (phase === 'completed' || phase === 'fading') return 'Played';

  const duration = Number(track?.duration) || Number(state.duration) || 0;
  const threshold = duration > 0 ? Math.min(duration * 0.5, 240) : 0;
  if (threshold <= 0) return 'Marking played';

  const isCurrentPendingTrack = state.currentTrack?._id === track?._id;
  const progress = isCurrentPendingTrack ? clampProgress(state.currentTrackPlayProgress) : 0;
  const remaining = Math.max(0, threshold * (1 - progress));
  return `Counts in ${formatTime(remaining)}`;
}

function pendingRecentProgress(track) {
  const phase = pendingRecentPhase(track);
  if (!phase) return 0;
  if (phase !== 'counting') return 100;
  if (state.currentTrack?._id !== track?._id) return 0;
  return clampProgress(state.currentTrackPlayProgress) * 100;
}

function pendingBadgeWidth(track) {
  const phase = pendingRecentPhase(track);
  if (!phase) return undefined;
  if (phase === 'completed' || phase === 'fading') return '2rem';
  const label = pendingRecentStatus(track);
  return `${Math.max(5.75, Math.min(9.5, label.length * 0.42 + 2.4))}rem`;
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

function onTrackRowKeydown(event, index, track) {
  if (track.deleted) return;
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  playTrack(index);
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
const listContainerTag = computed(() => (props.animateList ? TransitionGroup : 'div'));
const listContainerProps = computed(() => (props.animateList ? { name: 'track-list-item', tag: 'div' } : {}));
const rowElements = ref([]);

function setRowRef(index, element) {
  if (element) rowElements.value[index] = element;
  else rowElements.value[index] = undefined;
}

// --- Drag and drop reordering (playlist mode) ---
const dragIndex = ref(null);
const dragOverIndex = ref(null);
let ghostEl = null;
let touchDragIndex = null;
let touchClientY = null;
const { start: startAutoScroll, update: updateAutoScroll, stop: stopAutoScroll } = useDragAutoScroll({
  onStop: clearDragState,
  onScroll: updateTouchDragOverIndex,
});

function clearDragState() {
  dragIndex.value = null;
  dragOverIndex.value = null;
  touchDragIndex = null;
  touchClientY = null;
  if (ghostEl) {
    document.body.removeChild(ghostEl);
    ghostEl = null;
  }
}

function onDragStart(e, index) {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  const row = e.currentTarget;
  const rowH = row.offsetHeight;
  const track = props.tracks[index];
  startAutoScroll(findScrollTarget(row), e.clientY);

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
  updateAutoScroll(e.clientY);
}

function onDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    dragOverIndex.value = null;
  }
}

function onDrop(e, toIndex) {
  e.preventDefault();
  reorderTracks(dragIndex.value, toIndex);
  stopAutoScroll();
}

function onDragEnd() {
  stopAutoScroll();
}

function reorderTracks(fromIndex, toIndex) {
  if (fromIndex === null || toIndex === null || fromIndex === toIndex) return;
  const reordered = [...props.tracks];
  const [moved] = reordered.splice(fromIndex, 1);
  reordered.splice(toIndex, 0, moved);
  emit('reorder', reordered);
}

function updateTouchDragOverIndex(clientY = touchClientY) {
  touchClientY = clientY;
  if (touchDragIndex === null || clientY === null) return;

  const rows = rowElements.value;
  let overIndex = touchDragIndex;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;
    const rect = row.getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) {
      overIndex = i;
      break;
    }
    overIndex = i;
  }

  dragOverIndex.value = Math.max(0, Math.min(props.tracks.length - 1, overIndex));
}

function removeTouchListeners() {
  document.removeEventListener('touchmove', onTouchDragMove);
  document.removeEventListener('touchend', onTouchDragEnd);
  document.removeEventListener('touchcancel', onTouchDragCancel);
}

function onHandleTouchStart(e, index) {
  if (!props.draggable) return;
  e.stopPropagation();
  touchDragIndex = index;
  touchClientY = e.touches[0]?.clientY ?? null;
  dragIndex.value = index;
  dragOverIndex.value = index;
  const row = rowElements.value[index];
  startAutoScroll(findScrollTarget(row || e.currentTarget), touchClientY);
  document.addEventListener('touchmove', onTouchDragMove, { passive: false });
  document.addEventListener('touchend', onTouchDragEnd);
  document.addEventListener('touchcancel', onTouchDragCancel);
}

function onTouchDragMove(e) {
  if (touchDragIndex === null) return;
  e.preventDefault();
  const touch = e.touches[0];
  if (!touch) return;
  updateTouchDragOverIndex(touch.clientY);
  updateAutoScroll(touch.clientY);
}

function onTouchDragEnd() {
  removeTouchListeners();
  reorderTracks(touchDragIndex, dragOverIndex.value);
  stopAutoScroll();
}

function onTouchDragCancel() {
  removeTouchListeners();
  stopAutoScroll();
}

onUnmounted(removeTouchListeners);


defineExpose({ playAll, playShuffle });
</script>

<template>
  <div class="w-full">
    <!-- Play all / Shuffle buttons -->
    <div v-if="!hideControls" class="flex items-center gap-2 mb-3 justify-end">
      <IconButton :icon="mdiPlay" label="Play All" @click="playAll" />
      <IconButton :icon="mdiShuffle" label="Shuffle" @click="playShuffle" />
    </div>

    <component
      :is="listContainerTag"
      v-bind="listContainerProps"
      class="track-list-rows flex flex-col gap-2"
    >
        <div
          v-for="(track, i) in tracks"
          :key="track.historyId ?? track._id"
          :ref="el => setRowRef(i, el)"
            class="group relative grid grid-cols-[minmax(0,1fr),auto] items-center gap-4 rounded-xl px-3 py-3 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            :class="[
              track.deleted
                ? 'cursor-default opacity-40'
                : 'cursor-pointer hover:bg-zinc-800/55',
            isCurrentTrack(track) ? 'bg-zinc-800/80' : (isPrimaryPendingRecentTrack(track, i) ? 'bg-zinc-800/45' : 'bg-zinc-800/35'),
            { 'bg-zinc-800/75': menuRowIndex === i && !isCurrentTrack(track) },
            { 'opacity-40': draggable && dragIndex === i },
            { 'drop-above': draggable && dragOverIndex === i && dragIndex !== null && dragIndex > i },
            { 'drop-below': draggable && dragOverIndex === i && dragIndex !== null && dragIndex < i },
            { 'pending-recent-track': isPrimaryPendingRecentTrack(track, i) },
          ]"
          :style="{
            ...(draggable ? { '--indicator': `rgb(${accentRgb})` } : {}),
            ...(currentTrackTint(track) ?? {}),
            ...(isPrimaryPendingRecentTrack(track, i) ? { '--pending-progress': `${pendingRecentProgress(track)}%` } : {}),
          }"
          :draggable="draggable ? 'true' : 'false'"
          :role="track.deleted ? undefined : 'button'"
          :tabindex="track.deleted ? -1 : 0"
          :aria-label="track.deleted ? undefined : `Play ${track.title}`"
          @click="!track.deleted && playTrack(i)"
          @keydown="onTrackRowKeydown($event, i, track)"
          @mouseleave="scheduleCloseMenu"
          @dragstart="draggable && onDragStart($event, i)"
          @dragover="draggable && onDragOver($event, i)"
          @dragleave="draggable && onDragLeave($event)"
          @drop="draggable && onDrop($event, i)"
          @dragend="draggable && onDragEnd()"
        >
          <template v-if="isPrimaryPendingRecentTrack(track, i)">
            <span class="pending-recent-track__backdrop"></span>
            <span class="pending-recent-track__fill"></span>
            <span class="pending-recent-track__sheen"></span>
          </template>

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

      <div class="relative z-10 flex items-center gap-3 shrink-0 sm:min-w-[8.5rem] sm:justify-end">
            <Transition name="pending-recent-badge">
              <div
                v-if="isPrimaryPendingRecentTrack(track, i)"
                class="pending-recent-pill-wrap hidden sm:flex"
                :class="{ 'pending-recent-pill-wrap--completed': pendingRecentPhase(track) !== 'counting' }"
              >
                <div
                  class="pending-recent-pill tabular-nums text-[10px] font-medium uppercase tracking-[0.18em]"
                  :class="{ 'pending-recent-pill--completed': pendingRecentPhase(track) !== 'counting' }"
                  :style="{ width: pendingBadgeWidth(track), minWidth: pendingBadgeWidth(track), '--pending-pill-accent': `rgb(${accentRgb})` }"
                >
                  <span
                    class="pending-recent-pill__label"
                    :class="{ 'pending-recent-pill__label--hidden': pendingRecentPhase(track) !== 'counting' }"
                  >
                    {{ pendingRecentStatus(track) }}
                  </span>
                  <span
                    class="pending-recent-pill__check"
                    :class="{ 'pending-recent-pill__check--visible': pendingRecentPhase(track) === 'completed' }"
                  >
                    <Icon :path="mdiCheck" class="h-3.5 w-3.5" />
                  </span>
                </div>
              </div>
            </Transition>
            <span
              class="hidden w-12 text-right text-[12px] font-medium tabular-nums tracking-[0.08em] sm:inline"
              :class="[
                isCurrentTrack(track) ? 'text-zinc-200/70' : 'text-zinc-500/80',
                isPrimaryPendingRecentTrack(track, i) ? 'hidden' : '',
              ]"
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
              <button
                v-if="draggable"
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500/80 transition-colors sm:hidden"
                :class="{ 'text-zinc-200': dragIndex === i }"
                aria-label="Reorder track"
                style="touch-action: none"
                @touchstart.prevent.stop="onHandleTouchStart($event, i)"
              >
                <Icon :path="mdiDragVertical" class="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </component>
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
.track-list-rows {
  position: relative;
}

.drop-above {
  box-shadow: inset 0 2px 0 var(--indicator);
}
.drop-below {
  box-shadow: inset 0 -2px 0 var(--indicator);
}
.pending-recent-track {
  overflow: hidden;
}
.pending-recent-track__backdrop,
.pending-recent-track__fill,
.pending-recent-track__sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.pending-recent-track__backdrop {
  background: linear-gradient(180deg, rgb(255 255 255 / 0.018), rgb(255 255 255 / 0));
}
.pending-recent-track__fill {
  width: var(--pending-progress, 0%);
  background: linear-gradient(90deg, rgb(255 255 255 / 0.08), rgb(255 255 255 / 0.025));
  transition: width 220ms linear, opacity 260ms ease-out;
}
.pending-recent-track__sheen {
  background: linear-gradient(115deg, transparent 22%, rgb(255 255 255 / 0.05) 34%, transparent 50%);
  opacity: 0.24;
  transform: translateX(-42%);
  transition: opacity 260ms ease-out, transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
.pending-recent-track.pending-recent-track .pending-recent-track__sheen {
  animation: pending-recent-sheen 2.4s ease-in-out infinite;
}
.track-list-rows > :not(:first-child) .pending-recent-pill-wrap,
.track-list-rows > :not(:first-child) .pending-recent-track__backdrop,
.track-list-rows > :not(:first-child) .pending-recent-track__fill,
.track-list-rows > :not(:first-child) .pending-recent-track__sheen {
  display: none !important;
}
.pending-recent-pill-wrap {
  width: 0;
  overflow: visible;
  justify-content: flex-end;
}
.pending-recent-pill-wrap--completed {
  transform: translateX(-0.12rem);
}
.pending-recent-pill {
  position: relative;
  overflow: hidden;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.48rem 0.9rem;
  border-radius: 999px;
  background: rgb(10 10 12 / 0.28);
  color: rgb(212 212 216 / 0.74);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.02);
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1), min-width 420ms cubic-bezier(0.22, 1, 0.36, 1), padding 420ms cubic-bezier(0.22, 1, 0.36, 1), background-color 320ms ease-out, color 320ms ease-out, transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms ease-out;
}
.pending-recent-pill--completed {
  padding-left: 0;
  padding-right: 0;
  background: color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 18%, rgb(9 9 11 / 0.82));
  color: color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 62%, white);
  transform: scale(1.02);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 30%, rgb(255 255 255 / 0.06)),
    0 14px 28px -24px color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 45%, transparent);
}
.pending-recent-pill__label {
  display: inline-block;
  max-width: 14rem;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 220ms ease-out, transform 380ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease-out;
}
.pending-recent-pill__label--hidden {
  max-width: 0;
  opacity: 0;
  transform: translateY(-7px) scale(0.92);
  filter: blur(3px);
}
.pending-recent-pill__check {
  position: absolute;
  left: 50%;
  top: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translate(-50%, -50%) rotate(-10deg) scale(0.6);
  filter: blur(5px);
  transition: opacity 260ms ease-out 80ms, transform 520ms cubic-bezier(0.2, 0.9, 0.2, 1.2) 80ms, filter 260ms ease-out 80ms;
}
.pending-recent-pill__check--visible {
  opacity: 1;
  transform: translate(-50%, -50%) rotate(0deg) scale(1);
  filter: blur(0);
}
@keyframes pending-recent-sheen {
  0%, 100% {
    transform: translateX(-42%);
  }
  50% {
    transform: translateX(18%);
  }
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

.track-list-item-move,
.track-list-item-enter-active,
.track-list-item-leave-active {
  transition:
    transform 360ms cubic-bezier(0.22, 1, 0.36, 1),
    opacity 260ms ease,
    filter 260ms ease;
}

.track-list-item-enter-from,
.track-list-item-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
  filter: blur(4px);
}

.track-list-item-leave-active {
  position: absolute;
  left: 0;
  right: 0;
  z-index: 0;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .cover-indicator-enter-active,
  .cover-indicator-leave-active,
  .track-indicator-enter-active,
  .track-indicator-leave-active,
  .cover-icon-swap-enter-active,
  .cover-icon-swap-leave-active,
  .track-list-item-move,
  .track-list-item-enter-active,
  .track-list-item-leave-active {
    transition: none;
  }
}
</style>
