import { reactive, computed, watch } from 'vue';
import { useApi } from './useApi.js';

const api = useApi();

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

// ─── Persistence keys ────────────────────────────────────────────────────────

const PREFS_KEY = 'noisling_player';

// Parse saved prefs synchronously so state initialises from them immediately.
let _savedPrefs = {};
try { _savedPrefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (_) {}

// ─────────────────────────────────────────────────────────────────────────────

const audio = new Audio();

const state = reactive({
  currentTrack:      null,
  queue:             [],
  queueIndex:        -1,
  // For DB-backed large queues (e.g. Shuffle All):
  //   queueTotal        = total tracks in the DB queue
  //   queueBufferOffset = virtual index of state.queue[0] in the full DB queue
  //   isLargeQueue      = true when buffer mode is active
  // For normal queues all three are 0 / false and state.queue holds everything.
  queueTotal:        0,
  queueBufferOffset: 0,
  isLargeQueue:      false,
  isPlaying:         false,
  currentTime:       0,
  duration:          0,
  volume:         (typeof _savedPrefs.volume === 'number')  ? Math.max(0, Math.min(1, _savedPrefs.volume)) : 1,
  shuffle:        (typeof _savedPrefs.shuffle === 'boolean')  ? _savedPrefs.shuffle  : false,
  repeat:         (['off', 'all', 'one'].includes(_savedPrefs.repeat)) ? _savedPrefs.repeat : 'off',
  originalQueue:     [],
  showVisualizer:    false,
  showNowPlaying:    false,
  showQueue:         false,
  showShortcuts:     false,
  playReportCount:   0,
});

// Apply saved volume to the audio element immediately.
audio.volume = state.volume;

let playReported = false;
let playedSeconds = 0;
let _lastUpdateTime = null;

// One-time seek target after a page-reload restore.
let _pendingRestoreTime = null;

// Guard against iOS Safari firing a spurious 'ended' event immediately after
// audio.src is reassigned.
let ignoreNextEnded = false;
let ignoreEndedTimer = null;

// Monotonic counter used to cancel stale stall-recovery loadedmetadata callbacks.
let stallRecoverySeq = 0;

// Throttle MediaSession position updates to once per second.
let positionStateTimer = null;

// Throttle queue progress saves to once every 5 s during playback.
let _queueSaveTimer = null;

// Debounce volume server saves.
let _volumeSaveTimer = null;

// In-flight prefetch guard — prevent concurrent fetches.
let _prefetching = false;

// Guard against retrying the transcode fallback more than once per track.
let _transcodeAttempted = false;

// Count consecutive error-induced skips so we stop looping if everything fails.
let _consecutiveErrors = 0;


audio.addEventListener('timeupdate', () => {
  state.currentTime = audio.currentTime;

  // Accumulate actual listened time — large deltas indicate a seek, ignore them
  if (!audio.paused && _lastUpdateTime !== null) {
    const delta = audio.currentTime - _lastUpdateTime;
    if (delta > 0 && delta < 2) playedSeconds += delta;
  }
  _lastUpdateTime = audio.currentTime;

  // Count a play after actually listening to 50% of the track or 4 minutes, whichever comes first
  if (!playReported && state.currentTrack && audio.duration > 0) {
    const threshold = Math.min(audio.duration * 0.5, 240);
    if (playedSeconds >= threshold) {
      playReported = true;
      api.reportPlay(state.currentTrack._id)
        .then(() => { state.playReportCount++; })
        .catch(() => {});
    }
  }

  // Keep the OS lock-screen scrubber in sync.
  if (!positionStateTimer) {
    positionStateTimer = setTimeout(() => {
      updateMediaSessionPositionState();
      positionStateTimer = null;
    }, 1000);
  }

  // Throttled queue progress save.
  if (!_queueSaveTimer) {
    _queueSaveTimer = setTimeout(() => { saveProgress(); _queueSaveTimer = null; }, 5000);
  }
});

audio.addEventListener('error', () => {
  const err = audio.error;
  if (!err || !state.currentTrack) return;

  // Abort is a normal side-effect of calling audio.load() to clear a stale error
  // state between tracks.  It is not a real playback failure — ignore it and do NOT
  // increment stallRecoverySeq so any pending loadedmetadata listener stays valid.
  if (err.code === MediaError.MEDIA_ERR_ABORTED) return;

  console.error('[player] media error:', err.code, err.message);

  const track = state.currentTrack;
  const resumeAt = state.currentTime;
  const seq = ++stallRecoverySeq;

  if (err.code === MediaError.MEDIA_ERR_NETWORK) {
    // Network drop — wait 3 s then reload from the same position.
    ignoreNextEnded = true;
    clearTimeout(ignoreEndedTimer);
    ignoreEndedTimer = null;
    setTimeout(() => {
      if (stallRecoverySeq !== seq) return;
      audio.src = api.streamUrl(track._id, needsTranscode(track));
      audio.load();
      audio.addEventListener('loadedmetadata', () => {
        if (stallRecoverySeq !== seq) return;
        ignoreNextEnded = false;
        if (resumeAt > 0 && audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
          audio.currentTime = resumeAt;
        }
        audio.play().catch(e => console.error('[player] error-recovery play failed:', e));
      }, { once: true });
    }, 3000);

  } else if (err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && !_transcodeAttempted) {
    // iOS rejected the native format — try the server-side transcode as a fallback.
    // _transcodeAttempted prevents looping if the transcode also fails.
    _transcodeAttempted = true;
    ignoreNextEnded = true;
    clearTimeout(ignoreEndedTimer);
    ignoreEndedTimer = null;
    audio.src = api.streamUrl(track._id, true);
    audio.load();
    audio.addEventListener('loadedmetadata', () => {
      if (stallRecoverySeq !== seq) return;
      ignoreNextEnded = false;
      audio.play().catch(e => console.error('[player] transcode-fallback play failed:', e));
    }, { once: true });

  } else {
    // Decode error, or transcode fallback also failed → skip to next track.
    // Stop after 3 consecutive error-skips so we don't race through the whole queue.
    if (++_consecutiveErrors >= 3) {
      console.error('[player] too many consecutive errors, stopping playback');
      _consecutiveErrors = 0;
      ignoreNextEnded = false;
      state.isPlaying = false;
      return;
    }
    next();
  }
});

audio.addEventListener('loadedmetadata', () => {
  const audioDuration = isFinite(audio.duration) ? audio.duration : 0;
  const trackDuration = state.currentTrack?.duration ?? 0;
  state.duration = Math.max(audioDuration, trackDuration) || 0;
  updateMediaSessionPositionState();

  if (_pendingRestoreTime !== null) {
    const t = _pendingRestoreTime;
    _pendingRestoreTime = null;
    if (audio.seekable.length > 0 && state.duration > 0 && t < state.duration - 3) {
      audio.currentTime = t;
    }
  }
});

audio.addEventListener('ended', () => {
  if (ignoreNextEnded) {
    ignoreNextEnded = false;
    clearTimeout(ignoreEndedTimer);
    ignoreEndedTimer = null;
    // Suppress only if this looks like the iOS Safari spurious 'ended' that fires
    // immediately after audio.src is reassigned before any data has loaded.
    // If audio has actually buffered content (readyState ≥ HAVE_CURRENT_DATA) and
    // advanced past 0.5 s, it's a real event — fall through to stall detection.
    if (audio.readyState <= 1 || audio.currentTime < 0.5) return;
  }

  // Detect premature 'ended' caused by iOS exhausting its audio buffer before
  // the track is actually over (transcoded tracks stall recovery).
  const trackDuration = state.currentTrack?.duration ?? 0;
  const knownDuration = Math.max(
    (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 0,
    state.duration,
    trackDuration,
  );
  const resumeAt = state.currentTime;
  if (knownDuration > 5 && resumeAt < knownDuration - 3 && state.currentTrack) {
    const track = state.currentTrack;
    // Keep ignoreNextEnded true for the entire recovery window — do NOT reset it
    // on a short timer. iOS will fire 'ended' again when audio.src changes and
    // nothing is playing yet; a 500 ms timer expires before the server responds
    // (especially if it's still transcoding), causing next() to fire spuriously.
    // We clear it explicitly once loadedmetadata fires or recovery aborts.
    ignoreNextEnded = true;
    clearTimeout(ignoreEndedTimer);
    ignoreEndedTimer = null;
    const seq = ++stallRecoverySeq;

    // Safety net: if loadedmetadata never fires (e.g. network dropped during
    // recovery), clear the guard after 15 s and advance to the next track so
    // the player doesn't silently freeze forever.
    const recoveryTimeout = setTimeout(() => {
      if (stallRecoverySeq !== seq) return;
      ignoreNextEnded = false;
      next();
    }, 15000);

    audio.src = api.streamUrl(track._id, needsTranscode(track));
    // iOS Safari requires an explicit load() call after setting src on an
    // element that was in the 'ended' state to trigger metadata loading.
    audio.load();
    audio.addEventListener('loadedmetadata', () => {
      if (stallRecoverySeq !== seq) return;
      clearTimeout(recoveryTimeout);
      ignoreNextEnded = false;
      if (audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
        audio.currentTime = resumeAt;
      }
      audio.play().catch(err => {
        console.error('[player] resume after stall:', err);
        if (err.name !== 'NotAllowedError') {
          setTimeout(() => {
            if (stallRecoverySeq !== seq) return;
            audio.play().catch(e => console.error('[player] resume retry failed:', e));
          }, 1000);
        }
      });
    }, { once: true });
    return;
  }

  // Defer play/next out of the ended handler. When audio.src is reassigned and
  // audio.play() is called synchronously inside the 'ended' event on iOS Safari,
  // the element hasn't fully exited the ended state yet and play() immediately
  // rejects with NotSupportedError. Calling next() from a queued task (after the
  // handler returns) lets iOS settle first — this is why pressing Prev manually
  // works but automatic queue advancement doesn't without the defer.
  // Set ignoreNextEnded now so any spurious ended iOS fires in the gap is swallowed.
  ignoreNextEnded = true;
  clearTimeout(ignoreEndedTimer);
  ignoreEndedTimer = null;
  setTimeout(() => {
    // play() will immediately reinstall its own ignoreNextEnded guard.
    if (state.repeat === 'one') {
      play(state.currentTrack);
    } else {
      next();
    }
  }, 0);
});

audio.addEventListener('play', () => {
  state.isPlaying = true;
  _consecutiveErrors = 0;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
});

audio.addEventListener('pause', () => {
  state.isPlaying = false;
  if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
});

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title || '',
    artist: track.artist || '',
    album: track.album || '',
    artwork: track.cover
      ? [{ src: api.coverUrl(track.cover), sizes: '512x512', type: 'image/jpeg' }]
      : [],
  });
}

function updateMediaSessionPositionState() {
  if (!('mediaSession' in navigator)) return;
  const duration = state.duration;
  if (!duration || !isFinite(duration)) return;
  navigator.mediaSession.setPositionState({
    duration,
    playbackRate: audio.playbackRate,
    position: Math.min(audio.currentTime, duration),
  });
}

// Register media session action handlers for OS-level media controls
if ('mediaSession' in navigator) {
  navigator.mediaSession.setActionHandler('play', () => resume());
  navigator.mediaSession.setActionHandler('pause', () => pause());
  navigator.mediaSession.setActionHandler('previoustrack', () => prev());
  navigator.mediaSession.setActionHandler('nexttrack', () => next());
  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) seek(details.seekTime);
  });
  navigator.mediaSession.setActionHandler('seekbackward', () => prev());
  navigator.mediaSession.setActionHandler('seekforward', () => next());
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

function savePrefs(updates) {
  let prefs = {};
  try { prefs = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch (_) {}
  Object.assign(prefs, updates);
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (_) {}
}

// Persist the current playback position to the DB queue (throttled via caller).
function saveProgress() {
  const virtualIndex = state.queueBufferOffset + state.queueIndex;
  api.updateQueue({ currentIndex: virtualIndex, currentTime: state.currentTime }).catch(() => {});
}

// Persist the full queue order to DB (called when queue structure changes).
// No-op for large queues — the DB already holds the authoritative shuffled list.
function saveQueueOrder() {
  if (state.isLargeQueue) return;
  api.setQueue({
    trackIds:     state.queue.map(t => t._id.toString()),
    currentIndex: state.queueIndex,
    currentTime:  state.currentTime,
  }).catch(() => {});
}

// Restore queue state from the DB on page load.
export async function restoreQueue() {
  try {
    const meta = await api.getQueue();
    if (!meta || meta.total === 0) return;

    const { total, currentIndex, currentTime } = meta;
    if (currentIndex >= total) return; // queue ended naturally

    const tracks = await api.getQueueTracks(0, total);
    if (!tracks.length) return;
    state.isLargeQueue      = false;
    state.queueTotal        = 0;
    state.queueBufferOffset = 0;
    state.originalQueue     = [...tracks];

    state.queue        = tracks;
    state.queueIndex   = currentIndex;
    state.currentTrack = tracks[currentIndex];
    audio.src = api.streamUrl(tracks[currentIndex]._id, needsTranscode(tracks[currentIndex]));

    if (typeof currentTime === 'number' && currentTime > 5) {
      _pendingRestoreTime = currentTime;
      const track = tracks[currentIndex];
      if (track?.duration > 0) {
        const threshold = Math.min(track.duration * 0.5, 240);
        if (currentTime >= threshold) playReported = true;
      }
    }
  } catch (_) {
    // graceful fallback — no queue restoration
  }
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
    if (typeof data.shuffle === 'boolean') {
      state.shuffle = data.shuffle;
      updates.shuffle = state.shuffle;
    }
    if (['off', 'all', 'one'].includes(data.repeatMode)) {
      state.repeat = data.repeatMode;
      updates.repeat = state.repeat;
    }
    if (Object.keys(updates).length) savePrefs(updates);
  } catch (_) {
    // fall back to localStorage values already applied at init
  }
}

// ─────────────────────────────────────────────────────────────────────────────

function play(track) {
  audio.pause();
  const playSeq = ++stallRecoverySeq;
  ignoreNextEnded = true;
  clearTimeout(ignoreEndedTimer);
  // For transcode tracks the ADTS live-stream can take several seconds for ffmpeg
  // to start delivering data; keep the guard up longer so iOS doesn't fire a
  // spurious 'ended' and trigger stall-recovery before playback has even begun.
  ignoreEndedTimer = setTimeout(() => { ignoreNextEnded = false; }, needsTranscode(track) ? 8000 : 500);
  state.currentTrack = track;
  state.currentTime  = 0;
  playReported          = false;
  playedSeconds         = 0;
  _lastUpdateTime       = null;
  _transcodeAttempted   = false;
  audio.src = api.streamUrl(track._id, needsTranscode(track));

  if (audio._vizCtx?.ctx?.state === 'suspended') {
    audio._vizCtx.ctx.resume();
  }

  const trackId = track._id;
  audio.play().catch(err => {
    console.error('[player] play() failed:', err);
    if (err.name !== 'NotAllowedError') {
      setTimeout(() => {
        // If the error handler already took over (changed stallRecoverySeq), bail out.
        if (stallRecoverySeq !== playSeq) return;
        if (state.currentTrack?._id !== trackId) return;
        if (audio.error) return;
        audio.play().catch(e => console.error('[player] play() retry failed:', e));
      }, 500);
    }
  });
  updateMediaSession(track);

  // Pre-warm transcode cache for the next queued track.
  const nextIdx = state.queueIndex + 1;
  if (nextIdx < state.queue.length) {
    const nextTrack = state.queue[nextIdx];
    if (needsTranscode(nextTrack)) api.warmTranscode(nextTrack._id);
  }
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function playAlbum(tracks, startIndex = 0) {
  state.isLargeQueue      = false;
  state.queueTotal        = 0;
  state.queueBufferOffset = 0;
  state.originalQueue     = [...tracks];

  if (state.shuffle) {
    const startTrack = tracks[startIndex];
    const rest = tracks.filter((_, i) => i !== startIndex);
    state.queue      = [startTrack, ...shuffleArray(rest)];
    state.queueIndex = 0;
  } else {
    state.queue      = [...tracks];
    state.queueIndex = startIndex;
  }

  play(state.queue[state.queueIndex]);
  saveQueueOrder();
}

// Shuffle All: server shuffles and persists all IDs, client fetches the full list.
async function shuffleAll() {
  const { total, tracks } = await api.shuffleQueue();
  if (!total || !tracks.length) return;

  const allTracks = await api.getQueueTracks(0, total);

  state.isLargeQueue      = false;
  state.queueTotal        = 0;
  state.queueBufferOffset = 0;
  state.queue             = allTracks.length ? allTracks : tracks;
  state.originalQueue     = [...state.queue];
  state.queueIndex        = 0;

  play(state.queue[0]);
}

// Extend the sliding-window buffer when running low on tracks ahead (large queues only).
async function prefetchIfNeeded() {
  if (!state.isLargeQueue || _prefetching) return;
  const tracksAhead = state.queue.length - 1 - state.queueIndex;
  if (tracksAhead >= 10) return;

  const nextOffset = state.queueBufferOffset + state.queue.length;
  if (nextOffset >= state.queueTotal) return;

  _prefetching = true;
  try {
    const more = await api.getQueueTracks(nextOffset, 50);
    if (!more.length) return;
    state.queue.push(...more);

    // Trim the head of the buffer — keep 10 tracks before current + current + 50 ahead ≈ 61 max.
    const maxBefore = 10;
    if (state.queueIndex > maxBefore) {
      const trim = state.queueIndex - maxBefore;
      state.queue.splice(0, trim);
      state.queueIndex        -= trim;
      state.queueBufferOffset += trim;
    }
  } catch (_) {
  } finally {
    _prefetching = false;
  }
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;

  // For large queues (Shuffle All), just persist the pref — the queue is already
  // DB-managed and re-shuffling the local buffer is meaningless.
  if (state.queue.length === 0 || state.isLargeQueue) {
    savePrefs({ shuffle: state.shuffle });
    api.saveSettings({ shuffle: state.shuffle }).catch(() => {});
    return;
  }

  const current = state.currentTrack;
  if (state.shuffle) {
    const remaining = state.queue.filter((t) => t._id !== current._id);
    state.queue      = [current, ...shuffleArray(remaining)];
    state.queueIndex = 0;
  } else {
    state.queue      = [...state.originalQueue];
    state.queueIndex = state.queue.findIndex((t) => t._id === current._id);
    if (state.queueIndex === -1) state.queueIndex = 0;
  }

  savePrefs({ shuffle: state.shuffle });
  api.saveSettings({ shuffle: state.shuffle }).catch(() => {});
  saveQueueOrder();
}

function pause() {
  audio.pause();
}

function resume() {
  if (audio._vizCtx?.ctx?.state === 'suspended') {
    audio._vizCtx.ctx.resume();
  }
  // If the element is stuck in an error state (e.g. previous network drop),
  // calling play() throws NotSupportedError. Reload the track first.
  if (audio.error && state.currentTrack) {
    _consecutiveErrors = 0;
    const track = state.currentTrack;
    const resumeAt = state.currentTime;
    const seq = ++stallRecoverySeq;
    ignoreNextEnded = true;
    clearTimeout(ignoreEndedTimer);
    ignoreEndedTimer = null;
    audio.src = api.streamUrl(track._id, needsTranscode(track));
    audio.load();
    audio.addEventListener('loadedmetadata', () => {
      if (stallRecoverySeq !== seq) return;
      ignoreNextEnded = false;
      if (resumeAt > 0 && audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
        audio.currentTime = resumeAt;
      }
      audio.play().catch(e => console.error('[player] resume after reload failed:', e));
    }, { once: true });
    return;
  }
  audio.play().catch(err => console.error('[player] resume() failed:', err));
}

function toggle() {
  if (state.isPlaying) pause();
  else resume();
}

function seek(time) {
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
  if (!track) state.showVisualizer = false;
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

async function toggleLove() {
  if (!state.currentTrack) return;
  const track = state.currentTrack;
  track.isLoved = !track.isLoved;
  try {
    const { isLoved } = await api.toggleLove(track._id);
    track.isLoved = isLoved;
  } catch (_) {
    track.isLoved = !track.isLoved;
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

function _clearQueue() {
  const endIndex = state.isLargeQueue ? state.queueTotal : state.queue.length;
  state.isPlaying        = false;
  state.currentTrack     = null;
  state.queue            = [];
  state.originalQueue    = [];
  state.queueIndex       = -1;
  state.queueTotal       = 0;
  state.queueBufferOffset = 0;
  state.isLargeQueue     = false;
  state.currentTime      = 0;
  state.duration         = 0;
  state.showQueue        = false;
  // Mark the DB queue as ended so it won't restore on next page load.
  api.updateQueue({ currentIndex: endIndex, currentTime: 0 }).catch(() => {});
}

function next() {
  if (state.queue.length === 0) {
    state.isPlaying = false;
    return;
  }
  if (state.repeat === 'one') {
    play(state.currentTrack);
    return;
  }

  const nextIndex   = state.queueIndex + 1;
  const virtualNext = state.queueBufferOffset + nextIndex;

  if (nextIndex < state.queue.length) {
    // Track is already in the buffer.
    state.queueIndex = nextIndex;
    play(state.queue[nextIndex]);
    saveProgress();
    if (state.isLargeQueue) prefetchIfNeeded();
  } else if (state.isLargeQueue && virtualNext < state.queueTotal) {
    // End of buffer but there are more tracks in the DB queue — fetch them.
    _fetchAndPlayAt(virtualNext);
  } else if (state.repeat === 'all') {
    if (state.isLargeQueue) {
      _restartLargeQueue();
    } else {
      state.queueIndex = 0;
      play(state.queue[0]);
      saveProgress();
    }
  } else {
    _clearQueue();
  }
}

async function _fetchAndPlayAt(virtualIndex) {
  try {
    const tracks = await api.getQueueTracks(virtualIndex, 50);
    if (!tracks.length) { _clearQueue(); return; }
    state.queueBufferOffset = virtualIndex;
    state.queue             = tracks;
    state.queueIndex        = 0;
    play(tracks[0]);
    saveProgress();
    prefetchIfNeeded();
  } catch (_) {}
}

async function _restartLargeQueue() {
  try {
    const tracks = await api.getQueueTracks(0, 50);
    if (!tracks.length) return;
    state.queue             = tracks;
    state.queueIndex        = 0;
    state.queueBufferOffset = 0;
    play(tracks[0]);
    saveProgress();
    prefetchIfNeeded();
  } catch (_) {}
}

function cycleRepeat() {
  const modes = ['off', 'all', 'one'];
  const i = modes.indexOf(state.repeat);
  state.repeat = modes[(i + 1) % modes.length];
  savePrefs({ repeat: state.repeat });
  api.saveSettings({ repeatMode: state.repeat }).catch(() => {});
}

function prev() {
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (state.repeat === 'one') {
    play(state.currentTrack);
    return;
  }
  if (state.queueIndex > 0) {
    state.queueIndex--;
    play(state.queue[state.queueIndex]);
    saveProgress();
  } else if (state.repeat === 'all' && !state.isLargeQueue) {
    state.queueIndex = state.queue.length - 1;
    play(state.queue[state.queueIndex]);
    saveProgress();
  }
  // For large queues at buffer start (queueBufferOffset > 0), the buffer always keeps
  // 10 tracks before the current position, so queueIndex > 0 normally covers this.
}

function addToQueue(track) {
  state.queue.push(track);
  if (!state.isLargeQueue) saveQueueOrder();
}

function playNext(track) {
  const insertAt = Math.max(state.queueIndex + 1, 0);
  state.queue.splice(insertAt, 0, track);
  if (!state.isLargeQueue) saveQueueOrder();
}

function moveTrack(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [moved] = state.queue.splice(fromIndex, 1);
  state.queue.splice(toIndex, 0, moved);

  if (state.queueIndex === fromIndex) {
    state.queueIndex = toIndex;
  } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
    state.queueIndex--;
  } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
    state.queueIndex++;
  }
  if (!state.isLargeQueue) saveQueueOrder();
}

function playFromQueue(index) {
  state.queueIndex = index;
  play(state.queue[index]);
  saveProgress();
}

function queueMatches(tracks) {
  if (state.isLargeQueue) return false;
  if (state.queue.length !== tracks.length) return false;
  const source = state.shuffle ? state.originalQueue : state.queue;
  return source.every((t, i) => t._id === tracks[i]._id);
}

const hasNext = computed(() => {
  if (state.repeat !== 'off') return true;
  if (state.isLargeQueue) {
    return state.queueBufferOffset + state.queueIndex < state.queueTotal - 1;
  }
  return state.queueIndex < state.queue.length - 1;
});

const hasPrev = computed(() => {
  if (audio.currentTime > 3 || state.repeat !== 'off') return true;
  if (state.isLargeQueue) {
    return state.queueBufferOffset + state.queueIndex > 0;
  }
  return state.queueIndex > 0;
});

export function usePlayer() {
  return {
    state,
    play,
    playAlbum,
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
    toggleLove,
    cycleRepeat,
    audio,
    moveTrack,
    playFromQueue,
    queueMatches,
    addToQueue,
    playNext,
    hasNext,
    hasPrev,
    loadPlayerPrefs,
    restoreQueue,
  };
}
