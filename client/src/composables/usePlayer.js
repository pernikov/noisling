import { reactive, computed } from 'vue';
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

const audio = new Audio();
audio.volume = 1;

const state = reactive({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  shuffle: false,
  repeat: 'off', // 'off' | 'all' | 'one'
  originalQueue: [], // pre-shuffle order
  showVisualizer: false,
  showNowPlaying: false,
  showQueue: false,
});

let playReported = false;
// Guard against iOS Safari firing a spurious 'ended' event immediately after
// audio.src is reassigned (src change aborts the previous stream, which can
// dispatch 'ended' on some iOS versions). The flag expires after 500 ms so it
// can never accidentally suppress the legitimate 'ended' of the new track.
let ignoreNextEnded = false;
let ignoreEndedTimer = null;

// Throttle MediaSession position updates to once per second (called from timeupdate).
let positionStateTimer = null;

audio.addEventListener('timeupdate', () => {
  state.currentTime = audio.currentTime;

  // Count a play after 50% of the track or 30s, whichever comes first
  if (!playReported && state.currentTrack && audio.duration > 0) {
    const threshold = Math.min(audio.duration * 0.5, 30);
    if (audio.currentTime >= threshold) {
      playReported = true;
      api.reportPlay(state.currentTrack._id).catch(() => {});
    }
  }

  // Keep the OS lock-screen scrubber in sync. iOS stops firing action handler
  // events (next/prev/seek) if position state goes stale.
  if (!positionStateTimer) {
    positionStateTimer = setTimeout(() => {
      updateMediaSessionPositionState();
      positionStateTimer = null;
    }, 1000);
  }
});

audio.addEventListener('loadedmetadata', () => {
  state.duration = isFinite(audio.duration) ? audio.duration : (state.currentTrack?.duration ?? 0);
  updateMediaSessionPositionState();
});

audio.addEventListener('ended', () => {
  if (ignoreNextEnded) {
    ignoreNextEnded = false;
    clearTimeout(ignoreEndedTimer);
    return;
  }

  // Detect premature 'ended' caused by iOS exhausting its audio buffer before
  // the track is actually over.  This happens on the first play of a transcoded
  // track: ffmpeg finishes fast, the HTTP connection closes, and iOS can only
  // hold a limited amount of audio in RAM.  When the buffer empties mid-song,
  // iOS fires 'ended' even though there is still audio left to play.
  //
  // The server simultaneously writes the transcoded output to a temp file, so
  // by the time iOS stalls (seconds/minutes into the song) the cache is ready.
  // Re-requesting the same URL now returns a seekable, range-capable response,
  // letting us jump back to exactly where iOS gave up.
  const knownDuration = isFinite(audio.duration) ? audio.duration : state.duration;
  const resumeAt = audio.currentTime;
  if (knownDuration > 10 && resumeAt < knownDuration - 5 && state.currentTrack) {
    const track = state.currentTrack;
    ignoreNextEnded = true;
    clearTimeout(ignoreEndedTimer);
    ignoreEndedTimer = setTimeout(() => { ignoreNextEnded = false; }, 500);
    audio.src = api.streamUrl(track._id, needsTranscode(track));
    audio.addEventListener('loadedmetadata', () => {
      // If the cached response supports seeking, jump back to the stall point.
      if (audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
        audio.currentTime = resumeAt;
      }
      audio.play().catch(err => console.error('[player] resume after stall:', err));
    }, { once: true });
    return;
  }

  if (state.repeat === 'one') {
    audio.currentTime = 0;
    playReported = false;
    audio.play().catch(err => console.error('[player] repeat play() failed:', err));
  } else {
    next();
  }
});

audio.addEventListener('play', () => {
  state.isPlaying = true;
  // iOS requires playbackState = 'playing' to keep lock-screen controls active
  // and to continue invoking action handlers (next/prev/seek) from the background.
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
  // iOS always renders ±10s icons for these slots in web media UI (can't change icons),
  // but we can at least make them behave as track skip.
  navigator.mediaSession.setActionHandler('seekbackward', () => prev());
  navigator.mediaSession.setActionHandler('seekforward', () => next());
}

function play(track) {
  // Pause first so any pending play() promise is settled before we swap the src.
  // Without this, changing audio.src mid-play causes an AbortError on iOS that
  // leaves the element in a broken state for all subsequent plays.
  audio.pause();
  // Arm the spurious-ended guard for 500 ms. If iOS fires 'ended' as a side
  // effect of the src reassignment it will be swallowed; the real 'ended' that
  // fires at the end of the new track (seconds/minutes later) will not be.
  ignoreNextEnded = true;
  clearTimeout(ignoreEndedTimer);
  ignoreEndedTimer = setTimeout(() => { ignoreNextEnded = false; }, 500);
  state.currentTrack = track;
  playReported = false;
  // Setting audio.src already invokes the media element load algorithm per the
  // HTML spec — calling audio.load() explicitly after this is redundant and on
  // iOS progressively degrades the audio buffer state on every track change,
  // causing 'ended' to fire earlier and earlier (the "faster and faster restart" bug).
  audio.src = api.streamUrl(track._id, needsTranscode(track));

  // iOS: AudioContext starts suspended and must be resumed on user gesture
  if (audio._vizCtx?.ctx?.state === 'suspended') {
    audio._vizCtx.ctx.resume();
  }

  audio.play().catch(err => console.error('[player] play() failed:', err));
  updateMediaSession(track);
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
  state.originalQueue = [...tracks];
  if (state.shuffle) {
    const startTrack = tracks[startIndex];
    const rest = tracks.filter((_, i) => i !== startIndex);
    state.queue = [startTrack, ...shuffleArray(rest)];
    state.queueIndex = 0;
  } else {
    state.queue = [...tracks];
    state.queueIndex = startIndex;
  }
  play(state.queue[state.queueIndex]);
}

function toggleShuffle() {
  state.shuffle = !state.shuffle;
  if (state.queue.length === 0) return;

  const current = state.currentTrack;
  if (state.shuffle) {
    // Shuffle remaining tracks, keep current at front
    const remaining = state.queue.filter((t) => t._id !== current._id);
    state.queue = [current, ...shuffleArray(remaining)];
    state.queueIndex = 0;
  } else {
    // Restore original order, find current track's position
    state.queue = [...state.originalQueue];
    state.queueIndex = state.queue.findIndex((t) => t._id === current._id);
    if (state.queueIndex === -1) state.queueIndex = 0;
  }
}

function pause() {
  audio.pause();
}

function resume() {
  if (audio._vizCtx?.ctx?.state === 'suspended') {
    audio._vizCtx.ctx.resume();
  }
  audio.play().catch(err => console.error('[player] resume() failed:', err));
}

function toggle() {
  if (state.isPlaying) pause();
  else resume();
}

function seek(time) {
  audio.currentTime = time;
}

function setVolume(v) {
  state.volume = Math.max(0, Math.min(1, v));
  audio.volume = state.volume;
}

let volumeBeforeMute = 1;

function toggleVisualizer() {
  state.showVisualizer = !state.showVisualizer;
}

function toggleNowPlaying() {
  state.showNowPlaying = !state.showNowPlaying;
}

function toggleQueue() {
  state.showQueue = !state.showQueue;
}

function toggleMute() {
  if (state.volume > 0) {
    volumeBeforeMute = state.volume;
    setVolume(0);
  } else {
    setVolume(volumeBeforeMute);
  }
}

function next() {
  if (state.queue.length === 0) {
    state.isPlaying = false;
    return;
  }
  const nextIndex = state.queueIndex + 1;
  if (nextIndex < state.queue.length) {
    state.queueIndex = nextIndex;
    play(state.queue[nextIndex]);
  } else if (state.repeat === 'all') {
    state.queueIndex = 0;
    play(state.queue[0]);
  } else {
    state.isPlaying = false;
  }
}

function cycleRepeat() {
  const modes = ['off', 'all', 'one'];
  const i = modes.indexOf(state.repeat);
  state.repeat = modes[(i + 1) % modes.length];
}

function prev() {
  // If more than 3 seconds in, restart current track
  if (audio.currentTime > 3) {
    audio.currentTime = 0;
    return;
  }
  if (state.queueIndex > 0) {
    state.queueIndex--;
    play(state.queue[state.queueIndex]);
  }
}

function moveTrack(fromIndex, toIndex) {
  if (fromIndex === toIndex) return;
  const [moved] = state.queue.splice(fromIndex, 1);
  state.queue.splice(toIndex, 0, moved);

  // Keep queueIndex pointing at the currently playing track
  if (state.queueIndex === fromIndex) {
    state.queueIndex = toIndex;
  } else if (fromIndex < state.queueIndex && toIndex >= state.queueIndex) {
    state.queueIndex--;
  } else if (fromIndex > state.queueIndex && toIndex <= state.queueIndex) {
    state.queueIndex++;
  }
}

function playFromQueue(index) {
  state.queueIndex = index;
  play(state.queue[index]);
}

function queueMatches(tracks) {
  if (state.queue.length !== tracks.length) return false;
  const source = state.shuffle ? state.originalQueue : state.queue;
  return source.every((t, i) => t._id === tracks[i]._id);
}

const hasNext = computed(() => state.queueIndex < state.queue.length - 1);
const hasPrev = computed(() => state.queueIndex > 0 || audio.currentTime > 3);

export function usePlayer() {
  return {
    state,
    play,
    playAlbum,
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
    cycleRepeat,
    audio,
    moveTrack,
    playFromQueue,
    queueMatches,
    hasNext,
    hasPrev,
  };
}
