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
  const HANDOFF_DEBUG_KEY = 'noisling_debug_handoff';

  function hasMediaSession() {
    return typeof navigator !== 'undefined' && 'mediaSession' in navigator;
  }

  function isHandoffDebugEnabled() {
    try {
      return localStorage.getItem(HANDOFF_DEBUG_KEY) === '1';
    } catch (_) {
      return false;
    }
  }

  function debugMediaSession(label, details = {}) {
    if (!isHandoffDebugEnabled()) return;
    console.log('[handoff:media-session]', {
      label,
      trackId: state.currentTrack?._id ?? null,
      title: state.currentTrack?.title ?? '',
      currentTime: Number.isFinite(state.currentTime) ? Number(state.currentTime.toFixed(3)) : null,
      duration: Number.isFinite(state.duration) ? Number(state.duration.toFixed(3)) : null,
      progressLocked: state.progressLocked,
      playbackState: navigator.mediaSession?.playbackState ?? null,
      hidden: typeof document !== 'undefined' ? document.visibilityState === 'hidden' : false,
      ...details,
    });
  }

  function updateMediaSession(track) {
    if (!hasMediaSession()) return;
    debugMediaSession('metadata:update', { trackId: track._id ?? null, title: track.title ?? '' });
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
    debugMediaSession('position:reset', { duration: safeDuration, position: 0 });
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
    const position = state.progressLocked
      ? 0
      : Math.min(
        Number.isFinite(state.currentTime) ? state.currentTime : audio.currentTime,
        duration,
      );
    const playbackRate = Number.isFinite(audio.playbackRate) && audio.playbackRate > 0
      ? audio.playbackRate
      : 0.01;
    debugMediaSession('position:update', { duration, position, playbackRate });
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
    debugMediaSession('playbackState:update', { isPlaying });
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
