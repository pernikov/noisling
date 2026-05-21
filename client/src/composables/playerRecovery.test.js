import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayerRecovery } from './playerRecovery.js';

function makeTrack(id, extra = {}) {
  return { _id: id, title: `Track ${id}`, duration: 120, ...extra };
}

function createAudioStub() {
  return {
    currentTime: 0,
    duration: 0,
    readyState: 4,
    playbackRate: 1,
    networkState: 1,
    error: null,
    seekable: {
      length: 1,
      end: () => 999,
    },
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    addEventListener: vi.fn(),
    removeAttribute: vi.fn(),
  };
}

function createRecoveryHarness(overrides = {}) {
  const state = reactive({
    currentTrack: makeTrack('1'),
    currentTime: 12,
    duration: 120,
    repeat: 'off',
    transcodeActive: false,
    isPlaying: true,
  });

  const audio = overrides.audio ?? createAudioStub();
  const api = {
    warmTranscode: vi.fn(() => Promise.resolve({ status: 'ready' })),
    ...overrides.api,
  };
  const setTrackSource = vi.fn();
  const waitForTranscodeReady = vi.fn(() => Promise.resolve(true));
  const getTranscodeWaitMs = vi.fn(() => 8000);
  const play = vi.fn();
  const next = vi.fn();
  const needsTranscode = overrides.needsTranscode ?? (() => false);

  const recovery = createPlayerRecovery({
    state,
    audio,
    api,
    needsTranscode,
    setTrackSource,
    waitForTranscodeReady,
    getTranscodeWaitMs,
    play,
    next,
  });

  return { state, audio, api, setTrackSource, waitForTranscodeReady, getTranscodeWaitMs, play, next, recovery };
}

beforeEach(() => {
  vi.useFakeTimers();
  globalThis.MediaError = {
    MEDIA_ERR_ABORTED: 1,
    MEDIA_ERR_NETWORK: 2,
    MEDIA_ERR_DECODE: 3,
    MEDIA_ERR_SRC_NOT_SUPPORTED: 4,
  };
});

describe('createPlayerRecovery', () => {
  it('suppresses spurious ended events while the play-start guard is active', () => {
    const { audio, next, play, recovery } = createRecoveryHarness();
    recovery.installPlayStartGuard(makeTrack('1'));
    audio.readyState = 0;
    audio.currentTime = 0;

    recovery.handleEnded();

    expect(next).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });

  it('advances to the next track on a natural end when repeat is off', async () => {
    const { state, audio, next, recovery } = createRecoveryHarness();
    state.currentTrack = makeTrack('1', { duration: 120 });
    state.currentTime = 120;
    state.duration = 120;
    audio.currentTime = 120;
    audio.duration = 120;

    recovery.handleEnded();

    expect(next).toHaveBeenCalledWith({ preserveMediaSession: true });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('repeats one-track natural ends without tearing down the media session', () => {
    const { state, audio, play, recovery } = createRecoveryHarness();
    state.repeat = 'one';
    state.currentTrack = makeTrack('1', { duration: 120 });
    state.currentTime = 120;
    state.duration = 120;
    audio.currentTime = 120;
    audio.duration = 120;

    recovery.handleEnded();

    expect(play).toHaveBeenCalledWith(state.currentTrack, { preserveMediaSession: true });
  });

  it('stops playback after three consecutive unrecoverable errors', () => {
    const { state, audio, next, recovery } = createRecoveryHarness();
    audio.error = { code: 99, message: 'boom' };

    recovery.handleError();
    recovery.handleError();
    recovery.handleError();

    expect(next).toHaveBeenCalledTimes(2);
    expect(state.isPlaying).toBe(false);
  });

  it('reloads the current source during force-resume when playback is stuck', async () => {
    const { state, audio, setTrackSource, waitForTranscodeReady, getTranscodeWaitMs, recovery } = createRecoveryHarness();
    state.transcodeActive = true;
    audio.error = { code: 2, message: 'network' };

    recovery.resumePlayback({
      forceReload: true,
      maybeResumeVisualizerContext: vi.fn(),
    });

    await Promise.resolve();

    expect(state.transcodeWaiting).toBe(true);
    expect(getTranscodeWaitMs).toHaveBeenCalledWith(expect.objectContaining({ _id: '1' }), { hidden: false });
    expect(waitForTranscodeReady).toHaveBeenCalledWith('1', 8000);
    expect(audio.removeAttribute).toHaveBeenCalledWith('src');
    expect(setTrackSource).toHaveBeenCalledWith(
      expect.objectContaining({ _id: '1' }),
      expect.objectContaining({
        forceTranscode: true,
        markWaiting: false,
        cacheBust: true,
      }),
    );
  });
});
