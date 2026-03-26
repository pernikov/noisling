<script setup>
import { ref, watch, nextTick, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { mdiMagnify, mdiClose, mdiDotsVertical } from '@mdi/js';
import Icon from './Icon.vue';
import BaseModal from './BaseModal.vue';
import CoverArt from './CoverArt.vue';
import ArtistCover from './ArtistCover.vue';
import KbdKey from './KbdKey.vue';
import TrackContextMenu from './TrackContextMenu.vue';
import { useApi } from '../composables/useApi.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useContextMenu } from '../composables/useContextMenu.js';
import { formatTime } from '../composables/useProgressScrub.js';

const router = useRouter();
const api = useApi();
const { playAlbum } = usePlayer();

// Track context menu
const { menuTrack, menuStyle, openMenu: openTrackMenu, closeMenu: closeTrackMenu, cancelClose: cancelCloseTrackMenu } = useContextMenu({ menuWidth: 160, menuHeight: 72 });


const open = ref(false);
const query = ref('');
const results = ref({ tracks: [], artists: [], albums: [] });
const loading = ref(false);
const focusedIndex = ref(-1);
const inputRef = ref(null);
const resultsRef = ref(null);

let debounceTimer = null;

const rowPy = computed(() => 'py-3 sm:py-2');
const coverSize = computed(() => 'w-10 h-10 sm:w-9 sm:h-9');

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

watch(focusedIndex, (idx) => {
  if (idx < 0 || !resultsRef.value) return;
  nextTick(() => {
    const el = resultsRef.value.querySelectorAll('[data-result-item]')[idx];
    el?.scrollIntoView({ block: 'nearest' });
  });
});

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

function onTrackResultKeydown(event, track) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  selectItem({ type: 'track', data: track });
}

</script>

<template>
  <!-- Navbar trigger — icon-only, matches other nav buttons -->
  <button
    @click="openSearch"
    class="text-zinc-400 hover:text-zinc-100 transition-colors p-1.5 rounded-lg hover:bg-white/10"
    :class="{ '!text-zinc-100': open }"
    aria-label="Search"
  >
    <Icon :path="mdiMagnify" class="w-5 h-5" />
  </button>

  <!-- Modal -->
  <BaseModal :show="open" align="top" mobile-full-screen @close="closeSearch">
        <div
          class="bg-zinc-900/98 border-y border-zinc-800/90 shadow-2xl w-full max-w-none min-h-svh flex flex-col sm:min-h-0 sm:max-w-xl sm:rounded-lg sm:border sm:border-zinc-700/80 sm:bg-zinc-900 overflow-hidden"
          style="max-height: 100svh;"
        >

          <!-- Input -->
          <div class="flex items-center gap-3 px-4 pt-[calc(env(safe-area-inset-top)+0.875rem)] pb-3 border-b border-zinc-800 shrink-0 sm:px-4 sm:py-0">
            <div class="flex items-center justify-center w-10 h-10 rounded-2xl bg-white/5 border border-white/10 shrink-0 sm:w-auto sm:h-auto sm:rounded-none sm:bg-transparent sm:border-0">
              <Icon :path="mdiMagnify" class="w-5 h-5 text-zinc-400 shrink-0 sm:mr-3" />
            </div>
            <input
              ref="inputRef"
              v-model="query"
              type="text"
              placeholder="Search tracks, albums, artists..."
              class="flex-1 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-500 text-base sm:text-sm py-3 sm:py-4"
              @keydown="onInputKeydown"
            />
            <button
              @click="closeSearch"
              class="flex items-center justify-center w-10 h-10 text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors rounded-2xl shrink-0"
              aria-label="Close search"
            >
              <Icon :path="mdiClose" class="w-5 h-5 sm:w-4 sm:h-4" />
            </button>
          </div>

          <!-- Results -->
          <div ref="resultsRef" class="flex-1 min-h-0 overflow-y-auto overscroll-contain">

            <!-- Loading -->
            <div v-if="loading" class="p-3 space-y-3 animate-pulse">
              <div>
                <div class="h-2.5 bg-zinc-800/70 rounded w-12 ml-1 mb-2"></div>
                <div v-for="n in 2" :key="`track-${n}`" class="flex items-center gap-3 px-1 py-2.5 sm:py-2">
                  <div class="w-10 h-10 sm:w-8 sm:h-8 bg-zinc-800 rounded shrink-0"></div>
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${55 + (n * 13) % 25}%` }"></div>
                    <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${35 + (n * 17) % 25}%` }"></div>
                  </div>
                  <div class="h-2.5 bg-zinc-800/60 rounded w-10 shrink-0"></div>
                </div>
              </div>

              <div>
                <div class="h-2.5 bg-zinc-800/70 rounded w-12 ml-1 mb-2"></div>
                <div v-for="n in 2" :key="`entity-${n}`" class="flex items-center gap-3 px-1 py-2.5 sm:py-2">
                  <div class="w-10 h-10 sm:w-8 sm:h-8 bg-zinc-800 rounded shrink-0"></div>
                  <div class="min-w-0 flex-1 space-y-1.5">
                    <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${50 + (n * 15) % 30}%` }"></div>
                    <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${40 + (n * 11) % 25}%` }"></div>
                  </div>
                  <div class="h-2.5 bg-zinc-800/60 rounded w-14 shrink-0"></div>
                </div>
              </div>
            </div>

            <!-- Results list -->
            <template v-else-if="hasResults">

              <!-- Tracks -->
              <template v-if="results.tracks.length">
                <p class="px-4 pt-3 pb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.18em]">Tracks</p>
                <div
                  v-for="(track, i) in results.tracks"
                  :key="track._id"
                  data-result-item
                  class="group flex items-center gap-3 px-4 text-left transition-colors cursor-pointer"
                  :class="[rowPy, focusedIndex === flatIndex('track', i) ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/50']"
                  role="button"
                  tabindex="0"
                  :aria-label="`Play ${track.title}`"
                  @click="selectItem({ type: 'track', data: track })"
                  @keydown="onTrackResultKeydown($event, track)"
                  @mouseenter="focusedIndex = flatIndex('track', i)"
                >
                  <CoverArt :cover="track.cover" :size="`${coverSize} shrink-0`" />
                  <div class="min-w-0 flex-1">
                    <div class="text-sm text-zinc-100 truncate">{{ track.title }}</div>
                    <div class="text-xs text-zinc-500 truncate">
                      {{ track.artists?.join(', ') }}<template v-if="track.album"> · {{ track.album }}</template>
                    </div>
                  </div>
                  <span
                    :class="menuTrack === track ? 'hidden' : 'group-hover:hidden sm:block hidden'"
                    class="text-xs text-zinc-600 shrink-0 tabular-nums"
                  >
                    {{ formatTime(track.duration) }}
                  </span>
                  <button
                    :class="menuTrack === track ? 'flex' : 'flex sm:hidden sm:group-hover:flex'"
                    class="items-center justify-end shrink-0 text-zinc-500 hover:text-zinc-300 p-0.5 rounded"
                    @click.stop="openTrackMenu($event, track)"
                  >
                    <Icon :path="mdiDotsVertical" class="w-4 h-4" />
                  </button>
                </div>
              </template>

              <!-- Artists -->
              <template v-if="results.artists.length">
                <p class="px-4 pt-3 pb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.18em]">Artists</p>
                <button
                  v-for="(artist, i) in results.artists"
                  :key="artist.name"
                  data-result-item
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

              <!-- Albums -->
              <template v-if="results.albums.length">
                <p class="px-4 pt-3 pb-2 text-[11px] font-semibold text-zinc-500 uppercase tracking-[0.18em]">Albums</p>
                <button
                  v-for="(album, i) in results.albums"
                  :key="album.name"
                  data-result-item
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
            <div v-else-if="query.trim() && !loading" class="py-12 px-6 text-center text-sm text-zinc-500">
              No results for "{{ query }}"
            </div>

            <!-- Idle -->
            <div v-else class="px-6 py-10 sm:py-12 text-center">
              <div class="mx-auto max-w-xs sm:max-w-none">
                <p class="text-base text-zinc-300">Search your library</p>
                <p class="mt-2 text-sm text-zinc-500">Find tracks, albums, and artists in one place.</p>
              </div>
            </div>
          </div>

          <!-- Footer hints -->
          <div class="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-zinc-800/80 text-[11px] text-zinc-600 shrink-0">
            <span><KbdKey>↑↓</KbdKey> navigate</span>
            <span><KbdKey>↵</KbdKey> select</span>
            <span><KbdKey>esc</KbdKey> close</span>
          </div>
        </div>
  </BaseModal>

  <TrackContextMenu
    :track="menuTrack"
    :style="menuStyle"
    show-backdrop
    @close="closeTrackMenu"
    @cancel-close="cancelCloseTrackMenu"
  />

</template>
