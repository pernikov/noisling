<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import BaseModal from './BaseModal.vue';
import Button from './Button.vue';
import CoverArt from './CoverArt.vue';
import LoadingState from './LoadingState.vue';
import SearchBox from './SearchBox.vue';
import SelectionCheckbox from './SelectionCheckbox.vue';
import TabBar from './TabBar.vue';

const props = defineProps({
  playlistId: { type: String, required: true },
});
const emit = defineEmits(['close', 'added']);

const api = useApi();

const TABS = ['Track', 'Album', 'Artist', 'Genre'];
const TAB_ITEMS = TABS.map(t => ({ value: t, label: t }));
const ITEM_HEIGHT = 48;
const OVERSCAN = 8;

const activeTab = ref('Track');
const search = ref('');

// Multiselect: Map of key → item
const selectedMap = ref(new Map());

// Data — Genre/Album cached after first load; Artist/Track are search results
const genres = ref([]);
const albums = ref([]);
const artistResults = ref([]);
const trackResults = ref([]);

const loadingGenres = ref(false);
const searchLoading = ref(false);
const adding = ref(false);

// --- Virtual scroll ---
const scrollContainer = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(400);

function onScroll(e) {
  scrollTop.value = e.target.scrollTop;
  containerHeight.value = e.target.clientHeight;
}

watch(scrollContainer, (el) => {
  if (el) containerHeight.value = el.clientHeight;
});

const totalHeight = computed(() => currentList.value.length * ITEM_HEIGHT);
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT) - OVERSCAN)
);
const endIndex = computed(() =>
  Math.min(currentList.value.length, Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT) + OVERSCAN)
);
const visibleItems = computed(() =>
  currentList.value.slice(startIndex.value, endIndex.value).map((item, i) => ({
    item,
    index: startIndex.value + i,
  }))
);
const offsetY = computed(() => startIndex.value * ITEM_HEIGHT);

const atTop = computed(() => scrollTop.value <= 0);
const atBottom = computed(() => scrollTop.value + containerHeight.value >= totalHeight.value - 1);
const scrollMask = computed(() => {
  if (atTop.value && atBottom.value) return 'none';
  if (atTop.value) return 'linear-gradient(to bottom, black 0%, black calc(100% - 1.5rem), transparent 100%)';
  if (atBottom.value) return 'linear-gradient(to bottom, transparent 0%, black 1.5rem, black 100%)';
  return 'linear-gradient(to bottom, transparent 0%, black 1.5rem, black calc(100% - 1.5rem), transparent 100%)';
});

// --- Data loading ---
async function loadGenres() {
  if (genres.value.length) return;
  loadingGenres.value = true;
  try {
    genres.value = await api.getGenres();
  } catch (err) {
    console.error(err);
  } finally {
    loadingGenres.value = false;
  }
}

onMounted(loadGenres);

// Artist/Album/Track: search-first, debounced
let searchTimer = null;
watch(search, (val) => {
  if (activeTab.value === 'Genre') return;
  clearTimeout(searchTimer);
  if (!val.trim()) {
    artistResults.value = [];
    trackResults.value = [];
    return;
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true;
    try {
      if (activeTab.value === 'Artist') {
        const res = await api.getArtists(1, 50, val.trim());
        artistResults.value = res.artists;
      } else if (activeTab.value === 'Album') {
        if (!albums.value.length) albums.value = await api.getAlbums();
        // filtering done in currentList computed
      } else if (activeTab.value === 'Track') {
        const res = await api.getTracks(1, 50, val.trim());
        trackResults.value = res.tracks;
      }
    } catch (err) {
      console.error(err);
    } finally {
      searchLoading.value = false;
    }
  }, 300);
});

watch(activeTab, () => {
  search.value = '';
  selectedMap.value = new Map();
  artistResults.value = [];
  trackResults.value = [];
  scrollTop.value = 0;
  if (scrollContainer.value) scrollContainer.value.scrollTop = 0;
});

// --- List ---
const currentList = computed(() => {
  const q = search.value.toLowerCase().trim();
  if (activeTab.value === 'Genre') {
    return q ? genres.value.filter(g => g.name.toLowerCase().includes(q)) : genres.value;
  }
  if (activeTab.value === 'Artist') return artistResults.value;
  if (activeTab.value === 'Album') {
    return q ? albums.value.filter(a => (a.name ?? '').toLowerCase().includes(q)) : [];
  }
  return trackResults.value;
});

const showPrompt = computed(() => activeTab.value !== 'Genre' && !search.value.trim());

// --- Selection ---
function itemKey(item) {
  if (activeTab.value === 'Track') return String(item._id);
  if (activeTab.value === 'Album') return `${item.name}__${item.artistsNorm?.[0] ?? ''}`;
  return item.name ?? '';
}

function itemCover(item) {
  if (activeTab.value === 'Artist') return item.covers?.[0] ?? '';
  return item.cover ?? '';
}

const totalSelectedCount = computed(() => {
  let n = 0;
  for (const item of selectedMap.value.values()) {
    n += activeTab.value === 'Track' ? 1 : (item.trackCount ?? 0);
  }
  return n;
});

function toggleItem(item) {
  const key = itemKey(item);
  const map = new Map(selectedMap.value);
  if (map.has(key)) map.delete(key);
  else map.set(key, item);
  selectedMap.value = map;
}

function isSelected(item) {
  return selectedMap.value.has(itemKey(item));
}

// --- Add ---
async function addTracks() {
  if (!selectedMap.value.size || adding.value) return;
  adding.value = true;
  try {
    const allIds = [];
    for (const item of selectedMap.value.values()) {
      if (activeTab.value === 'Genre') {
        const tracks = await api.getTracksByGenre(item.raw);
        allIds.push(...tracks.map(t => t._id));
      } else if (activeTab.value === 'Artist') {
        const tracks = await api.getArtistTracks(item.name);
        allIds.push(...tracks.map(t => t._id));
      } else if (activeTab.value === 'Album') {
        const { tracks } = await api.getAlbum(item.artistsNorm[0], item.name);
        allIds.push(...tracks.map(t => t._id));
      } else {
        allIds.push(item._id);
      }
    }
    const uniqueIds = [...new Set(allIds.map(String))];
    await api.addToPlaylist(props.playlistId, uniqueIds);
    emit('added', uniqueIds.length);
    emit('close');
  } catch (err) {
    console.error('Failed to add tracks:', err);
    adding.value = false;
  }
}
</script>

<template>
  <BaseModal :show="true" @close="emit('close')">
    <div class="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-sm shadow-2xl flex flex-col" style="max-height: 80vh">
      <!-- Header -->
      <div class="px-5 pt-5 pb-3 border-b border-zinc-800 shrink-0">
        <h2 class="text-base font-bold font-display">Add tracks</h2>
      </div>

      <!-- Segmented tabs -->
      <div class="px-3 pt-3 pb-2 shrink-0">
        <TabBar v-model="activeTab" :tabs="TAB_ITEMS" :full="true" />
      </div>

      <!-- Search -->
      <div class="px-3 pb-2 shrink-0">
        <SearchBox
          v-model="search"
          :placeholder="activeTab === 'Genre' ? 'Search genres…' : `Search ${activeTab.toLowerCase()}s…`"
        />
      </div>

      <!-- List area — scroll container is always rendered so flex-1 gives it real height -->
      <div
        ref="scrollContainer"
        class="overflow-y-auto overscroll-contain flex-1 min-h-[200px] px-2"
        :style="{ maskImage: scrollMask, WebkitMaskImage: scrollMask }"
        @scroll="onScroll"
      >
        <!-- Loading -->
        <LoadingState v-if="loadingGenres || searchLoading" />
        <!-- Prompt to search -->
        <div v-else-if="showPrompt" class="px-3 py-4 text-sm text-zinc-500 text-center">
          Type to search {{ activeTab.toLowerCase() }}s.
        </div>
        <!-- No results -->
        <div v-else-if="currentList.length === 0" class="px-3 py-4 text-sm text-zinc-500 text-center">
          No results.
        </div>
        <!-- Virtual scroll -->
        <div v-else :style="{ height: totalHeight + 'px', position: 'relative' }">
          <div :style="{ transform: `translateY(${offsetY}px)` }">
              <button
                v-for="{ item } in visibleItems"
                :key="itemKey(item)"
                @click="toggleItem(item)"
                class="flex items-center gap-2.5 w-full px-2.5 text-sm rounded-lg transition-colors"
                :class="isSelected(item) ? 'bg-zinc-700 text-white' : 'hover:bg-zinc-800/70 text-zinc-300'"
                :style="{ height: ITEM_HEIGHT + 'px' }"
              >
                <!-- Checkbox first -->
                <SelectionCheckbox :checked="isSelected(item)" />
                <!-- Cover -->
                <CoverArt
                  v-if="activeTab !== 'Genre'"
                  :cover="itemCover(item)"
                  size="w-8 h-8"
                  class="shrink-0"
                />
                <!-- Label -->
                <div class="min-w-0 flex-1 text-left">
                  <p class="truncate font-medium leading-tight">
                    {{ activeTab === 'Track' ? item.title : (item.name || (activeTab === 'Genre' ? 'Unknown Genre' : 'Unknown')) }}
                  </p>
                  <p
                    v-if="(activeTab === 'Album' && item.artists?.length) || activeTab === 'Track'"
                    class="text-xs text-zinc-400 truncate mt-0.5"
                  >
                    <template v-if="activeTab === 'Album'">{{ item.artists[0] }}</template>
                    <template v-else>{{ item.artists?.join(', ') }}{{ item.album ? ' · ' + item.album : '' }}</template>
                  </p>
                </div>
                <!-- Track count badge -->
                <span v-if="activeTab !== 'Track'" class="text-xs text-zinc-500 shrink-0">
                  {{ item.trackCount }}
                </span>
              </button>
            </div>
          </div>
        </div>

      <!-- Footer -->
      <div class="border-t border-zinc-800 px-5 py-3 flex items-center justify-between gap-3 shrink-0">
        <span class="text-xs text-zinc-500 truncate">
          {{ selectedMap.size
            ? `${totalSelectedCount} track${totalSelectedCount !== 1 ? 's' : ''} selected`
            : `Select ${activeTab === 'Track' ? 'tracks' : activeTab.toLowerCase() + 's'}` }}
        </span>
        <div class="flex gap-2 shrink-0">
          <Button size="sm" @click="emit('close')">Cancel</Button>
          <Button variant="accent" size="sm" :loading="adding" :disabled="!selectedMap.size" @click="addTracks">
            Add{{ selectedMap.size ? ` ${totalSelectedCount}` : '' }}
          </Button>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
