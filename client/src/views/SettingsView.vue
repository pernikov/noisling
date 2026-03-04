<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  mdiFolderOpen,
  mdiMagnify,
  mdiLoading,
  mdiCheck,
  mdiAlertCircle,
  mdiTrashCan,
  mdiImage,
  mdiPalette,
  mdiHeadphones,
  mdiChartBar,
  mdiViewAgenda,
  mdiViewHeadline,
} from '@mdi/js';
import Icon from '../components/Icon.vue';
import { useApi } from '../composables/useApi.js';
import { useTheme } from '../composables/useTheme.js';
import ConfirmModal from '../components/ConfirmModal.vue';
import TrackList from '../components/TrackList.vue';
import CoverArt from '../components/CoverArt.vue';

const route = useRoute();
const router = useRouter();
const api = useApi();
const appVersion = __APP_VERSION__;
const {
  accentColor, accentRgb, VALID_COLORS,
  density, showCoverArt, fontSize,
  lovedUseAccent, setLovedUseAccent,
  songsColumns, setSongsColumn,
  showArtistsNav, wideLayout,
  homeShowQuickPlay, homeShowRecent, homeShowAlbums, homeVisibleCount,
  setAccentColor, setDensity, setShowCoverArt, setFontSize,
  setShowArtistsNav, setWideLayout, setHomeSection,
} = useTheme();

const VALID_TABS = ['library', 'appearance', 'stats'];
const activeTab = ref(VALID_TABS.includes(route.query.tab) ? route.query.tab : 'library');

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } });
});

// Settings state
const scanning = ref(false);
const scanPhase = ref(null);
const scanPercent = ref(null);
const scanProgress = ref(null);
const scanResult = ref(null);
const deleting = ref(false);
const deleteResult = ref(null);
const confirm = ref(null); // { title, message, confirmLabel, destructive, onConfirm }

function promptConfirm(opts) { confirm.value = opts; }
function closeConfirm() { confirm.value = null; }
const missingCoverAlbums = ref([]);
const loadingCovers = ref(true);

let eventSource = null;

function listenForProgress() {
  eventSource = new EventSource('/api/events');
  eventSource.addEventListener('scan-progress', (e) => {
    const data = JSON.parse(e.data);
    scanPhase.value = data.phase;

    if (data.phase === 'walking') {
      scanProgress.value = { message: data.message };
    } else if (data.phase === 'processing') {
      if (data.percent != null) {
        scanPercent.value = data.percent;
        scanProgress.value = { processed: data.processed, total: data.total };
      } else {
        scanProgress.value = { total: data.total, toProcess: data.toProcess, skipped: data.skipped };
      }
    } else if (data.phase === 'complete') {
      scanPercent.value = null;
      scanProgress.value = null;
      scanPhase.value = null;
    }
  });
}

async function loadMissingCovers() {
  try {
    const albums = await api.getAlbums();
    missingCoverAlbums.value = albums.filter(a => !a.cover);
  } catch (err) {
    console.error('Failed to load albums:', err);
  } finally {
    loadingCovers.value = false;
  }
}

async function scanLibrary() {
  scanning.value = true;
  scanPercent.value = 0;
  scanPhase.value = null;
  scanProgress.value = null;
  scanResult.value = null;
  try {
    scanResult.value = await api.scanLibrary();
  } catch (err) {
    scanResult.value = { error: err.message };
  } finally {
    scanning.value = false;
    scanPercent.value = null;
    scanPhase.value = null;
    scanProgress.value = null;
  }
}

async function deleteLibrary() {
  showDeleteConfirm.value = false;
  deleting.value = true;
  deleteResult.value = null;
  try {
    const res = await api.deleteLibrary();
    deleteResult.value = { deletedTracks: res.deletedTracks };
  } catch (err) {
    deleteResult.value = { error: err.message };
  } finally {
    deleting.value = false;
  }
}

// Stats state
const stats = ref(null);
const statsLoading = ref(false);
const statsLoaded = ref(false);

async function loadStats() {
  if (statsLoaded.value) return;
  statsLoading.value = true;
  try {
    stats.value = await api.getStats();
    statsLoaded.value = true;
  } catch (err) {
    console.error('Failed to load stats:', err);
  } finally {
    statsLoading.value = false;
  }
}

watch(activeTab, (tab) => {
  if (tab === 'stats') loadStats();
}, { immediate: true });

function formatDuration(seconds) {
  if (!seconds) return '0 min';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m} min`;
  return `${h}h ${m}m`;
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

onMounted(() => {
  listenForProgress();
  loadMissingCovers();
});

onUnmounted(() => {
  eventSource?.close();
  eventSource = null;
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6 font-display">Settings</h1>

    <!-- Segmented Nav -->
    <div class="inline-flex p-1 mb-8 bg-zinc-900 rounded-xl border border-zinc-800">
      <button
        @click="activeTab = 'library'"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === 'library' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
      >
        <Icon :path="mdiFolderOpen" class="w-4 h-4" />
        Library
      </button>
      <button
        @click="activeTab = 'appearance'"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === 'appearance' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
      >
        <Icon :path="mdiPalette" class="w-4 h-4" />
        Appearance
      </button>
      <button
        @click="activeTab = 'stats'"
        class="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
        :class="activeTab === 'stats' ? 'bg-zinc-800 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
      >
        <Icon :path="mdiChartBar" class="w-4 h-4" />
        Stats
      </button>
    </div>

    <!-- Appearance tab -->
    <div v-if="activeTab === 'appearance'" class="space-y-6">
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        <div>
          <p class="text-sm font-medium text-zinc-200">Theme</p>
          <p class="text-xs text-zinc-500 mt-1">Colors, sizing, and global display options.</p>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Accent color -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-1">Accent color</p>
          <p class="text-xs text-zinc-500 mb-3">Choose a highlight color for the interface.</p>
          <div class="flex items-center gap-3 flex-wrap">
            <button
              v-for="color in VALID_COLORS"
              :key="color"
              @click="setAccentColor(color)"
              class="w-8 h-8 rounded-full transition-all ring-offset-2 ring-offset-zinc-900"
              :class="[`bg-${color}-500`, accentColor === color ? `ring-2 ring-${color}-400` : 'hover:scale-110']"
              :aria-label="`${color} accent`"
              :aria-pressed="accentColor === color"
            />
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Density -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-1">List density</p>
          <p class="text-xs text-zinc-500 mb-3">Control how compact track lists and search results appear.</p>
          <div class="inline-flex p-1 bg-zinc-800 rounded-lg border border-zinc-700 gap-1">
            <button
              @click="setDensity('comfortable')"
              class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              :class="density === 'comfortable' ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
            >
              <Icon :path="mdiViewAgenda" class="w-4 h-4" />
              Comfortable
            </button>
            <button
              @click="setDensity('compact')"
              class="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              :class="density === 'compact' ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
            >
              <Icon :path="mdiViewHeadline" class="w-4 h-4" />
              Compact
            </button>
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Font size -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-1">Font size</p>
          <p class="text-xs text-zinc-500 mb-3">Scale the interface text up or down.</p>
          <div class="inline-flex p-1 bg-zinc-800 rounded-lg border border-zinc-700 gap-1">
            <button
              v-for="size in [{ value: 'small', label: 'Small' }, { value: 'medium', label: 'Medium' }, { value: 'large', label: 'Large' }]"
              :key="size.value"
              @click="setFontSize(size.value)"
              class="px-3 py-1.5 rounded-md text-sm font-medium transition-all"
              :class="fontSize === size.value ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300'"
            >
              {{ size.label }}
            </button>
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Loved color -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Loved track color</p>
            <p class="text-xs text-zinc-500 mt-0.5">Always rose/pink, or follow the accent color.</p>
          </div>
          <button
            @click="setLovedUseAccent(!lovedUseAccent)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="lovedUseAccent ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="lovedUseAccent"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="lovedUseAccent ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>
      </section>

      <!-- Layout section -->
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-5">
        <div>
          <p class="text-sm font-medium text-zinc-200">Layout</p>
          <p class="text-xs text-zinc-500 mt-1">Choose which sections and navigation links are visible.</p>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Wide layout -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Wide layout</p>
            <p class="text-xs text-zinc-500 mt-0.5">Remove the width cap and use the full browser window.</p>
          </div>
          <button
            @click="setWideLayout(!wideLayout)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="wideLayout ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="wideLayout"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="wideLayout ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Artists nav link -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Artists in navigation</p>
            <p class="text-xs text-zinc-500 mt-0.5">Show the Artists link in the top nav bar.</p>
          </div>
          <button
            @click="setShowArtistsNav(!showArtistsNav)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="showArtistsNav ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="showArtistsNav"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="showArtistsNav ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Home sections -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-3">Home page sections</p>
          <div class="space-y-3">
            <div
              v-for="section in [
                { key: 'quickPlay', label: 'Quick Play',      desc: 'Shuffle All, Top Songs, and Loved Songs cards.', value: homeShowQuickPlay },
                { key: 'recent',   label: 'Recently Played',  desc: 'Your last 10 played tracks.',                    value: homeShowRecent },
                { key: 'albums',   label: 'Recently Added',   desc: 'Albums added to your library.',                  value: homeShowAlbums },
              ]"
              :key="section.key"
              class="flex items-center justify-between"
            >
              <div>
                <p class="text-sm text-zinc-200">{{ section.label }}</p>
                <p class="text-xs text-zinc-500 mt-0.5">{{ section.desc }}</p>
              </div>
              <button
                @click="setHomeSection(section.key, !section.value)"
                :disabled="section.value && homeVisibleCount <= 1"
                class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                :class="section.value ? `bg-${accentColor}-500` : 'bg-zinc-700 cursor-pointer'"
                role="switch"
                :aria-checked="section.value"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
                  :class="section.value ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Songs columns section -->
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-5">
        <div>
          <p class="text-sm font-medium text-zinc-200">Songs view</p>
          <p class="text-xs text-zinc-500 mt-1">Customize what's visible in track lists and queues. Click any column header in Songs to sort.</p>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Cover art toggle -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm text-zinc-200">Cover art</p>
            <p class="text-xs text-zinc-500 mt-0.5">Show album thumbnails in track lists, the queue, and search results.</p>
          </div>
          <button
            @click="setShowCoverArt(!showCoverArt)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="showCoverArt ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="showCoverArt"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="showCoverArt ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="border-t border-zinc-800" />

        <div class="space-y-3">
          <div
            v-for="col in [
              { key: 'artist',     label: 'Artist',      desc: 'Primary artist column. Shown in Songs, Recents, the home page, the queue, and search results.' },
              { key: 'album',      label: 'Album',       desc: 'Album column. Shown in Songs, Recents, the home page, and search results.' },
              { key: 'plays',      label: 'Plays',       desc: 'Play count column. Shown in Songs, Recents, and the home page.' },
              { key: 'lastPlayed', label: 'Last Played', desc: 'Last listened column. Shown in Songs, Recents, and the home page.' },
            ]"
            :key="col.key"
            class="flex items-center justify-between"
          >
            <div>
              <p class="text-sm text-zinc-200">{{ col.label }}</p>
              <p class="text-xs text-zinc-500 mt-0.5">{{ col.desc }}</p>
            </div>
            <button
              @click="setSongsColumn(col.key, !songsColumns[col.key])"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="songsColumns[col.key] ? `bg-${accentColor}-500` : 'bg-zinc-700'"
              role="switch"
              :aria-checked="songsColumns[col.key]"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
                :class="songsColumns[col.key] ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>
        </div>
      </section>
    </div>

    <!-- Library tab -->
    <div v-else-if="activeTab === 'library'" class="space-y-6">
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        <div>
          <p class="text-sm text-zinc-500">Scan your music directory for new tracks or manage your library.</p>
        </div>

        <div class="border-t border-zinc-800" />

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-zinc-200">Scan for music</p>
              <p class="text-xs text-zinc-500">Discover and index new audio files from your library folder.</p>
            </div>
            <button
              @click="promptConfirm({ title: 'Rescan library?', message: 'This will walk your music directory, process any new or changed files, and remove tracks for deleted files. It may take a while for large libraries.', confirmLabel: 'Scan Library', destructive: false, onConfirm: scanLibrary })"
              :disabled="scanning"
              class="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
            >
              <Icon v-if="!scanning" :path="mdiMagnify" class="w-4 h-4" />
              <Icon v-else :path="mdiLoading" class="w-4 h-4 animate-spin" />
              {{ scanning ? 'Scanning...' : 'Scan Library' }}
            </button>
          </div>

          <!-- Scan progress -->
          <div v-if="scanning" class="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div v-if="scanPhase === 'walking'" class="flex items-center gap-2 text-sm text-zinc-300">
              <Icon :path="mdiLoading" class="w-4 h-4 animate-spin text-zinc-400" />
              Discovering files...
            </div>
            <div v-if="scanPhase === 'processing' && scanProgress?.total && scanProgress?.toProcess != null" class="flex items-center gap-4 text-xs text-zinc-400">
              <span>{{ scanProgress.total }} files found</span>
              <span>{{ scanProgress.toProcess }} to process</span>
              <span>{{ scanProgress.skipped }} unchanged</span>
            </div>
            <div v-if="scanPhase === 'processing' && scanPercent != null" class="space-y-2">
              <div class="flex items-center justify-between text-xs text-zinc-400">
                <span>Processing tracks... {{ scanProgress?.processed ?? 0 }} / {{ scanProgress?.total ?? '?' }}</span>
                <span>{{ scanPercent }}%</span>
              </div>
              <div class="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  :class="`h-full bg-${accentColor}-500 rounded-full transition-all duration-300`"
                  :style="{ width: scanPercent + '%' }"
                />
              </div>
            </div>
          </div>

          <!-- Scan result: success -->
          <div v-if="scanResult && !scanResult.error"
            class="rounded-lg px-4 py-3 space-y-1"
            :style="{ backgroundColor: `rgba(${accentRgb}, 0.1)` }"
          >
            <div class="flex items-center gap-2 text-sm" :class="`text-${accentColor}-400`">
              <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
              Scan complete
            </div>
            <div class="flex items-center gap-4 text-xs text-zinc-400 pl-6">
              <span v-if="scanResult.added">{{ scanResult.added }} added</span>
              <span v-if="scanResult.updated">{{ scanResult.updated }} updated</span>
              <span v-if="scanResult.removed">{{ scanResult.removed }} removed</span>
              <span v-if="scanResult.skipped">{{ scanResult.skipped }} unchanged</span>
              <span v-if="scanResult.errors">{{ scanResult.errors }} errors</span>
            </div>
          </div>

          <!-- Scan result: error -->
          <div v-if="scanResult?.error"
            class="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3"
          >
            <Icon :path="mdiAlertCircle" class="w-4 h-4 shrink-0" />
            {{ scanResult.error }}
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Missing Covers -->
        <div class="space-y-3">
          <div>
            <p class="text-sm font-medium text-zinc-200">Missing covers</p>
            <p class="text-xs text-zinc-500">Albums in your library without artwork.</p>
          </div>

          <div v-if="loadingCovers" class="text-xs text-zinc-500">Loading...</div>

          <div v-else-if="missingCoverAlbums.length === 0"
            class="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
            :class="`text-emerald-400`"
            :style="{ backgroundColor: `rgba(16, 185, 129, 0.1)` }"
          >
            <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
            All albums have artwork
          </div>

          <div v-else class="space-y-1 max-h-64 overflow-y-auto rounded-lg bg-zinc-800/50 p-2">
            <div class="text-xs text-zinc-400 px-2 py-1">
              {{ missingCoverAlbums.length }} album{{ missingCoverAlbums.length !== 1 ? 's' : '' }} without artwork
            </div>
            <router-link
              v-for="album in missingCoverAlbums"
              :key="album.name + album.artists?.[0]"
              :to="{ name: 'album', params: { artist: album.artists?.[0], album: album.name } }"
              class="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-zinc-700/50 transition-colors"
            >
              <div class="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center flex-shrink-0">
                <Icon :path="mdiImage" class="w-4 h-4 text-zinc-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ album.name }}</div>
                <div class="text-xs text-zinc-500 truncate">{{ album.artists?.join(', ') }}</div>
              </div>
              <span class="text-xs text-zinc-500 shrink-0">{{ album.trackCount }} track{{ album.trackCount !== 1 ? 's' : '' }}</span>
            </router-link>
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-zinc-200">Delete library</p>
              <p class="text-xs text-zinc-500">Remove all tracks, cover art, and play statistics.</p>
            </div>
            <button
              @click="promptConfirm({ title: 'Delete library?', message: 'This will permanently delete all tracks from the database, remove all cover art, and clear your play statistics. This action cannot be undone.', confirmLabel: 'Delete Everything', destructive: true, onConfirm: deleteLibrary })"
              :disabled="deleting"
              class="text-sm px-4 py-2 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
            >
              <Icon v-if="!deleting" :path="mdiTrashCan" class="w-4 h-4" />
              <Icon v-else :path="mdiLoading" class="w-4 h-4 animate-spin" />
              {{ deleting ? 'Deleting...' : 'Delete Library' }}
            </button>
          </div>

          <!-- Delete result: success -->
          <div v-if="deleteResult && !deleteResult.error"
            class="flex items-center gap-2 text-sm rounded-lg px-4 py-3"
            :class="`text-${accentColor}-400`"
            :style="{ backgroundColor: `rgba(${accentRgb}, 0.1)` }"
          >
            <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
            Library deleted — {{ deleteResult.deletedTracks }} track{{ deleteResult.deletedTracks === 1 ? '' : 's' }} removed.
          </div>

          <!-- Delete result: error -->
          <div v-if="deleteResult?.error"
            class="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3"
          >
            <Icon :path="mdiAlertCircle" class="w-4 h-4 shrink-0" />
            {{ deleteResult.error }}
          </div>
        </div>
      </section>
    </div>

    <!-- Stats tab -->
    <div v-else-if="activeTab === 'stats'" class="space-y-4">
      <div v-if="statsLoading" class="space-y-4 animate-pulse">
        <!-- Library Overview + Formats skeleton -->
        <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <div class="h-3 bg-zinc-800 rounded w-36 mb-4"></div>
          <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
            <div v-for="i in 7" :key="i" class="bg-zinc-800/50 rounded-lg p-4">
              <div class="h-7 bg-zinc-800 rounded w-16 mb-2"></div>
              <div class="h-2.5 bg-zinc-800/60 rounded w-12"></div>
            </div>
          </div>
          <div class="border-t border-zinc-800 mt-6 pt-6 space-y-2 max-w-md">
            <div v-for="i in 3" :key="i" class="flex items-center gap-3">
              <div class="h-2.5 bg-zinc-800 rounded w-14"></div>
              <div class="flex-1 h-2 bg-zinc-800 rounded"></div>
              <div class="h-2.5 bg-zinc-800 rounded w-8"></div>
            </div>
          </div>
        </div>
        <!-- Most Played Tracks skeleton -->
        <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <div class="h-3 bg-zinc-800 rounded w-44 mb-4"></div>
          <div class="space-y-1">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-1 py-2">
              <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
              <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${55 + (i * 13) % 30}%` }"></div>
                <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${30 + (i * 17) % 25}%` }"></div>
              </div>
              <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
            </div>
          </div>
        </div>
        <!-- Top Artists skeleton -->
        <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <div class="h-3 bg-zinc-800 rounded w-28 mb-4"></div>
          <div class="space-y-1">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-1 py-2">
              <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${40 + (i * 11) % 35}%` }"></div>
                <div class="h-2.5 bg-zinc-800/60 rounded w-16"></div>
              </div>
              <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
            </div>
          </div>
        </div>
        <!-- Top Albums skeleton -->
        <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <div class="h-3 bg-zinc-800 rounded w-28 mb-4"></div>
          <div class="space-y-1">
            <div v-for="i in 5" :key="i" class="flex items-center gap-3 px-1 py-2">
              <div class="w-5 h-3 bg-zinc-800 rounded shrink-0"></div>
              <div class="w-8 h-8 bg-zinc-800 rounded shrink-0"></div>
              <div class="flex-1 min-w-0 space-y-1.5">
                <div class="h-3 bg-zinc-800 rounded" :style="{ width: `${45 + (i * 13) % 35}%` }"></div>
                <div class="h-2.5 bg-zinc-800/60 rounded" :style="{ width: `${25 + (i * 11) % 25}%` }"></div>
              </div>
              <div class="h-2.5 bg-zinc-800 rounded w-10"></div>
            </div>
          </div>
        </div>
      </div>

      <template v-else-if="stats">
        <!-- Library Overview -->
        <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Library Overview</h2>
          <div class="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display" :class="lovedUseAccent ? `text-${accentColor}-400` : 'text-rose-400'">{{ (stats.totalLoved || 0).toLocaleString() }}</div>
              <div class="text-xs text-zinc-400 mt-1">Loved</div>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display">{{ stats.totalTracks.toLocaleString() }}</div>
              <div class="text-xs text-zinc-400 mt-1">Tracks</div>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display">{{ stats.totalArtists.toLocaleString() }}</div>
              <div class="text-xs text-zinc-400 mt-1">Artists</div>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display">{{ stats.totalAlbums.toLocaleString() }}</div>
              <div class="text-xs text-zinc-400 mt-1">Albums</div>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display">{{ formatDuration(stats.totalDuration) }}</div>
              <div class="text-xs text-zinc-400 mt-1">Total Duration</div>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display">{{ formatSize(stats.totalFileSize) }}</div>
              <div class="text-xs text-zinc-400 mt-1">Library Size</div>
            </div>
            <div class="bg-zinc-800/50 rounded-lg p-4">
              <div class="text-2xl font-bold font-display">{{ stats.totalPlays.toLocaleString() }}</div>
              <div class="text-xs text-zinc-400 mt-1">Total Plays</div>
            </div>
          </div>

          <!-- Format Breakdown -->
          <div v-if="stats.formats.length > 0" class="border-t border-zinc-800 mt-6 pt-6 space-y-2 max-w-md">
            <div v-for="f in stats.formats" :key="f.format" class="flex items-center gap-3">
              <span class="text-sm text-zinc-300 w-14 text-right uppercase">{{ f.format || '?' }}</span>
              <div class="flex-1 h-2 bg-zinc-800 rounded overflow-hidden">
                <div
                  class="h-full rounded"
                  :style="{ width: (f.count / stats.totalTracks * 100) + '%', backgroundColor: `rgba(${accentRgb}, 0.6)` }"
                />
              </div>
              <span class="text-xs text-zinc-500 w-12">{{ f.count }}</span>
            </div>
          </div>
        </section>

        <!-- Most Played Tracks -->
        <section v-if="stats.topTracks.length > 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Most Played Tracks</h2>
          <TrackList :tracks="stats.topTracks" show-cover show-artist show-album show-plays hide-controls />
        </section>

        <!-- Top Artists -->
        <section v-if="stats.topArtists.length > 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Top Artists</h2>
          <table class="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800">
                <th class="text-center py-2 px-1 w-8">#</th>
                <th class="text-left py-2 px-3">Artist</th>
                <th class="text-right py-2 px-3 w-16">Plays</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(artist, i) in stats.topArtists"
                :key="artist.name"
                class="cursor-pointer [&:hover>td]:bg-zinc-800/50 [&>td]:transition-colors [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md [&:first-child>td:first-child]:rounded-tl-none [&:first-child>td:last-child]:rounded-tr-none"
                @click="router.push({ name: 'artist', params: { name: artist.name } })"
              >
                <td class="py-2 px-1 text-zinc-500 text-center">{{ i + 1 }}</td>
                <td class="py-2 px-3 max-w-0 overflow-hidden">
                  <div class="font-medium truncate">{{ artist.name }}</div>
                  <div class="text-xs text-zinc-500">{{ artist.trackCount }} track{{ artist.trackCount !== 1 ? 's' : '' }}</div>
                </td>
                <td class="py-2 px-3 text-right text-zinc-500">{{ artist.plays }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Top Albums -->
        <section v-if="stats.topAlbums.length > 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
          <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-4">Top Albums</h2>
          <table class="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr class="text-zinc-500 [&>th]:border-b [&>th]:border-zinc-800">
                <th class="text-center py-2 px-1 w-8">#</th>
                <th class="text-left py-2 px-3">Album</th>
                <th class="text-right py-2 px-3 w-16">Plays</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(album, i) in stats.topAlbums"
                :key="album.name"
                class="cursor-pointer [&:hover>td]:bg-zinc-800/50 [&>td]:transition-colors [&>td:first-child]:rounded-l-md [&>td:last-child]:rounded-r-md [&:first-child>td:first-child]:rounded-tl-none [&:first-child>td:last-child]:rounded-tr-none"
                @click="router.push({ name: 'album', params: { artist: album.artists?.[0], album: album.name } })"
              >
                <td class="py-2 px-1 text-zinc-500 text-center">{{ i + 1 }}</td>
                <td class="py-2 px-3 max-w-0 overflow-hidden">
                  <div class="flex items-center gap-2">
                    <CoverArt :cover="album.cover" size="w-8 h-8 shrink-0" />
                    <div class="min-w-0">
                      <div class="font-medium truncate">{{ album.name }}</div>
                      <div class="text-xs text-zinc-500 truncate">{{ album.artists?.join(', ') }}</div>
                    </div>
                  </div>
                </td>
                <td class="py-2 px-3 text-right text-zinc-500">{{ album.plays }}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <!-- Empty state -->
        <div v-if="stats.totalPlays === 0" class="bg-zinc-900 rounded-xl border border-zinc-800 p-10 flex flex-col items-center gap-3 text-center">
          <Icon :path="mdiHeadphones" class="w-8 h-8 text-zinc-600" />
          <p class="text-sm font-medium text-zinc-400">No listening data yet</p>
          <p class="text-xs text-zinc-600">Play some tracks and your stats will show up here.</p>
        </div>
      </template>
    </div>

    <p class="text-xs text-zinc-700 text-right mt-6">Noisling v{{ appVersion }}</p>

    <ConfirmModal
      :open="!!confirm"
      :title="confirm?.title"
      :message="confirm?.message"
      :confirm-label="confirm?.confirmLabel"
      :destructive="confirm?.destructive"
      @confirm="confirm.onConfirm(); closeConfirm()"
      @cancel="closeConfirm"
    />
  </div>
</template>
