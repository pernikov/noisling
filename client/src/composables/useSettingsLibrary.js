import { onMounted, onUnmounted, ref } from 'vue';
import { useApi } from './useApi.js';

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isUnknownValue(value, fallback) {
  const normalized = normalizeText(value);
  return !normalized || normalized === fallback;
}

function buildAlbumKey(track) {
  return `${normalizeText(track.artists?.[0])}__${normalizeText(track.album)}`;
}

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
  const unknownMetadataTracks = ref([]);
  const duplicateTrackGroups = ref([]);
  const inconsistentAlbums = ref([]);
  const loadingLibraryHealth = ref(false);
  const libraryHealthLoaded = ref(false);
  const showLibraryHealthModal = ref(false);
  const activeHealthView = ref('covers');

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

  async function loadLibraryHealth() {
    if (libraryHealthLoaded.value) return;
    loadingLibraryHealth.value = true;

    try {
      const tracks = await api.getAllTracks();

      const missingCovers = new Map();
      const albumGroups = new Map();
      const duplicateGroups = new Map();
      const unknownTracks = [];

      for (const track of tracks) {
        const primaryArtist = track.artists?.[0] ?? 'Unknown Artist';
        const album = track.album ?? 'Unknown Album';
        const albumKey = buildAlbumKey(track);
        const titleUnknown = isUnknownValue(track.title, 'unknown title');
        const artistUnknown = !track.artists?.length || track.artists.some((artist) => isUnknownValue(artist, 'unknown artist'));
        const albumUnknown = isUnknownValue(album, 'unknown album');

        if (titleUnknown || artistUnknown || albumUnknown) {
          unknownTracks.push({
            ...track,
            issueSummary: [
              titleUnknown ? 'Unknown title' : null,
              artistUnknown ? 'Unknown artist' : null,
              albumUnknown ? 'Unknown album' : null,
            ].filter(Boolean).join(' • '),
          });
        }

        if (!track.cover && !missingCovers.has(albumKey)) {
          missingCovers.set(albumKey, {
            name: album,
            artists: track.artists,
            trackCount: 1,
          });
        } else if (!track.cover) {
          missingCovers.get(albumKey).trackCount += 1;
        }

        if (!albumGroups.has(albumKey)) {
          albumGroups.set(albumKey, {
            name: album,
            artists: track.artists,
            years: new Set(),
            albumArtists: new Set(),
            missingTrackNumbers: 0,
          });
        }

        const albumGroup = albumGroups.get(albumKey);
        if (track.year > 0) albumGroup.years.add(track.year);
        if (normalizeText(track.albumArtist)) albumGroup.albumArtists.add(track.albumArtist.trim());
        if (!track.trackNumber || track.trackNumber < 1) albumGroup.missingTrackNumbers += 1;

        const durationBucket = Math.round((track.duration || 0) / 2);
        const duplicateKey = `${normalizeText(primaryArtist)}__${normalizeText(track.title)}__${durationBucket}`;
        if (!duplicateGroups.has(duplicateKey)) duplicateGroups.set(duplicateKey, []);
        duplicateGroups.get(duplicateKey).push(track);
      }

      missingCoverAlbums.value = Array.from(missingCovers.values())
        .sort((a, b) => a.name.localeCompare(b.name) || (a.artists?.[0] || '').localeCompare(b.artists?.[0] || ''));

      unknownMetadataTracks.value = unknownTracks
        .sort((a, b) => (a.title || '').localeCompare(b.title || '') || (a.artists?.[0] || '').localeCompare(b.artists?.[0] || ''));

      duplicateTrackGroups.value = Array.from(duplicateGroups.values())
        .filter((group) => group.length > 1)
        .map((group) => ({
          key: `${group[0].artists?.[0] || ''}-${group[0].title || ''}-${group[0].duration || 0}`,
          title: group[0].title,
          artists: group[0].artists,
          duration: group[0].duration,
          tracks: group.slice().sort((a, b) => (a.album || '').localeCompare(b.album || '') || (a.disc || 0) - (b.disc || 0) || (a.trackNumber || 0) - (b.trackNumber || 0)),
        }))
        .sort((a, b) => b.tracks.length - a.tracks.length || (a.title || '').localeCompare(b.title || ''));

      inconsistentAlbums.value = Array.from(albumGroups.values())
        .map((album) => ({
          ...album,
          issues: [
            album.years.size > 1 ? 'Mixed years' : null,
            album.albumArtists.size > 1 ? 'Mixed album artists' : null,
            album.missingTrackNumbers > 0 ? `Missing track numbers (${album.missingTrackNumbers})` : null,
          ].filter(Boolean),
        }))
        .filter((album) => album.issues.length > 0)
        .sort((a, b) => b.issues.length - a.issues.length || a.name.localeCompare(b.name));

      libraryHealthLoaded.value = true;
    } catch (err) {
      console.error('Failed to load library health:', err);
    } finally {
      loadingLibraryHealth.value = false;
    }
  }

  function openLibraryHealth(view) {
    activeHealthView.value = view;
    showLibraryHealthModal.value = true;
    loadLibraryHealth();
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
    unknownMetadataTracks,
    duplicateTrackGroups,
    inconsistentAlbums,
    loadingLibraryHealth,
    libraryHealthLoaded,
    showLibraryHealthModal,
    activeHealthView,
    promptConfirm,
    closeConfirm,
    openLibraryHealth,
    scanLibrary,
    deleteLibrary,
  };
}
