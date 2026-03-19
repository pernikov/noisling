import { computed } from 'vue';

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function createPlayerQueue({
  state,
  audio,
  api,
  savePrefs,
  play,
  needsTranscode,
}) {
  let prefetching = false;
  let deferredStartSeq = 0;

  function clearQueue() {
    state.isPlaying = false;
    state.currentTrack = null;
    state.queue = [];
    state.originalQueue = [];
    state.largeQueueIds = [];
    state.queueLoading = false;
    state.queueIndex = -1;
    state.queueTotal = 0;
    state.queueBufferOffset = 0;
    state.isLargeQueue = false;
    state.currentTime = 0;
    state.duration = 0;
    state.showQueue = false;
    state.transcodeWaiting = false;
    state.transcodeActive = false;
  }

  async function prefetchIfNeeded() {
    if (!state.isLargeQueue || prefetching) return;
    const tracksAhead = state.queue.length - 1 - state.queueIndex;
    if (tracksAhead >= 10) return;

    const nextOffset = state.queueBufferOffset + state.queue.length;
    if (nextOffset >= state.queueTotal) return;

    prefetching = true;
    try {
      const nextIds = state.largeQueueIds.slice(nextOffset, nextOffset + 50);
      const more = await api.getTracksByIds(nextIds);
      if (!more.length) return;
      state.queue.push(...more);

      const maxBefore = 10;
      if (state.queueIndex > maxBefore) {
        const trim = state.queueIndex - maxBefore;
        state.queue.splice(0, trim);
        state.queueIndex -= trim;
        state.queueBufferOffset += trim;
      }
    } catch (_) {
    } finally {
      prefetching = false;
    }
  }

  function playWithWarmupIfNeeded(track, expectedIndex) {
    const seq = ++deferredStartSeq;

    if (seq !== deferredStartSeq) return;
    if (state.queueIndex !== expectedIndex) return;
    play(track);
  }

  async function fetchAndPlayAt(virtualIndex) {
    try {
      const ids = state.largeQueueIds.slice(virtualIndex, virtualIndex + 50);
      const tracks = await api.getTracksByIds(ids);
      if (!tracks.length) {
        clearQueue();
        return;
      }
      state.queueBufferOffset = virtualIndex;
      state.queue = tracks;
      state.queueIndex = 0;
      play(tracks[0]);
      prefetchIfNeeded();
    } catch (_) {
    }
  }

  async function restartLargeQueue() {
    try {
      const ids = state.largeQueueIds.slice(0, 50);
      const tracks = await api.getTracksByIds(ids);
      if (!tracks.length) return;
      state.queue = tracks;
      state.queueIndex = 0;
      state.queueBufferOffset = 0;
      play(tracks[0]);
      prefetchIfNeeded();
    } catch (_) {
    }
  }

  function playAlbum(tracks, startIndex = 0) {
    state.isLargeQueue = false;
    state.queueTotal = 0;
    state.queueBufferOffset = 0;
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

  async function shuffleAll() {
    const { total, ids, tracks } = await api.shuffleQueue();
    if (!total || !tracks.length) return;

    state.isLargeQueue = false;
    state.largeQueueIds = ids;
    state.queueTotal = total;
    state.queueBufferOffset = 0;
    state.queue = [...tracks];
    state.originalQueue = [];
    state.queueIndex = 0;
    state.queueLoading = total > tracks.length;

    play(state.queue[0]);

    if (!state.queueLoading) return;

    const batchSize = 200;
    try {
      for (let offset = tracks.length; offset < total; offset += batchSize) {
        const batchIds = ids.slice(offset, offset + batchSize);
        const more = await api.getTracksByIds(batchIds);
        state.queue.push(...more);
      }
    } finally {
      state.queueLoading = false;
      state.queueTotal = 0;
    }
  }

  function toggleShuffle() {
    state.shuffle = !state.shuffle;

    if (state.queue.length === 0 || state.isLargeQueue) {
      savePrefs({ shuffle: state.shuffle });
      api.saveSettings({ shuffle: state.shuffle }).catch(() => {});
      return;
    }

    const current = state.currentTrack;
    if (state.shuffle) {
      const remaining = state.queue.filter((t) => t._id !== current._id);
      state.queue = [current, ...shuffleArray(remaining)];
      state.queueIndex = 0;
    } else {
      state.queue = [...state.originalQueue];
      state.queueIndex = state.queue.findIndex((t) => t._id === current._id);
      if (state.queueIndex === -1) state.queueIndex = 0;
    }

    savePrefs({ shuffle: state.shuffle });
    api.saveSettings({ shuffle: state.shuffle }).catch(() => {});
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

    const nextIndex = state.queueIndex + 1;
    const virtualNext = state.queueBufferOffset + nextIndex;

    if (nextIndex < state.queue.length) {
      state.queueIndex = nextIndex;
      playWithWarmupIfNeeded(state.queue[nextIndex], nextIndex);
      if (state.isLargeQueue) prefetchIfNeeded();
    } else if (state.isLargeQueue && virtualNext < state.queueTotal) {
      fetchAndPlayAt(virtualNext);
    } else if (state.repeat === 'all') {
      if (state.isLargeQueue) {
        restartLargeQueue();
      } else {
        state.queueIndex = 0;
        play(state.queue[0]);
      }
    } else {
      clearQueue();
    }
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
    } else if (state.repeat === 'all' && !state.isLargeQueue) {
      state.queueIndex = state.queue.length - 1;
      play(state.queue[state.queueIndex]);
    }
  }

  function addToQueue(track) {
    state.queue.push(track);
  }

  function keepCurrentOnly() {
    const current = state.currentTrack;
    if (!current) return;

    state.queue = [current];
    state.originalQueue = [current];
    state.largeQueueIds = [];
    state.queueLoading = false;
    state.queueIndex = 0;
    state.queueTotal = 0;
    state.queueBufferOffset = 0;
    state.isLargeQueue = false;
  }

  function playNext(track) {
    const insertAt = Math.max(state.queueIndex + 1, 0);
    state.queue.splice(insertAt, 0, track);
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
  }

  function playFromQueue(index) {
    state.queueIndex = index;
    play(state.queue[index]);
  }

  function queueMatches(tracks) {
    if (state.isLargeQueue) return false;
    if (state.queue.length !== tracks.length) return false;
    const source = state.shuffle ? state.originalQueue : state.queue;
    return source.every((t, i) => t._id === tracks[i]._id);
  }

  function playAll(tracks, getAllTracks = null) {
    if (!tracks.length) return;
    playAlbum(tracks, 0);
    if (getAllTracks) {
      getAllTracks().then((allTracks) => {
        if (allTracks.length <= tracks.length) return;
        const currentId = state.currentTrack?._id;
        const idx = allTracks.findIndex((t) => t._id === currentId);
        state.queue = allTracks;
        state.originalQueue = [...allTracks];
        state.queueIndex = idx >= 0 ? idx : 0;
      });
    }
  }

  function playShuffled(tracks, getAllTracks = null) {
    if (!tracks.length) return;
    state.shuffle = true;
    playAlbum(tracks, Math.floor(Math.random() * tracks.length));
    if (getAllTracks) {
      getAllTracks().then((allTracks) => {
        if (allTracks.length <= tracks.length) return;
        const current = state.currentTrack;
        const rest = allTracks.filter((t) => t._id !== current?._id);
        for (let i = rest.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        state.queue = current ? [current, ...rest] : rest;
        state.originalQueue = [...allTracks];
        state.queueIndex = 0;
      });
    }
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

  return {
    playAlbum,
    shuffleAll,
    toggleShuffle,
    next,
    prev,
    addToQueue,
    keepCurrentOnly,
    playNext,
    moveTrack,
    playFromQueue,
    queueMatches,
    playAll,
    playShuffled,
    hasNext,
    hasPrev,
  };
}
