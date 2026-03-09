<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { mdiMagnify, mdiClose, mdiDotsVertical, mdiCheck } from '@mdi/js';
import Icon from './Icon.vue';
import BaseModal from './BaseModal.vue';
import CoverArt from './CoverArt.vue';
import ArtistCover from './ArtistCover.vue';
import TrackContextMenu from './TrackContextMenu.vue';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';

const router = useRouter();
const api = useApi();
const { playAlbum } = usePlayer();
const { showCoverArt, density, tracksColumns } = useTheme();

// Track context menu
const menuTrack = ref(null);
const menuStyle = ref({});

function openTrackMenu(e, track) {
  e.stopPropagation();
  menuTrack.value = track;
  const rect = e.currentTarget.getBoundingClientRect();
  const menuW = 160, menuH = 72;
  let top = rect.bottom + 4;
  let left = rect.right - menuW;
  if (top + menuH > window.innerHeight) top = rect.top - menuH - 4;
  if (left < 8) left = 8;
  menuStyle.value = { top: `${top}px`, left: `${left}px` };
}

let menuCloseTimer = null;

function scheduleCloseTrackMenu() {
  menuCloseTimer = setTimeout(() => { menuTrack.value = null; }, 120);
}

function cancelCloseTrackMenu() {
  clearTimeout(menuCloseTimer);
}

function closeTrackMenu() {
  clearTimeout(menuCloseTimer);
  menuTrack.value = null;
}

const toastVisible = ref(false);
const toastMessage = ref('');
let toastTimer = null;

function showToast(msg) {
  toastMessage.value = msg;
  toastVisible.value = true;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastVisible.value = false; }, 2000);
}


const open = ref(false);
const query = ref('');
const results = ref({ tracks: [], artists: [], albums: [] });
const loading = ref(false);
const focusedIndex = ref(-1);
const inputRef = ref(null);

let debounceTimer = null;

const rowPy = computed(() => density.value === 'compact' ? 'py-1' : 'py-2');
const coverSize = computed(() => density.value === 'compact' ? 'w-6 h-6' : 'w-9 h-9');

function openSearch() {
  open.value = true;
  nextTick(() => inputRef.value?.focus());
}

function closeSearch() {
  open.value = false;
  query.value = '';
  results.value = { tracks: [], artists: [], albums: [] };
  focusedIndex.value = -1;
  loading.value = false;
  clearTimeout(debounceTimer);
  closeTrackMenu();
}

function isTyping(e) {
  const tag = e.target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;
}

function onGlobalKeydown(e) {
  if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(e)) {
    e.preventDefault();
    open.value ? closeSearch() : openSearch();
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

watch(query, (val) => {
  clearTimeout(debounceTimer);
  focusedIndex.value = -1;
  if (!val.trim()) {
    results.value = { tracks: [], artists: [], albums: [] };
    loading.value = false;
    return;
  }
  loading.value = true;
  debounceTimer = setTimeout(async () => {
    try {
      results.value = await api.globalSearch(val.trim());
    } catch {
      results.value = { tracks: [], artists: [], albums: [] };
    }
    loading.value = false;
  }, 300);
});

// Flat list for unified keyboard navigation
const flatResults = computed(() => {
  const items = [];
  for (const track of results.value.tracks) items.push({ type: 'track', data: track });
  for (const artist of results.value.artists) items.push({ type: 'artist', data: artist });
  for (const album of results.value.albums) items.push({ type: 'album', data: album });
  return items;
});

const hasResults = computed(() =>
  results.value.tracks.length > 0 ||
  results.value.artists.length > 0 ||
  results.value.albums.length > 0
);

function onInputKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    focusedIndex.value = Math.min(focusedIndex.value + 1, flatResults.value.length - 1);
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    focusedIndex.value = Math.max(focusedIndex.value - 1, -1);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const target = focusedIndex.value >= 0
      ? flatResults.value[focusedIndex.value]
      : flatResults.value[0];
    if (target) selectItem(target);
  }
}

function selectItem(item) {
  if (item.type === 'track') {
    playAlbum(results.value.tracks, results.value.tracks.indexOf(item.data));
  } else if (item.type === 'artist') {
    router.push(`/artists/${encodeURIComponent(item.data.name)}`);
  } else if (item.type === 'album') {
    const artistNorm = item.data.artistsNorm?.[0] || '';
    router.push(`/albums/${encodeURIComponent(artistNorm)}/${encodeURIComponent(item.data.name)}`);
  }
  closeSearch();
}

function flatIndex(type, i) {
  if (type === 'track') return i;
  if (type === 'artist') return results.value.tracks.length + i;
  return results.value.tracks.length + results.value.artists.length + i;
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <!-- Navbar trigger — icon-only, matches other nav buttons -->
  <button
    @click="openSearch"
    class="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded hover:bg-zinc-800"
    :class="{ '!text-zinc-100': open }"
    aria-label="Search"
  >
    <Icon :path="mdiMagnify" class="w-5 h-5" />
  </button>

  <!-- Modal -->
  <BaseModal :show="open" align="top" @close="closeSearch">
        <div class="bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl w-full max-w-xl overflow-hidden">

          <!-- Input -->
          <div class="flex items-center px-4 border-b border-zinc-800">
            <Icon :path="mdiMagnify" class="w-5 h-5 text-zinc-500 shrink-0 mr-3" />
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="Search tracks, albums, artists..."
              class="flex-1 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-500 text-sm py-4"
              @keydown="onInputKeydown"
            />
            <button
              @click="closeSearch"
              class="text-zinc-600 hover:text-zinc-400 transition-colors p-1 ml-2 rounded"
            >
              <Icon :path="mdiClose" class="w-4 h-4" />
            </button>
          </div>

          <!-- Results -->
          <div class="max-h-[28rem] overflow-y-auto overscroll-contain">

            <!-- Loading -->
            <div v-if="loading" class="p-3 space-y-1.5">
              <div v-for="n in 5" :key="n" class="h-11 rounded-lg bg-zinc-800/60 animate-pulse" />
            </div>

            <!-- Results list -->
            <template v-else-if="hasResults">

              <!-- Tracks -->
              <template v-if="results.tracks.length">
                <p class="px-4 pt-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Tracks</p>
                <div
                  v-for="(track, i) in results.tracks"
                  :key="track._id"
                  class="group flex items-center gap-3 px-4 text-left transition-colors cursor-pointer"
                  :class="[rowPy, focusedIndex === flatIndex('track', i) ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50']"
                  @click="selectItem({ type: 'track', data: track })"
                  @mouseenter="focusedIndex = flatIndex('track', i)"
                  @mouseleave="scheduleCloseTrackMenu"
                >
                  <CoverArt v-if="showCoverArt" :cover="track.cover" :size="`${coverSize} shrink-0`" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-zinc-100 truncate">{{ track.title }}</div>
                    <div class="text-xs text-zinc-500 truncate">
                      <template v-if="tracksColumns.artist && tracksColumns.album">{{ track.artists?.join(', ') }} · {{ track.album }}</template>
                      <template v-else-if="tracksColumns.artist">{{ track.artists?.join(', ') }}</template>
                      <template v-else-if="tracksColumns.album">{{ track.album }}</template>
                    </div>
                  </div>
                  <span :class="menuTrack === track ? 'hidden' : 'group-hover:hidden'" class="text-xs text-zinc-600 shrink-0 tabular-nums">{{ formatDuration(track.duration) }}</span>
                  <button
                    :class="menuTrack === track ? 'flex' : 'hidden group-hover:flex'"
                    class="items-center justify-end shrink-0 text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
                    @click.stop="openTrackMenu($event, track)"
                  >
                    <Icon :path="mdiDotsVertical" class="w-4 h-4" />
                  </button>
                </div>
              </template>

              <!-- Artists -->
              <template v-if="results.artists.length">
                <p class="px-4 pt-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Artists</p>
                <button
                  v-for="(artist, i) in results.artists"
                  :key="artist.name"
                  class="w-full flex items-center gap-3 px-4 text-left transition-colors"
                  :class="[rowPy, focusedIndex === flatIndex('artist', i) ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50']"
                  @click="selectItem({ type: 'artist', data: artist })"
                  @mouseenter="focusedIndex = flatIndex('artist', i)"
                >
                  <!-- Multi-cover thumbnail, same layout as the artist page grid -->
                  <div :class="`${coverSize} shrink-0 rounded overflow-hidden`">
                    <ArtistCover :covers="artist.covers" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-zinc-100 truncate">{{ artist.name }}</div>
                    <div class="text-xs text-zinc-500">
                      {{ artist.albumCount }} {{ artist.albumCount === 1 ? 'album' : 'albums' }} · {{ artist.trackCount }} {{ artist.trackCount === 1 ? 'track' : 'tracks' }}
                    </div>
                  </div>
                </button>
              </template>

              <!-- Albums — cover always shown regardless of showCoverArt preference -->
              <template v-if="results.albums.length">
                <p class="px-4 pt-3 pb-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Albums</p>
                <button
                  v-for="(album, i) in results.albums"
                  :key="album.name"
                  class="w-full flex items-center gap-3 px-4 text-left transition-colors"
                  :class="[rowPy, focusedIndex === flatIndex('album', i) ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50']"
                  @click="selectItem({ type: 'album', data: album })"
                  @mouseenter="focusedIndex = flatIndex('album', i)"
                >
                  <CoverArt :cover="album.cover" :size="`${coverSize} shrink-0`" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-zinc-100 truncate">{{ album.name }}</div>
                    <div class="text-xs text-zinc-500 truncate">
                      {{ album.artists?.join(', ') }}{{ album.year ? ` · ${album.year}` : '' }}
                    </div>
                  </div>
                  <span class="text-xs text-zinc-600 shrink-0">{{ album.trackCount }} {{ album.trackCount === 1 ? 'track' : 'tracks' }}</span>
                </button>
              </template>

              <div class="h-2" />
            </template>

            <!-- No results -->
            <div v-else-if="query.trim() && !loading" class="py-12 text-center text-sm text-zinc-500">
              No results for "{{ query }}"
            </div>

            <!-- Idle -->
            <div v-else class="py-10 text-center text-sm text-zinc-600">
              Type to search your library
            </div>
          </div>

          <!-- Footer hints -->
          <div class="flex items-center gap-4 px-4 py-2 border-t border-zinc-800/80 text-[11px] text-zinc-600">
            <span><kbd class="font-mono bg-zinc-800 border border-zinc-700/80 rounded px-1">↑↓</kbd> navigate</span>
            <span><kbd class="font-mono bg-zinc-800 border border-zinc-700/80 rounded px-1">↵</kbd> select</span>
            <span><kbd class="font-mono bg-zinc-800 border border-zinc-700/80 rounded px-1">esc</kbd> close</span>
          </div>
        </div>
  </BaseModal>

  <TrackContextMenu
    :track="menuTrack"
    :style="menuStyle"
    show-backdrop
    @close="closeTrackMenu"
    @cancel-close="cancelCloseTrackMenu"
    @toast="showToast"
  />

  <!-- Toast -->
  <Teleport to="body">
    <Transition name="menu">
      <div
        v-if="toastVisible"
        class="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-full text-sm shadow-lg whitespace-nowrap"
      >
        <Icon :path="mdiCheck" class="w-4 h-4 text-green-400 shrink-0" />
        {{ toastMessage }}
      </div>
    </Transition>
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

</style>
