import { onMounted, onUnmounted, ref } from 'vue';
import { useApi } from './useApi.js';

export function useSettingsLibrary() {
  const api = useApi();

  const scanning = ref(false);
  const scanPhase = ref(null);
  const scanPercent = ref(null);
  const scanProgress = ref(null);
  const scanResult = ref(null);
  const deleting = ref(false);
  const deleteResult = ref(null);
  const confirm = ref(null); // { title, message, confirmLabel, destructive, onConfirm }
  const missingCoverAlbums = ref([]);
  const loadingCovers = ref(false);
  const coversLoaded = ref(false);
  const showMissingCoversModal = ref(false);

  let eventSource = null;

  function promptConfirm(opts) {
    confirm.value = opts;
  }

  function closeConfirm() {
    confirm.value = null;
  }

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

    eventSource.addEventListener('library-updated', (e) => {
      if (scanning.value) {
        const data = JSON.parse(e.data);
        if (!data.cleared) scanResult.value = data;
        scanning.value = false;
      }
    });
  }

  async function loadMissingCovers() {
    if (coversLoaded.value) return;
    loadingCovers.value = true;

    try {
      const albums = await api.getAlbums();
      missingCoverAlbums.value = albums.filter(album => !album.cover);
      coversLoaded.value = true;
    } catch (err) {
      console.error('Failed to load albums:', err);
    } finally {
      loadingCovers.value = false;
    }
  }

  function openMissingCovers() {
    showMissingCoversModal.value = true;
    loadMissingCovers();
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

  onMounted(async () => {
    listenForProgress();

    try {
      const { scanning: inProgress } = await api.getScanStatus();
      if (inProgress) scanning.value = true;
    } catch {}
  });

  onUnmounted(() => {
    eventSource?.close();
    eventSource = null;
  });

  return {
    scanning,
    scanPhase,
    scanPercent,
    scanProgress,
    scanResult,
    deleting,
    deleteResult,
    confirm,
    missingCoverAlbums,
    loadingCovers,
    coversLoaded,
    showMissingCoversModal,
    promptConfirm,
    closeConfirm,
    openMissingCovers,
    scanLibrary,
    deleteLibrary,
  };
}
