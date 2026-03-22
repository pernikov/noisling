import { ref, watch } from 'vue';
import { useApi } from './useApi.js';
import { formatExactDuration } from '../utils/formatDuration.js';

export function useSettingsStats({ activeTab, playerState }) {
  const api = useApi();

  const stats = ref(null);
  const statsLoading = ref(false);
  const statsLoaded = ref(false);
  const statsOpen = ref({ overview: true, topTracks: false, topArtists: false, topAlbums: false });

  function toggleStats(key) {
    statsOpen.value[key] = !statsOpen.value[key];
  }

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

  watch(() => playerState.value.loveToggled, (change) => {
    if (!change || !stats.value) return;
    stats.value.totalLoved = (stats.value.totalLoved || 0) + (change.isLoved ? 1 : -1);
  });

  watch(() => playerState.value.playReportCount, async (count) => {
    if (count > 0 && activeTab.value === 'stats' && stats.value) {
      const fresh = await api.getStats();
      stats.value.totalPlays = fresh.totalPlays;
      stats.value.topTracks = fresh.topTracks;
      stats.value.topArtists = fresh.topArtists;
      stats.value.topAlbums = fresh.topAlbums;
    }
  });

  function formatDuration(seconds) {
    return formatExactDuration(seconds);
  }

  function formatSize(bytes) {
    if (!bytes) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  return {
    stats,
    statsLoading,
    statsLoaded,
    statsOpen,
    toggleStats,
    formatDuration,
    formatSize,
  };
}
