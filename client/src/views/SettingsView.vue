<script setup>
import { ref, watch, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  mdiFolderOpen,
  mdiMagnify,
  mdiCheck,
  mdiAlertCircle,
  mdiTrashCan,
  mdiImage,
  mdiFileQuestion,
  mdiContentDuplicate,
  mdiTextBoxSearchOutline,
  mdiPalette,
  mdiHeadphones,
  mdiChartBar,
  mdiViewAgenda,
  mdiViewHeadline,
  mdiClose,
  mdiChevronDown,
} from '@mdi/js';
import Icon from '../components/Icon.vue';
import Spinner from '../components/Spinner.vue';
import TabBar from '../components/TabBar.vue';
import { useTheme } from '../composables/useTheme.js';
import { usePlayer } from '../composables/usePlayer.js';
import { useSettingsLibrary } from '../composables/useSettingsLibrary.js';
import { useSettingsStats } from '../composables/useSettingsStats.js';
import ConfirmModal from '../components/ConfirmModal.vue';
import BaseModal from '../components/BaseModal.vue';
import TrackList from '../components/TrackList.vue';
import CoverArt from '../components/CoverArt.vue';
import IconButton from '../components/IconButton.vue';
import EditTrackMetadataModal from '../components/EditTrackMetadataModal.vue';
import EditAlbumCoverModal from '../components/EditAlbumCoverModal.vue';

const route = useRoute();
const router = useRouter();
const appVersion = __APP_VERSION__;
const {
  accentColor, accentRgb, themeColor, VALID_COLORS,
  density, showCoverArt, fontSize, sharpCorners, reduceMotion,
  lovedUseAccent, setLovedUseAccent,
  tracksColumns, setTracksColumn,
  showArtistsNav, wideLayout,
  homeShowQuickPlay, homeShowRecent, homeShowAlbums, homeVisibleCount,
  showPlaylists,
  setAccentColor, setThemeColor, setDensity, setShowCoverArt, setFontSize,
  setShowArtistsNav, setWideLayout, setHomeSection, setShowPlaylists, setSharpCorners, setReduceMotion,
} = useTheme();

const VALID_TABS = ['appearance', 'library', 'stats'];
const activeTab = ref(VALID_TABS.includes(route.query.tab) ? route.query.tab : 'appearance');
const TABS = [
  { value: 'appearance', label: 'Appearance', icon: mdiPalette },
  { value: 'library', label: 'Library', icon: mdiFolderOpen },
  { value: 'stats', label: 'Stats', icon: mdiChartBar },
];
const DENSITY_TABS = [
  { value: 'comfortable', label: 'Comfortable', icon: mdiViewAgenda },
  { value: 'compact', label: 'Compact', icon: mdiViewHeadline },
];
const FONT_SIZE_TABS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];
const HOME_SECTION_OPTIONS = [
  { key: 'quickPlay', label: 'Quick Play', desc: 'Shuffle All, Top Tracks, and Loved Tracks cards.' },
  { key: 'recent', label: 'Recently Played', desc: 'Your last 10 played tracks.' },
  { key: 'albums', label: 'Recently Added', desc: 'Albums added to your library.' },
];
const TRACK_COLUMN_OPTIONS = [
  { key: 'artist', label: 'Artist', desc: 'Primary artist column. Shown in Tracks, Recents, the home page, the queue, and search results.' },
  { key: 'album', label: 'Album', desc: 'Album column. Shown in Tracks, Recents, the home page, and search results.' },
  { key: 'plays', label: 'Plays', desc: 'Play count column. Shown in Tracks, Recents, and the home page.' },
  { key: 'lastPlayed', label: 'Last Played', desc: 'Last listened column. Shown in Tracks, Recents, and the home page.' },
];

watch(activeTab, (tab) => {
  router.replace({ query: { ...route.query, tab } });

  if (tab === 'library') {
    loadLibraryHealth();
  }
});

const { state: playerState } = usePlayer();
const playerStateRef = computed(() => playerState);

const {
  scanning,
  scanPhase,
  scanPercent,
  scanProgress,
  scanResult,
  deleting,
  deleteResult,
  confirm,
  missingCoverAlbums,
  unknownMetadataTracks,
  duplicateTrackGroups,
  inconsistentAlbums,
  loadingLibraryHealth,
  libraryHealthLoaded,
  showLibraryHealthModal,
  activeHealthView,
  promptConfirm,
  closeConfirm,
  loadLibraryHealth,
  openLibraryHealth,
  refreshLibraryHealth,
  scanLibrary,
  deleteLibrary,
} = useSettingsLibrary();

if (activeTab.value === 'library') {
  loadLibraryHealth();
}

const editingHealthTrack = ref(null);
const editingHealthAlbum = ref(null);

function openTrackEditor(track) {
  editingHealthTrack.value = track;
}

async function onHealthTrackSaved(updatedTrack) {
  if (editingHealthTrack.value) Object.assign(editingHealthTrack.value, updatedTrack);
  await refreshLibraryHealth();
}

function openAlbumCoverEditor(album) {
  editingHealthAlbum.value = album;
}

async function onHealthAlbumSaved() {
  await refreshLibraryHealth();
}

const {
  stats,
  statsLoading,
  statsOpen,
  toggleStats,
  formatDuration,
  formatSize,
} = useSettingsStats({
  activeTab,
  playerState: playerStateRef,
});

const homeSectionValues = computed(() => ({
  quickPlay: homeShowQuickPlay.value,
  recent: homeShowRecent.value,
  albums: homeShowAlbums.value,
}));

const LIBRARY_HEALTH_ITEMS = [
  {
    key: 'covers',
    title: 'Missing covers',
    icon: mdiImage,
    empty: 'All albums have artwork',
    summary: (loaded) => loaded
      ? `${missingCoverAlbums.value.length} album${missingCoverAlbums.value.length !== 1 ? 's' : ''} without artwork`
      : 'Albums in your library without artwork.',
  },
  {
    key: 'unknown',
    title: 'Unknown metadata',
    icon: mdiFileQuestion,
    empty: 'No tracks with unknown artist, album, or title',
    summary: (loaded) => loaded
      ? `${unknownMetadataTracks.value.length} track${unknownMetadataTracks.value.length !== 1 ? 's' : ''} need attention`
      : 'Tracks with missing artist, album, or title tags.',
  },
  {
    key: 'duplicates',
    title: 'Possible duplicates',
    icon: mdiContentDuplicate,
    empty: 'No duplicate groups detected',
    summary: (loaded) => loaded
      ? `${duplicateTrackGroups.value.length} duplicate group${duplicateTrackGroups.value.length !== 1 ? 's' : ''}`
      : 'Tracks that look like duplicate entries.',
  },
  {
    key: 'inconsistent',
    title: 'Inconsistent albums',
    icon: mdiTextBoxSearchOutline,
    empty: 'No album metadata mismatches found',
    summary: (loaded) => loaded
      ? `${inconsistentAlbums.value.length} album${inconsistentAlbums.value.length !== 1 ? 's' : ''} with metadata issues`
      : 'Albums with mixed years, album artists, or missing track numbers.',
  },
];

const activeLibraryHealthCount = computed(() => {
  switch (activeHealthView.value) {
    case 'covers': return missingCoverAlbums.value.length;
    case 'unknown': return unknownMetadataTracks.value.length;
    case 'duplicates': return duplicateTrackGroups.value.length;
    case 'inconsistent': return inconsistentAlbums.value.length;
    default: return 0;
  }
});

const activeLibraryHealthItem = computed(() =>
  LIBRARY_HEALTH_ITEMS.find(item => item.key === activeHealthView.value) ?? LIBRARY_HEALTH_ITEMS[0]
);

const libraryHealthInitialLoad = computed(() => loadingLibraryHealth.value && !libraryHealthLoaded.value);
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6 font-display">Settings</h1>

    <!-- Segmented Nav -->
    <TabBar v-model="activeTab" :tabs="TABS" class="mb-8" />

    <!-- Appearance tab -->
    <div v-if="activeTab === 'appearance'" class="space-y-6">
      <!-- Colors section -->
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        <div>
          <p class="text-sm font-medium text-zinc-200">Colors</p>
          <p class="text-xs text-zinc-500 mt-1">Accent, background, and highlight color options.</p>
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
            <span class="w-8 h-8 rounded-full opacity-0 pointer-events-none" aria-hidden="true" />
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Theme/background color -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-1">Background theme</p>
          <p class="text-xs text-zinc-500 mb-3">Tint the app background, or keep the original default dark look.</p>
          <div class="flex items-center gap-3 flex-wrap">
            <button
              v-for="color in VALID_COLORS"
              :key="`${color}-theme`"
              @click="setThemeColor(color)"
              class="w-8 h-8 rounded-full transition-all ring-offset-2 ring-offset-zinc-900"
              :class="[`bg-${color}-500`, themeColor === color ? `ring-2 ring-${color}-400` : 'hover:scale-110']"
              :aria-label="`${color} theme`"
              :aria-pressed="themeColor === color"
            />
            <button
              @click="setThemeColor('none')"
              class="relative w-8 h-8 rounded-full ring-offset-2 ring-offset-zinc-900 transition-all border"
              :class="themeColor === 'none' ? 'ring-2 ring-zinc-400 border-zinc-400 bg-zinc-700/30' : 'border-zinc-600 hover:scale-110 bg-zinc-900/30'"
              aria-label="Default background theme"
              :aria-pressed="themeColor === 'none'"
              title="Default"
            >
              <span class="absolute left-[6px] right-[6px] top-1/2 h-px -translate-y-1/2 -rotate-45 bg-zinc-300/90" />
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

      <!-- Display section -->
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
        <div>
          <p class="text-sm font-medium text-zinc-200">Display</p>
          <p class="text-xs text-zinc-500 mt-1">Density, scale, and text sizing.</p>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Density -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-1">List density</p>
          <p class="text-xs text-zinc-500 mb-3">Control how compact track lists and search results appear.</p>
          <TabBar
            :model-value="density"
            @update:model-value="setDensity"
            :tabs="DENSITY_TABS"
            size="sm"
          />
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Font size -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-1">Font size</p>
          <p class="text-xs text-zinc-500 mb-3">Scale the interface text up or down.</p>
          <TabBar
            :model-value="fontSize"
            @update:model-value="setFontSize"
            :tabs="FONT_SIZE_TABS"
            size="sm"
          />
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Sharp corners -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Sharp corners</p>
            <p class="text-xs text-zinc-500 mt-0.5">Remove all border radius for a flat, angular look.</p>
          </div>
          <button
            @click="setSharpCorners(!sharpCorners)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="sharpCorners ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="sharpCorners"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="sharpCorners ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Reduce motion -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Reduce motion</p>
            <p class="text-xs text-zinc-500 mt-0.5">Disable all transitions and animations.</p>
          </div>
          <button
            @click="setReduceMotion(!reduceMotion)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="reduceMotion ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="reduceMotion"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="reduceMotion ? 'translate-x-5' : 'translate-x-0'"
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
            <p class="text-xs text-zinc-500 mt-0.5">Show the Artists link in the navigation bar.</p>
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

        <!-- Playlists nav link -->
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Playlists</p>
            <p class="text-xs text-zinc-500 mt-0.5">Show the Playlists link in the navigation bar.</p>
          </div>
          <button
            @click="setShowPlaylists(!showPlaylists)"
            class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
            :class="showPlaylists ? `bg-${accentColor}-500` : 'bg-zinc-700'"
            role="switch"
            :aria-checked="showPlaylists"
          >
            <span
              class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
              :class="showPlaylists ? 'translate-x-5' : 'translate-x-0'"
            />
          </button>
        </div>

        <div class="border-t border-zinc-800" />

        <!-- Home sections -->
        <div>
          <p class="text-sm font-medium text-zinc-200 mb-3">Home page sections</p>
          <div class="space-y-3">
            <div
              v-for="section in HOME_SECTION_OPTIONS"
              :key="section.key"
              class="flex items-center justify-between"
            >
              <div>
                <p class="text-sm text-zinc-200">{{ section.label }}</p>
                <p class="text-xs text-zinc-500 mt-0.5">{{ section.desc }}</p>
              </div>
              <button
                @click="setHomeSection(section.key, !homeSectionValues[section.key])"
                :disabled="homeSectionValues[section.key] && homeVisibleCount <= 1"
                class="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                :class="homeSectionValues[section.key] ? `bg-${accentColor}-500` : 'bg-zinc-700 cursor-pointer'"
                role="switch"
                :aria-checked="homeSectionValues[section.key]"
              >
                <span
                  class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
                  :class="homeSectionValues[section.key] ? 'translate-x-5' : 'translate-x-0'"
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Tracks columns section -->
      <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-5">
        <div>
          <p class="text-sm font-medium text-zinc-200">Tracks view</p>
          <p class="text-xs text-zinc-500 mt-1">Customize what's visible in track lists and queues. Click any column header in Tracks to sort.</p>
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
            v-for="col in TRACK_COLUMN_OPTIONS"
            :key="col.key"
            class="flex items-center justify-between"
          >
            <div>
              <p class="text-sm text-zinc-200">{{ col.label }}</p>
              <p class="text-xs text-zinc-500 mt-0.5">{{ col.desc }}</p>
            </div>
            <button
              @click="setTracksColumn(col.key, !tracksColumns[col.key])"
              class="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none"
              :class="tracksColumns[col.key] ? `bg-${accentColor}-500` : 'bg-zinc-700'"
              role="switch"
              :aria-checked="tracksColumns[col.key]"
            >
              <span
                class="pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition duration-200"
                :class="tracksColumns[col.key] ? 'translate-x-5' : 'translate-x-0'"
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
            <IconButton
              :icon="mdiMagnify"
              :label="scanning ? 'Scanning...' : 'Scan Library'"
              :loading="scanning"
              :disabled="scanning"
              class="shrink-0"
              @click="promptConfirm({ title: 'Rescan library?', message: 'This will walk your music directory, process any new or changed files, and remove tracks for deleted files. It may take a while for large libraries.', confirmLabel: 'Scan Library', destructive: false, onConfirm: scanLibrary })"
            />
          </div>

          <!-- Scan progress -->
          <div v-if="scanning" class="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div v-if="!scanPhase" class="flex items-center gap-2 text-sm text-zinc-400">
              <Spinner class="w-4 h-4 text-zinc-500" />
              Starting scan...
            </div>
            <div v-if="scanPhase === 'walking'" class="flex items-center gap-2 text-sm text-zinc-300">
              <Spinner class="w-4 h-4 text-zinc-400" />
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
            style="background-color: rgba(16, 185, 129, 0.1)"
          >
            <div class="flex items-center gap-2 text-sm text-emerald-400">
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

        <div class="space-y-4">
          <div>
            <p class="text-sm font-medium text-zinc-200">Library health</p>
            <p class="text-xs text-zinc-500">Spot missing metadata, duplicates, and album-level inconsistencies.</p>
          </div>

          <div class="grid gap-3">
            <div
              v-for="item in LIBRARY_HEALTH_ITEMS"
              :key="item.key"
              class="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-800/30 px-4 py-3"
            >
              <div class="flex items-start gap-3 min-w-0">
                <div class="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center shrink-0">
                  <Icon :path="item.icon" class="w-4 h-4 text-zinc-400" />
                </div>
                <div class="min-w-0">
                  <p class="text-sm font-medium text-zinc-200">{{ item.title }}</p>
                  <div v-if="libraryHealthInitialLoad" class="mt-1.5 space-y-1 animate-pulse">
                    <div class="h-2.5 w-32 rounded bg-zinc-800" />
                    <div class="h-2.5 w-24 rounded bg-zinc-800/70" />
                  </div>
                  <p v-else class="text-xs text-zinc-500 mt-0.5">
                    <template v-if="libraryHealthLoaded && item.summary(true).startsWith('0 ')">{{ item.empty }}</template>
                    <template v-else>{{ item.summary(libraryHealthLoaded) }}</template>
                  </p>
                </div>
              </div>
              <IconButton
                :icon="item.icon"
                :label="loadingLibraryHealth && !showLibraryHealthModal ? 'Loading...' : 'View'"
                :loading="loadingLibraryHealth && !showLibraryHealthModal"
                :disabled="libraryHealthInitialLoad"
                class="shrink-0"
                @click="openLibraryHealth(item.key)"
              />
            </div>
          </div>
        </div>

        <div class="border-t border-zinc-800" />

        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-zinc-200">Delete library</p>
              <p class="text-xs text-zinc-500">Remove all tracks, cover art, and play statistics.</p>
            </div>
            <IconButton
              :icon="mdiTrashCan"
              :label="deleting ? 'Deleting...' : 'Delete Library'"
              :loading="deleting"
              :disabled="deleting"
              variant="destructive"
              class="shrink-0"
              @click="promptConfirm({ title: 'Delete library?', message: 'This will permanently delete all tracks from the database, remove all cover art, and clear your play statistics. This action cannot be undone.', confirmLabel: 'Delete Everything', destructive: true, onConfirm: deleteLibrary })"
            />
          </div>

          <!-- Delete result: success -->
          <div v-if="deleteResult && !deleteResult.error"
            class="flex items-center gap-2 text-sm rounded-lg px-4 py-3 text-emerald-400"
            style="background-color: rgba(16, 185, 129, 0.1)"
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
        <section class="bg-zinc-900 rounded-xl border border-zinc-800 px-6 py-4">
          <button class="flex items-center justify-between w-full" @click="toggleStats('overview')">
            <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider">Library Overview</h2>
            <Icon :path="mdiChevronDown" class="w-4 h-4 text-zinc-500 transition-transform duration-200" :class="statsOpen.overview ? '' : '-rotate-90'" />
          </button>
          <div v-show="statsOpen.overview" class="mt-4">
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
          </div>
        </section>

        <!-- Most Played Tracks -->
        <section v-if="stats.topTracks.length > 0" class="bg-zinc-900 rounded-xl border border-zinc-800 px-6 py-4">
          <button class="flex items-center justify-between w-full" @click="toggleStats('topTracks')">
            <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider">Most Played Tracks</h2>
            <Icon :path="mdiChevronDown" class="w-4 h-4 text-zinc-500 transition-transform duration-200" :class="statsOpen.topTracks ? '' : '-rotate-90'" />
          </button>
          <div v-show="statsOpen.topTracks" class="mt-4">
            <TrackList :tracks="stats.topTracks" show-cover show-artist show-album show-plays hide-controls />
          </div>
        </section>

        <!-- Top Artists -->
        <section v-if="stats.topArtists.length > 0" class="bg-zinc-900 rounded-xl border border-zinc-800 px-6 py-4">
          <button class="flex items-center justify-between w-full" @click="toggleStats('topArtists')">
            <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider">Top Artists</h2>
            <Icon :path="mdiChevronDown" class="w-4 h-4 text-zinc-500 transition-transform duration-200" :class="statsOpen.topArtists ? '' : '-rotate-90'" />
          </button>
          <div v-show="statsOpen.topArtists" class="mt-4">
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
          </div>
        </section>

        <!-- Top Albums -->
        <section v-if="stats.topAlbums.length > 0" class="bg-zinc-900 rounded-xl border border-zinc-800 px-6 py-4">
          <button class="flex items-center justify-between w-full" @click="toggleStats('topAlbums')">
            <h2 class="text-sm font-medium text-zinc-500 uppercase tracking-wider">Top Albums</h2>
            <Icon :path="mdiChevronDown" class="w-4 h-4 text-zinc-500 transition-transform duration-200" :class="statsOpen.topAlbums ? '' : '-rotate-90'" />
          </button>
          <div v-show="statsOpen.topAlbums" class="mt-4">
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
          </div>
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

    <BaseModal :show="showLibraryHealthModal" @close="showLibraryHealthModal = false">
      <div class="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        <!-- Header -->
        <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <p class="text-sm font-medium text-zinc-200">{{ activeLibraryHealthItem.title }}</p>
            <div v-if="loadingLibraryHealth" class="flex items-center gap-2 text-xs text-zinc-500 mt-1">
              <Spinner class="w-3.5 h-3.5 text-zinc-500" />
              Loading library health...
            </div>
            <p v-else-if="libraryHealthLoaded" class="text-xs text-zinc-500 mt-0.5">
              <template v-if="activeLibraryHealthCount === 0">{{ activeLibraryHealthItem.empty }}</template>
              <template v-else>{{ activeLibraryHealthItem.summary(true) }}</template>
            </p>
          </div>
          <button
            @click="showLibraryHealthModal = false"
            class="p-1.5 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            <Icon :path="mdiClose" class="w-4 h-4" />
          </button>
        </div>

        <!-- Body -->
        <div class="overflow-y-auto p-2">
          <div v-if="loadingLibraryHealth" class="space-y-2 p-1 animate-pulse">
            <div
              v-for="i in 4"
              :key="i"
              class="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-800/20 px-3 py-3"
            >
              <div class="w-8 h-8 rounded bg-zinc-800 shrink-0" />
              <div class="flex-1 min-w-0 space-y-2">
                <div class="h-3 rounded bg-zinc-800" :style="{ width: `${50 + (i * 9) % 25}%` }" />
                <div class="h-2.5 rounded bg-zinc-800/70" :style="{ width: `${35 + (i * 11) % 30}%` }" />
              </div>
              <div class="w-14 h-8 rounded-lg bg-zinc-800 shrink-0" />
            </div>
          </div>

          <div v-else-if="activeHealthView === 'covers' && missingCoverAlbums.length === 0"
            class="flex items-center gap-2 text-sm text-emerald-400 rounded-lg px-4 py-3 m-1"
            style="background-color: rgba(16, 185, 129, 0.1)"
          >
            <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
            All albums have artwork
          </div>

          <template v-else-if="activeHealthView === 'covers'">
            <div
              v-for="album in missingCoverAlbums"
              :key="album.name + album.artists?.[0]"
              class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/60 transition-colors"
            >
              <div class="w-8 h-8 rounded bg-zinc-700 flex items-center justify-center shrink-0">
                <Icon :path="mdiImage" class="w-4 h-4 text-zinc-500" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ album.name }}</div>
                <div class="text-xs text-zinc-500 truncate">{{ album.artists?.join(', ') }}</div>
              </div>
              <span class="text-xs text-zinc-500 shrink-0">{{ album.trackCount }} track{{ album.trackCount !== 1 ? 's' : '' }}</span>
              <IconButton :icon="mdiImage" label="Upload" class="shrink-0" @click="openAlbumCoverEditor(album)" />
            </div>
          </template>

          <div v-else-if="activeHealthView === 'unknown' && unknownMetadataTracks.length === 0"
            class="flex items-center gap-2 text-sm text-emerald-400 rounded-lg px-4 py-3 m-1"
            style="background-color: rgba(16, 185, 129, 0.1)"
          >
            <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
            No tracks with unknown artist, album, or title
          </div>

          <template v-else-if="activeHealthView === 'unknown'">
            <div
              v-for="track in unknownMetadataTracks"
              :key="track._id"
              class="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-zinc-800/60 transition-colors"
            >
              <CoverArt :cover="track.cover" size="w-8 h-8 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ track.title }}</div>
                <div class="text-xs text-zinc-500 truncate">{{ track.artists?.join(', ') }} • {{ track.album }}</div>
              </div>
              <span class="text-xs text-amber-400 shrink-0">{{ track.issueSummary }}</span>
              <IconButton :icon="mdiFileQuestion" label="Fix" class="shrink-0" @click="openTrackEditor(track)" />
            </div>
          </template>

          <div v-else-if="activeHealthView === 'duplicates' && duplicateTrackGroups.length === 0"
            class="flex items-center gap-2 text-sm text-emerald-400 rounded-lg px-4 py-3 m-1"
            style="background-color: rgba(16, 185, 129, 0.1)"
          >
            <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
            No duplicate groups detected
          </div>

          <template v-else-if="activeHealthView === 'duplicates'">
            <div
              v-for="group in duplicateTrackGroups"
              :key="group.key"
              class="rounded-lg border border-zinc-800 bg-zinc-800/20 p-3 m-1 space-y-2"
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm font-medium truncate">{{ group.title }}</div>
                  <div class="text-xs text-zinc-500 truncate">{{ group.artists?.join(', ') }}</div>
                </div>
                <span class="text-xs text-amber-400 shrink-0">{{ group.tracks.length }} matches</span>
              </div>
              <router-link
                v-for="track in group.tracks"
                :key="track._id"
                :to="{ name: 'album', params: { artist: track.artists?.[0], album: track.album } }"
                class="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-zinc-800/70 transition-colors"
                @click="showLibraryHealthModal = false"
              >
                <div class="min-w-0">
                  <div class="text-sm truncate">{{ track.album }}</div>
                  <div class="text-xs text-zinc-500 truncate">
                    Disc {{ track.disc || 1 }} • Track {{ track.trackNumber || '?' }} • {{ Math.round(track.duration || 0) }}s
                  </div>
                </div>
              </router-link>
            </div>
          </template>

          <div v-else-if="activeHealthView === 'inconsistent' && inconsistentAlbums.length === 0"
            class="flex items-center gap-2 text-sm text-emerald-400 rounded-lg px-4 py-3 m-1"
            style="background-color: rgba(16, 185, 129, 0.1)"
          >
            <Icon :path="mdiCheck" class="w-4 h-4 shrink-0" />
            No album metadata mismatches found
          </div>

          <template v-else-if="activeHealthView === 'inconsistent'">
            <router-link
              v-for="album in inconsistentAlbums"
              :key="album.name + album.artists?.[0]"
              :to="{ name: 'album', params: { artist: album.artists?.[0], album: album.name } }"
              class="flex items-start gap-3 px-3 py-3 rounded-md hover:bg-zinc-800/60 transition-colors"
              @click="showLibraryHealthModal = false"
            >
              <CoverArt :cover="null" size="w-8 h-8 shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="text-sm font-medium truncate">{{ album.name }}</div>
                <div class="text-xs text-zinc-500 truncate">{{ album.artists?.join(', ') }}</div>
                <div class="text-xs text-amber-400 mt-1">{{ album.issues.join(' • ') }}</div>
              </div>
            </router-link>
          </template>
        </div>
      </div>
    </BaseModal>

    <EditTrackMetadataModal
      v-if="editingHealthTrack"
      :track="editingHealthTrack"
      @close="editingHealthTrack = null"
      @saved="onHealthTrackSaved"
    />

    <EditAlbumCoverModal
      v-if="editingHealthAlbum"
      :artist="editingHealthAlbum.artists?.[0] || ''"
      :album="editingHealthAlbum.name"
      :cover="editingHealthAlbum.cover || ''"
      :has-custom-cover="!!editingHealthAlbum.hasCustomCover"
      @close="editingHealthAlbum = null"
      @saved="onHealthAlbumSaved"
    />
  </div>
</template>
