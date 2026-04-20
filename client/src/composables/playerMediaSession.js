export function createPlayerMediaSession({
  state,
  audio,
  api,
  play,
  resume,
  prev,
  next,
  seek,
}) {
  function hasMediaSession() {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  function updateMediaSession(track) {
    if (!hasMediaSession()) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || '',
      artist: track.artist || '',
      album: track.album || '',
      artwork: track.cover
        ? [{ src: api.coverUrl(track.cover), sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
  }

  function resetMediaSessionPositionState(duration = 0) {
    if (!hasMediaSession()) return;
    const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0.01;
    try {
      navigator.mediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: 1,
        position: 0,
      });
    } catch (_) {
      // iOS can throw here during handoff; ignore and let the next real update win.
    }
  }

  function updateMediaSessionPositionState() {
    if (!hasMediaSession()) return;
    const duration = state.duration;
    if (!duration || !isFinite(duration)) return;
    const position = (state.progressLocked || state.mediaSessionLocked)
      ? 0
      : Math.min(
        Number.isFinite(state.currentTime) ? state.currentTime : audio.currentTime,
        duration,
      );
    const playbackRate = Number.isFinite(audio.playbackRate) && audio.playbackRate > 0
      ? audio.playbackRate
      : 0.01;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate,
        position,
      });
    } catch (_) {
      // iOS can throw TypeError here for transient invalid states; ignore.
    }
  }

  function setPlaybackState(isPlaying) {
    if (!hasMediaSession()) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }

  function syncPlaybackStateFromElement() {
    const isPlaying = !audio.paused && !audio.ended;
    state.isPlaying = isPlaying;
    setPlaybackState(isPlaying);
  }

  function registerActionHandlers() {
    if (!hasMediaSession()) return;

    navigator.mediaSession.setActionHandler('play', () => {
      const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
      if (isHidden && state.transcodeActive && state.currentTrack) {
        const currentIndex = state.queue.findIndex((t) => t._id === state.currentTrack._id);
        if (currentIndex >= 0) state.queueIndex = currentIndex;
        play(state.currentTrack);
        return;
      }
      resume(true);
    });

    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => { prev(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { next(); });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) seek(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('seekbackward', () => { prev(); });
    navigator.mediaSession.setActionHandler('seekforward', () => { next(); });
  }

  registerActionHandlers();

  return {
    updateMediaSession,
    resetMediaSessionPositionState,
    updateMediaSessionPositionState,
    syncPlaybackStateFromElement,
    setPlaybackState,
  };
}
