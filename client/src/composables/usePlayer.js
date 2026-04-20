import { reactive, watch } from 'vue';
import { useApi } from './useApi.js';
import { createPlayerQueue } from './playerQueue.js';
import { createPlayerMediaSession } from './playerMediaSession.js';
import { createPlayerRecovery } from './playerRecovery.js';
import { createPlayerVisualizer } from './playerVisualizer.js';
import { readPlayerPrefs, writePlayerPrefs } from './playerPrefs.js';

const api = useApi();
const HANDOFF_DEBUG_KEY = 'noisling_debug_handoff';

// usePlayer keeps the shared Audio element, persisted player prefs, and the
// high-level playback flow. Queue mechanics, Media Session wiring, recovery,
// and visualizer/audio-context helpers live in their dedicated modules.

// Detect which formats this browser can't play natively.
// Checked once at module load — canPlayType returns '' for unsupported formats.
// Treat 'maybe' as unsupported too — it's not a confident yes.
const _probe = new Audio();
const UNSUPPORTED_FORMATS = new Set(
  Object.entries({
    flac: 'audio/flac',
    ogg:  'audio/ogg',
    opus: 'audio/ogg; codecs=opus',
    wma:  'audio/x-ms-wma',
  })
    .filter(([, mime]) => _probe.canPlayType(mime) !== 'probably')
    .map(([fmt]) => fmt)
);


function needsTranscode(track) {
  return UNSUPPORTED_FORMATS.has((track.format || '').toLowerCase());
}

function isHandoffDebugEnabled() {
  try {
    return localStorage.getItem(HANDOFF_DEBUG_KEY) === '1';
  } catch (_) {
    return false;
  }
}

function debugHandoff(label, details = {}) {
  if (!isHandoffDebugEnabled()) return;
  const currentTrack = details.track ?? state.currentTrack;
  const payload = {
    label,
    trackId: currentTrack?._id ?? null,
    title: currentTrack?.title ?? '',
    seq: _trackStartSeq,
    currentTime: Number.isFinite(audio.currentTime) ? Number(audio.currentTime.toFixed(3)) : null,
    stateTime: Number.isFinite(state.currentTime) ? Number(state.currentTime.toFixed(3)) : null,
    duration: Number.isFinite(state.duration) ? Number(state.duration.toFixed(3)) : null,
    readyState: audio.readyState,
    networkState: audio.networkState,
    paused: audio.paused,
    ended: audio.ended,
    progressLocked: state.progressLocked,
    mediaSessionLocked: state.mediaSessionLocked,
    transcodeWaiting: state.transcodeWaiting,
    transcodeActive: state.transcodeActive,
    hidden: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
    ...details,
  };
  delete payload.track;
  console.log('[handoff]', payload);
}

// ─── Persistence keys ────────────────────────────────────────────────────────

// Parse saved prefs synchronously so state initialises from them immediately.
const _savedPrefs = readPlayerPrefs();

// ─────────────────────────────────────────────────────────────────────────────

const audio = new Audio();

const state = reactive({
  currentTrack:      null,
  queue:             [],
  queueIndex:        -1,
  // For large queues (e.g. Shuffle All):
  //   largeQueueIds     = all shuffled IDs held client-side (no server state)
  //   queueLoading      = true while background batch-fetch is in progress
  //   queueTotal        = total expected tracks (shown while loading)
  //   queueBufferOffset = virtual index of state.queue[0] in the full list
  //   isLargeQueue      = true when buffer mode is active
  // For normal queues all are 0 / false and state.queue holds everything.
  largeQueueIds:     [],
  queueLoading:      false,
  queueTotal:        0,
  queueBufferOffset: 0,
  isLargeQueue:      false,
  isPlaying:         false,
  currentTime:       0,
  duration:          0,
  progressLocked:    false,
  mediaSessionLocked: false,
  volume:         (typeof _savedPrefs.volume === 'number')  ? Math.max(0, Math.min(1, _savedPrefs.volume)) : 1,
  shuffle:        false,
  repeat:         'off',
  originalQueue:     [],
  showVisualizer:    false,
  showNowPlaying:    false,
  showQueue:         false,
  showShortcuts:     false,
  showAddToPlaylist: false,
  playReportCount:   0,
  currentTrackReported: true,
  currentTrackPlayProgress: 0,
  lastReportedTrackId: null,
  lastReportedPlayCount: null,
  visualizerTrackTick: 0,
  transcodeWaiting:  false,
  transcodeActive:   false,
  loveToggled:       null, // { id, isLoved } — updated on every love toggle so any component can react
});

// Apply saved volume to the audio element immediately.
audio.volume = state.volume;

let playReported = false;
let playedSeconds = 0;
let _lastUpdateTime = null;

// One-time seek target after a page-reload restore.
// Bound to a specific track so it cannot leak into a different track.
let _pendingRestore = null;
let _trackStartSeq = 0;
let _startupResetActive = false;
let _trackStartedAtMs = 0;
let _allowBackwardTimeUntilMs = 0;
let _mediaSessionStableTicks = 0;

const STARTUP_TIME_REGRESSION_GUARD_MS = 12000;
const BACKWARD_TIME_JUMP_TOLERANCE_S = 0.35;
const MEDIA_SESSION_STABILIZE_TICKS = 6;
const MEDIA_SESSION_STABILIZE_TIME_S = 2;

// Throttle MediaSession position updates to once per second.
let positionStateTimer = null;

// Debounce volume server saves.
let _volumeSaveTimer = null;

function getAdaptiveTranscodeWaitMs(track, { hidden = false } = {}) {
  let waitMs = 8000;
  const duration = Number(track?.duration) || 0;
  const format = String(track?.format || '').toLowerCase();

  if (hidden) waitMs += 6000;
  if (duration >= 10 * 60) waitMs += 6000;
  if (duration >= 30 * 60) waitMs += 4000;
  if (format === 'flac') waitMs += 4000;
  if (format === 'opus' || format === 'ogg') waitMs += 2000;

  return Math.min(waitMs, 30000);
}

function _setTrackSource(track, { forceTranscode = false, markWaiting = true, cacheBust = false } = {}) {
  const transcode = forceTranscode || needsTranscode(track);
  state.transcodeActive = transcode;
  state.transcodeWaiting = transcode && markWaiting;
  const url = transcode
    ? api.transcodedStreamUrl(track._id)
    : api.streamUrl(track._id, false);
  audio.src = cacheBust ? `${url}${url.includes('?') ? '&' : '?'}r=${Date.now()}` : url;
  return transcode;
}

function isPlaybackHidden() {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

function isAppleMobileEnvironment() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const maxTouchPoints = navigator.maxTouchPoints || 0;
  return /iPhone|iPad|iPod/i.test(ua)
    || (platform === 'MacIntel' && maxTouchPoints > 1);
}

function resetAudioForTrackStart() {
  try {
    audio.currentTime = 0;
  } catch (_) {
    // Safari can throw if the previous source is already in a torn-down state.
  }
  audio.removeAttribute('src');
  audio.load();
}

function beginTrackStartupResetWindow() {
  _trackStartSeq += 1;
  _startupResetActive = true;
  _trackStartedAtMs = Date.now();
  _allowBackwardTimeUntilMs = 0;
  _mediaSessionStableTicks = 0;
  return _trackStartSeq;
}

function endTrackStartupResetWindow() {
  _startupResetActive = false;
}

function allowBackwardTimeJumpsFor(ms = 1500) {
  _allowBackwardTimeUntilMs = Math.max(_allowBackwardTimeUntilMs, Date.now() + ms);
}

function maybeUnlockMediaSession(nextTime) {
  if (!state.mediaSessionLocked) return;
  _mediaSessionStableTicks += 1;
  const stableEnough = _mediaSessionStableTicks >= MEDIA_SESSION_STABILIZE_TICKS
    || nextTime >= MEDIA_SESSION_STABILIZE_TIME_S;
  if (!stableEnough) return;
  state.mediaSessionLocked = false;
  debugHandoff('media-session:stabilized', { nextTime, stableTicks: _mediaSessionStableTicks });
  updateMediaSessionPositionState();
  setPlaybackState(true);
}

async function waitForTranscodeReady(trackId, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const { status } = await api.warmTranscode(trackId);
    if (status === 'ready') return true;
    await new Promise(r => setTimeout(r, 250));
  }
  return false;
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function savePrefs(updates) {
  writePlayerPrefs(updates);
}

function resetPlayTracking() {
  playReported = false;
  state.currentTrackReported = false;
  state.currentTrackPlayProgress = 0;
  playedSeconds = 0;
  _lastUpdateTime = null;
}

function updateCurrentTrackLove(track, isLoved) {
  track.isLoved = isLoved;
  if (state.currentTrack?._id === track._id) {
    state.currentTrack.isLoved = isLoved;
  }
}

function markCurrentTrackReported(trackId, playCount = null) {
  const currentTrackId = state.currentTrack?._id?.toString?.() ?? state.currentTrack?._id ?? null;
  const normalizedTrackId = trackId?.toString?.() ?? trackId ?? null;
  if (!currentTrackId || currentTrackId !== normalizedTrackId || !state.currentTrack) return;

  state.currentTrack.playCount = Number.isFinite(playCount)
    ? playCount
    : (state.currentTrack.playCount || 0) + 1;
  state.currentTrack.lastPlayedAt = new Date().toISOString();
}

function warmNextQueuedTrack() {
  for (let offset = 1; offset <= 2; offset += 1) {
    const nextIdx = state.queueIndex + offset;
    if (nextIdx >= state.queue.length) break;
    const nextTrack = state.queue[nextIdx];
    if (needsTranscode(nextTrack)) api.warmTranscode(nextTrack._id);
  }
}

function registerPlayerEventListeners() {
  audio.addEventListener('loadstart', () => {
    debugHandoff('audio:loadstart');
    if (!_startupResetActive) return;
    state.currentTime = 0;
    state.progressLocked = true;
  });

  audio.addEventListener('emptied', () => {
    debugHandoff('audio:emptied');
    if (!_startupResetActive) return;
    state.currentTime = 0;
  });

  audio.addEventListener('canplay', () => {
    debugHandoff('audio:canplay');
  });

  audio.addEventListener('seeking', () => {
    debugHandoff('audio:seeking');
  });

  audio.addEventListener('seeked', () => {
    debugHandoff('audio:seeked');
  });

  audio.addEventListener('timeupdate', () => {
    const nextTime = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    const previousTime = state.currentTime;

    if (state.progressLocked) {
      debugHandoff('audio:timeupdate:locked', { nextTime });
      if (nextTime <= 0.05) {
        state.currentTime = 0;
        return;
      }
      state.progressLocked = false;
      endTrackStartupResetWindow();
      if (!state.mediaSessionLocked) {
        updateMediaSessionPositionState();
        setPlaybackState(true);
      }
      if (!audio.paused && _lastUpdateTime === null) {
        playedSeconds = Math.max(playedSeconds, nextTime);
      }
    }

    const startupGuardActive = (
      Date.now() - _trackStartedAtMs <= STARTUP_TIME_REGRESSION_GUARD_MS
      && Date.now() > _allowBackwardTimeUntilMs
      && nextTime + BACKWARD_TIME_JUMP_TOLERANCE_S < state.currentTime
    );
    if (startupGuardActive) {
      debugHandoff('audio:timeupdate:regression_ignored', { previousTime, nextTime });
      _lastUpdateTime = nextTime;
      return;
    }

    if (nextTime < 5 || Math.abs(nextTime - previousTime) > 1) {
      debugHandoff('audio:timeupdate', { previousTime, nextTime });
    }

    state.currentTime = nextTime;
    maybeUnlockMediaSession(nextTime);

    if (!audio.paused && _lastUpdateTime !== null) {
      const delta = nextTime - _lastUpdateTime;
      if (delta > 0 && delta < 2) playedSeconds += delta;
    }
    _lastUpdateTime = nextTime;

    if (!playReported && state.currentTrack && audio.duration > 0) {
      const threshold = Math.min(audio.duration * 0.5, 240);
      state.currentTrackPlayProgress = threshold > 0
        ? Math.max(0, Math.min(1, playedSeconds / threshold))
        : 0;
      if (playedSeconds >= threshold) {
        playReported = true;
        const reportedTrackId = state.currentTrack._id;
        api.reportPlay(state.currentTrack._id)
          .then((report) => {
            const reportedPlayCount = Number(report?.playCount);
            const canonicalPlayCount = Number.isFinite(reportedPlayCount) ? reportedPlayCount : null;
            markCurrentTrackReported(reportedTrackId, canonicalPlayCount);
            state.currentTrackReported = true;
            state.currentTrackPlayProgress = 1;
            state.lastReportedTrackId = reportedTrackId;
            state.lastReportedPlayCount = canonicalPlayCount;
            state.playReportCount++;
          })
          .catch(() => {});
      }
    }

    if (!positionStateTimer) {
      positionStateTimer = setTimeout(() => {
        updateMediaSessionPositionState();
        positionStateTimer = null;
      }, 1000);
    }
  });

  audio.addEventListener('error', handleError);

  audio.addEventListener('loadedmetadata', () => {
    debugHandoff('audio:loadedmetadata');
    const audioDuration = isFinite(audio.duration) ? audio.duration : 0;
    const trackDuration = state.currentTrack?.duration ?? 0;
    state.duration = Math.max(audioDuration, trackDuration) || 0;
    updateMediaSessionPositionState();

    if (_pendingRestore) {
      const { trackId, time } = _pendingRestore;
      const currentId = state.currentTrack?._id?.toString?.();
      if (trackId && currentId && trackId === currentId) {
        if (audio.seekable.length > 0 && state.duration > 0 && time < state.duration - 3) {
          allowBackwardTimeJumpsFor();
          debugHandoff('audio:restore_seek', { restoreTime: time });
          audio.currentTime = time;
        }
      }
      _pendingRestore = null;
    }
  });

  audio.addEventListener('playing', () => {
    debugHandoff('audio:playing');
    state.transcodeWaiting = false;
  });

  audio.addEventListener('ended', handleEnded);

  audio.addEventListener('play', () => {
    debugHandoff('audio:play');
    state.isPlaying = true;
    setConsecutiveErrors(0);
    setPlaybackState(!state.progressLocked);
  });

  audio.addEventListener('pause', () => {
    debugHandoff('audio:pause');
    state.isPlaying = false;
    state.mediaSessionLocked = false;
    setPlaybackState(false);
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncPlaybackStateFromElement();
  });
}


async function loadPlayerPrefs() {
  try {
    const data = await api.getSettings();
    const updates = {};
    if (typeof data.volume === 'number') {
      state.volume = Math.max(0, Math.min(1, data.volume));
      audio.volume = state.volume;
      updates.volume = state.volume;
    }
    if (Object.keys(updates).length) savePrefs(updates);
  } catch (_) {
    // fall back to localStorage values already applied at init
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function play(track) {
  const previousTrackId = state.currentTrack?._id?.toString?.() ?? null;
  const nextTrackId = track?._id?.toString?.() ?? null;
  if (nextTrackId && nextTrackId !== previousTrackId) {
    state.visualizerTrackTick += 1;
  }
  // Explicit user playback should always start fresh for the selected track.
  _pendingRestore = null;
  // Do not call pause() before src swap: on iOS background playback this can
  // tear down the active media session and stall manual next-track starts.
  // load() after assigning src is enough to abort/reset the previous resource.
  const playSeq = nextRecoverySeq();
  const trackStartSeq = beginTrackStartupResetWindow();
  debugHandoff('play:start', { track, playSeq, trackStartSeq });
  installPlayStartGuard(track);
  if (positionStateTimer) {
    clearTimeout(positionStateTimer);
    positionStateTimer = null;
  }
  resetAudioForTrackStart();
  state.currentTrack = track;
  state.currentTime = 0;
  state.duration = Number(track?.duration) || 0;
  state.progressLocked = true;
  state.mediaSessionLocked = isAppleMobileEnvironment() && isPlaybackHidden();
  resetPlayTracking();
  resetTranscodeAttempted();

  const transcode = needsTranscode(track);
  state.transcodeActive = transcode;
  state.transcodeWaiting = transcode;

  updateMediaSession(track);
  resetMediaSessionPositionState(state.duration);
  setPlaybackState(false);
  warmNextQueuedTrack();

  maybeResumeVisualizerContext();

  const trackId = track._id;
  const hidden = isPlaybackHidden();

  (async () => {
    if (transcode && hidden) {
      debugHandoff('play:warm_wait:start', { track, playSeq, trackStartSeq });
      await waitForTranscodeReady(trackId, getAdaptiveTranscodeWaitMs(track, { hidden }));
      debugHandoff('play:warm_wait:done', { track, playSeq, trackStartSeq });
      if (!matchesRecoverySeq(playSeq)) return;
      if (state.currentTrack?._id !== trackId) return;
      if (_trackStartSeq !== trackStartSeq) return;
    }

    debugHandoff('play:set_source', { track, playSeq, trackStartSeq });
    _setTrackSource(track, { markWaiting: transcode });
    // Explicit load() after src assignment starts the new resource cleanly.
    audio.load();

    audio.play().catch(err => {
      debugHandoff('play:play_failed', { track, playSeq, trackStartSeq, errorName: err?.name, errorMessage: err?.message });
      console.error('[player] play() failed:', err);
      if (err.name === 'NotAllowedError') {
        // iOS denied the play() call — audio session window was missed or there was no
        // user gesture. Mark as paused so the UI and lock screen reflect reality; the
        // user can resume via the lock screen play button or by foregrounding the app.
        state.isPlaying = false;
        setPlaybackState(false);
        return;
      }

      let retryDone = false;
      const retryPlay = () => {
        if (retryDone) return;
        retryDone = true;
        if (!matchesRecoverySeq(playSeq)) return;
        if (state.currentTrack?._id !== trackId) return;
        if (audio.error) return;
        audio.play().catch(e => console.error('[player] play() retry failed:', e));
      };

      // For transcoded/background starts, metadata/canplay often arrives after
      // the first play() attempt. Retry on readiness events instead of depending
      // only on timers, which iOS can throttle in background.
      audio.addEventListener('loadedmetadata', retryPlay, { once: true });
      audio.addEventListener('canplay', retryPlay, { once: true });
      queueMicrotask(retryPlay);
      setTimeout(retryPlay, 500);
    });
  })();
}

function pause() {
  audio.pause();
}

function resume(forceReload = false) {
  resumePlayback({ forceReload, maybeResumeVisualizerContext });
}

function toggle() {
  if (!audio.paused && !audio.ended) pause();
  else resume();
}

function seek(time) {
  allowBackwardTimeJumpsFor();
  debugHandoff('player:seek', { seekTime: time });
  audio.currentTime = time;
  state.currentTime = time;
}

function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v));
  audio.volume = state.volume;
  savePrefs({ volume: state.volume });
  clearTimeout(_volumeSaveTimer);
  _volumeSaveTimer = setTimeout(() => {
    api.saveSettings({ volume: state.volume }).catch(() => {});
  }, 500);
}

let volumeBeforeMute = 1;

function toggleVisualizer() {
  if (!state.currentTrack) return;
  state.showVisualizer = !state.showVisualizer;
}

watch(() => state.currentTrack, (track) => {
  if (!track) {
    state.showVisualizer = false;
    state.showAddToPlaylist = false;
  }
});

function toggleNowPlaying() {
  state.showNowPlaying = !state.showNowPlaying;
}

function toggleQueue() {
  state.showQueue = !state.showQueue;
}

function toggleShortcuts() {
  state.showShortcuts = !state.showShortcuts;
}

function openAddToPlaylist() {
  if (!state.currentTrack) return;
  state.showAddToPlaylist = true;
}

function closeAddToPlaylist() {
  state.showAddToPlaylist = false;
}

async function toggleLove(track = state.currentTrack) {
  if (!track) return;
  updateCurrentTrackLove(track, !track.isLoved);
  try {
    const { isLoved } = await api.toggleLove(track._id);
    updateCurrentTrackLove(track, isLoved);
    state.loveToggled = { id: track._id, isLoved };
  } catch (_) {
    updateCurrentTrackLove(track, !track.isLoved);
    state.loveToggled = { id: track._id, isLoved: track.isLoved };
  }
}

function toggleMute() {
  if (state.volume > 0) {
    volumeBeforeMute = state.volume;
    setVolume(0);
  } else {
    setVolume(volumeBeforeMute);
  }
}

function cycleRepeat() {
  const modes = ['off', 'all', 'one'];
  const i = modes.indexOf(state.repeat);
  state.repeat = modes[(i + 1) % modes.length];
}

const {
  playAlbum,
  playAll,
  playShuffled,
  shuffleAll,
  toggleShuffle,
  next,
  prev,
  addToQueue,
  keepCurrentOnly,
  playNext,
  moveTrack,
  removeTrack,
  playFromQueue,
  queueMatches,
  hasNext,
  hasPrev,
} = createPlayerQueue({
  state,
  audio,
  api,
  savePrefs,
  play,
  needsTranscode,
});

function playAlbumOnce(tracks, startIndex = 0) {
  state.shuffle = false;
  state.repeat = 'off';
  playAlbum(tracks, startIndex);
}

const {
  updateMediaSession,
  resetMediaSessionPositionState,
  updateMediaSessionPositionState,
  syncPlaybackStateFromElement,
  setPlaybackState,
} = createPlayerMediaSession({
  state,
  audio,
  api,
  play,
  resume,
  prev,
  next,
  seek,
});

const {
  getVisualizerAnalyser,
  getVisualizerGraph,
  resumeVisualizerContext,
  maybeResumeVisualizerContext,
} = createPlayerVisualizer({ audio });

const {
  handleError,
  handleEnded,
  resumePlayback,
  installPlayStartGuard,
  nextRecoverySeq,
  matchesRecoverySeq,
  resetTranscodeAttempted,
  setConsecutiveErrors,
} = createPlayerRecovery({
  state,
  audio,
  api,
  needsTranscode,
  setTrackSource: _setTrackSource,
  waitForTranscodeReady,
  getTranscodeWaitMs: getAdaptiveTranscodeWaitMs,
  play,
  next,
});

registerPlayerEventListeners();

export function usePlayer() {
  return {
    state,
    playAlbum,
    playAlbumOnce,
    playAll,
    playShuffled,
    shuffleAll,
    pause,
    resume,
    toggle,
    seek,
    setVolume,
    next,
    prev,
    toggleShuffle,
    toggleMute,
    toggleVisualizer,
    toggleNowPlaying,
    toggleQueue,
    toggleShortcuts,
    openAddToPlaylist,
    closeAddToPlaylist,
    toggleLove,
    cycleRepeat,
    getVisualizerAnalyser,
    getVisualizerGraph,
    resumeVisualizerContext,
    moveTrack,
    removeTrack,
    playFromQueue,
    queueMatches,
    addToQueue,
    keepCurrentOnly,
    playNext,
    hasNext,
    hasPrev,
    loadPlayerPrefs,
  };
}
