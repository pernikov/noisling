import { reactive, computed } from 'vue';
import { useApi } from './useApi.js';

const api = useApi();

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
  originalQueue: [], // pre-shuffle order
  showVisualizer: false,
});

let playReported = false;

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
});

audio.addEventListener('loadedmetadata', () => {
  state.duration = audio.duration;
});

audio.addEventListener('ended', () => {
  next();
});

audio.addEventListener('play', () => {
  state.isPlaying = true;
});

audio.addEventListener('pause', () => {
  state.isPlaying = false;
});

function play(track) {
  state.currentTrack = track;
  playReported = false;
  audio.src = api.streamUrl(track._id);
  audio.play();
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
  audio.play();
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
  } else {
    state.isPlaying = false;
  }
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
    audio,
    moveTrack,
    playFromQueue,
    queueMatches,
    hasNext,
    hasPrev,
  };
}
