export function createPlayerRecovery({
  state,
  audio,
  api,
  needsTranscode,
  setTrackSource,
  waitForTranscodeReady,
  getTranscodeWaitMs,
  play,
  next,
}) {
  const recoveryState = {
    ignoreNextEnded: false,
    ignoreEndedTimer: null,
    stallRecoverySeq: 0,
    transcodeAttempted: false,
    consecutiveErrors: 0,
  };

  function clearEndedTimer() {
    clearTimeout(recoveryState.ignoreEndedTimer);
    recoveryState.ignoreEndedTimer = null;
  }

  function setIgnoreNextEnded(value) {
    recoveryState.ignoreNextEnded = value;
  }

  function nextRecoverySeq() {
    recoveryState.stallRecoverySeq += 1;
    return recoveryState.stallRecoverySeq;
  }

  function matchesRecoverySeq(seq) {
    return recoveryState.stallRecoverySeq === seq;
  }

  function setConsecutiveErrors(value) {
    recoveryState.consecutiveErrors = value;
  }

  function resetTranscodeAttempted() {
    recoveryState.transcodeAttempted = false;
  }

  function installPlayStartGuard(track) {
    recoveryState.ignoreNextEnded = true;
    clearEndedTimer();
    recoveryState.ignoreEndedTimer = setTimeout(() => {
      recoveryState.ignoreNextEnded = false;
    }, needsTranscode(track) ? 20000 : 500);
  }

  function handleError() {
    const err = audio.error;
    if (!err || !state.currentTrack) return;
    if (err.code === MediaError.MEDIA_ERR_ABORTED) return;

    const track = state.currentTrack;
    const resumeAt = state.currentTime;
    const seq = nextRecoverySeq();

    const errTitle = state.currentTrack?.title ?? '?';
    const errTime = audio.currentTime.toFixed(1);
    const errDur = isFinite(audio.duration) ? audio.duration.toFixed(1) : '∞';
    const codeNames = { 1: 'ABORTED', 2: 'NETWORK', 3: 'DECODE', 4: 'SRC_NOT_SUPPORTED' };
    console.error(`[player] media error — "${errTitle}" t=${errTime} dur=${errDur} code=${err.code}(${codeNames[err.code] ?? '?'}) msg="${err.message}"`);

    if (err.code === MediaError.MEDIA_ERR_NETWORK) {
      recoveryState.ignoreNextEnded = true;
      clearEndedTimer();
      setTimeout(() => {
        if (!matchesRecoverySeq(seq)) return;
        setTrackSource(track);
        audio.load();
        audio.addEventListener('loadedmetadata', () => {
          if (!matchesRecoverySeq(seq)) return;
          recoveryState.ignoreNextEnded = false;
          if (resumeAt > 0 && audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
            audio.currentTime = resumeAt;
          }
          audio.play().catch((e) => console.error('[player] error-recovery play failed:', e));
        }, { once: true });
      }, 3000);
      return;
    }

    if (err.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED && !recoveryState.transcodeAttempted) {
      recoveryState.transcodeAttempted = true;
      recoveryState.ignoreNextEnded = true;
      clearEndedTimer();
      setTrackSource(track, { forceTranscode: true });
      audio.load();
      audio.addEventListener('loadedmetadata', () => {
        if (!matchesRecoverySeq(seq)) return;
        recoveryState.ignoreNextEnded = false;
        audio.play().catch((e) => console.error('[player] transcode-fallback play failed:', e));
      }, { once: true });
      return;
    }

    if (err.code === MediaError.MEDIA_ERR_DECODE && needsTranscode(track) && !recoveryState.transcodeAttempted) {
      recoveryState.transcodeAttempted = true;
      recoveryState.ignoreNextEnded = true;
      clearEndedTimer();
      (async () => {
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          if (!matchesRecoverySeq(seq)) return;
          const { status } = await api.warmTranscode(track._id);
          if (status === 'ready') break;
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
        if (!matchesRecoverySeq(seq)) return;
        setTrackSource(track, { forceTranscode: true });
        audio.load();
        audio.addEventListener('loadedmetadata', () => {
          if (!matchesRecoverySeq(seq)) return;
          recoveryState.ignoreNextEnded = false;
          audio.play().catch((e) => console.error('[player] decode-retry play failed:', e));
        }, { once: true });
      })();
      return;
    }

    recoveryState.consecutiveErrors += 1;
    if (recoveryState.consecutiveErrors >= 3) {
      console.error('[player] too many consecutive errors, stopping playback');
      recoveryState.consecutiveErrors = 0;
      recoveryState.ignoreNextEnded = false;
      state.isPlaying = false;
      return;
    }
    next();
  }

  function handleEnded() {
    const t = audio.currentTime.toFixed(1);
    const d = isFinite(audio.duration) ? audio.duration.toFixed(1) : '∞';
    const title = state.currentTrack?.title ?? '?';

    if (recoveryState.ignoreNextEnded) {
      recoveryState.ignoreNextEnded = false;
      clearEndedTimer();
      if (audio.readyState <= 1 || audio.currentTime < 0.5) {
        return;
      }
    }

    const trackDuration = state.currentTrack?.duration ?? 0;
    const knownDuration = Math.max(
      (isFinite(audio.duration) && audio.duration > 0) ? audio.duration : 0,
      state.duration,
      trackDuration,
    );
    const resumeAt = state.currentTime;

    if (knownDuration > 5 && resumeAt < knownDuration - 3 && state.currentTrack) {
      const track = state.currentTrack;
      recoveryState.ignoreNextEnded = true;
      clearEndedTimer();
      const seq = nextRecoverySeq();

      const recoveryTimeout = setTimeout(() => {
        if (!matchesRecoverySeq(seq)) return;
        recoveryState.ignoreNextEnded = false;
        next();
      }, 15000);

      setTrackSource(track);
      audio.load();
      audio.addEventListener('loadedmetadata', () => {
        if (!matchesRecoverySeq(seq)) return;
        clearTimeout(recoveryTimeout);
        recoveryState.ignoreNextEnded = false;
        if (audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
          audio.currentTime = resumeAt;
        }
        audio.play().catch((err) => {
          console.error('[player] resume after stall:', err);
          if (err.name !== 'NotAllowedError') {
            setTimeout(() => {
              if (!matchesRecoverySeq(seq)) return;
              audio.play().catch((e) => console.error('[player] resume retry failed:', e));
            }, 1000);
          }
        });
      }, { once: true });
      return;
    }

    recoveryState.ignoreNextEnded = true;
    clearEndedTimer();
    queueMicrotask(() => {
      if (state.repeat === 'one') {
        play(state.currentTrack);
      } else {
        next();
      }
    });
  }

  function resumePlayback({ forceReload = false, maybeResumeVisualizerContext }) {
    maybeResumeVisualizerContext?.();
    const isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden';
    const shouldForceReload = forceReload || (isHidden && state.transcodeActive);

    if ((audio.error || shouldForceReload) && state.currentTrack) {
      recoveryState.consecutiveErrors = 0;
      const track = state.currentTrack;
      const allowSeekResume = !(isHidden && state.transcodeActive);
      const resumeAt = allowSeekResume ? state.currentTime : 0;
      const seq = nextRecoverySeq();
      recoveryState.ignoreNextEnded = true;
      clearEndedTimer();

      (async () => {
        if (state.transcodeActive) {
          state.transcodeWaiting = true;
          await waitForTranscodeReady(track._id, getTranscodeWaitMs(track, { hidden: isHidden }));
        }
        if (!matchesRecoverySeq(seq)) return;

        const attemptReload = () => {
          audio.removeAttribute('src');
          audio.load();
          setTrackSource(track, {
            forceTranscode: state.transcodeActive,
            markWaiting: false,
            cacheBust: true,
          });
          audio.load();
        };

        attemptReload();

        let resolved = false;
        const onMeta = () => {
          if (resolved) return;
          resolved = true;
          if (!matchesRecoverySeq(seq)) return;
          recoveryState.ignoreNextEnded = false;
          if (allowSeekResume && resumeAt > 0 && audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
            audio.currentTime = resumeAt;
          }
          audio.play().catch((e) => console.error('[player] resume after reload failed:', e));
        };

        audio.addEventListener('loadedmetadata', onMeta, { once: true });

        setTimeout(() => {
          if (resolved) return;
          if (!matchesRecoverySeq(seq)) return;
          attemptReload();
          audio.addEventListener('loadedmetadata', () => {
            if (resolved) return;
            resolved = true;
            if (!matchesRecoverySeq(seq)) return;
            recoveryState.ignoreNextEnded = false;
            if (allowSeekResume && resumeAt > 0 && audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
              audio.currentTime = resumeAt;
            }
            audio.play().catch((e) => console.error('[player] resume second reload failed:', e));
          }, { once: true });
        }, 2500);
      })();
      return;
    }

    audio.play().catch((err) => {
      console.error('[player] resume() failed:', err);
      if (!state.currentTrack) return;

      const recoverable = (
        err?.name === 'AbortError' ||
        err?.name === 'NotSupportedError' ||
        audio.networkState === audio.NETWORK_NO_SOURCE ||
        audio.readyState === 0
      );
      if (!recoverable) return;

      const track = state.currentTrack;
      const resumeAt = state.currentTime;
      const seq = nextRecoverySeq();
      recoveryState.ignoreNextEnded = true;
      clearEndedTimer();
      (async () => {
        if (state.transcodeActive) {
          state.transcodeWaiting = true;
          await waitForTranscodeReady(track._id, getTranscodeWaitMs(track, { hidden: false }));
        }
        if (!matchesRecoverySeq(seq)) return;
        setTrackSource(track, { forceTranscode: state.transcodeActive, markWaiting: state.transcodeActive });
        audio.load();
        audio.addEventListener('loadedmetadata', () => {
          if (!matchesRecoverySeq(seq)) return;
          recoveryState.ignoreNextEnded = false;
          if (resumeAt > 0 && audio.seekable.length > 0 && audio.seekable.end(0) >= resumeAt) {
            audio.currentTime = resumeAt;
          }
          audio.play().catch((e) => console.error('[player] resume() reload retry failed:', e));
        }, { once: true });
      })();
    });
  }

  return {
    handleError,
    handleEnded,
    resumePlayback,
    installPlayStartGuard,
    clearEndedTimer,
    setIgnoreNextEnded,
    nextRecoverySeq,
    matchesRecoverySeq,
    resetTranscodeAttempted,
    setConsecutiveErrors,
  };
}
