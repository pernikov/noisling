import { reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayerMediaSession } from './playerMediaSession.js';

function createHarness() {
  const state = reactive({
    currentTrack: { _id: '1', title: 'Current Track' },
    queue: [{ _id: '1', title: 'Current Track' }, { _id: '2', title: 'Next Track' }],
    queueIndex: 0,
    transcodeActive: false,
    duration: 180,
    isPlaying: false,
  });

  const audio = {
    paused: true,
    ended: false,
    currentTime: 45,
    playbackRate: 1,
    pause: vi.fn(),
  };

  const api = {
    coverUrl: vi.fn((cover) => `/covers/${cover}`),
  };

  const play = vi.fn();
  const resume = vi.fn();
  const prev = vi.fn();
  const next = vi.fn();
  const seek = vi.fn();

  const actionHandlers = new Map();
  const mediaSession = {
    playbackState: 'none',
    metadata: null,
    setPositionState: vi.fn(),
    setActionHandler: vi.fn((name, handler) => {
      actionHandlers.set(name, handler);
    }),
  };

  globalThis.MediaMetadata = class {
    constructor(init) {
      Object.assign(this, init);
    }
  };
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaSession },
  });

  const media = createPlayerMediaSession({
    state,
    audio,
    api,
    play,
    resume,
    prev,
    next,
    seek,
  });

  return { state, audio, api, play, resume, prev, next, seek, mediaSession, actionHandlers, media };
}

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});

describe('createPlayerMediaSession', () => {
  it('updates media metadata with cover artwork', () => {
    const { media, mediaSession } = createHarness();

    media.updateMediaSession({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      cover: 'abc.jpg',
    });

    expect(mediaSession.metadata).toMatchObject({
      title: 'Song',
      artist: 'Artist',
      album: 'Album',
      artwork: [{ src: '/covers/abc.jpg', sizes: '512x512', type: 'image/jpeg' }],
    });
  });

  it('syncs playback state from the audio element', () => {
    const { state, audio, mediaSession, media } = createHarness();
    audio.paused = false;
    audio.ended = false;

    media.syncPlaybackStateFromElement();

    expect(state.isPlaying).toBe(true);
    expect(mediaSession.playbackState).toBe('playing');
  });

  it('registers media action handlers and routes foreground play to resume(true)', () => {
    const { actionHandlers, resume } = createHarness();

    actionHandlers.get('play')();

    expect(resume).toHaveBeenCalledWith(true);
  });

  it('restarts the current track instead of resuming when hidden on transcoded playback', () => {
    const { state, actionHandlers, play, resume } = createHarness();
    state.transcodeActive = true;
    state.queueIndex = -1;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    actionHandlers.get('play')();

    expect(play).toHaveBeenCalledWith(state.currentTrack);
    expect(state.queueIndex).toBe(0);
    expect(resume).not.toHaveBeenCalled();
  });

  it('routes seek and pause actions to the expected callbacks', () => {
    const { actionHandlers, audio, seek, prev, next } = createHarness();

    actionHandlers.get('seekto')({ seekTime: 12 });
    actionHandlers.get('pause')();
    actionHandlers.get('previoustrack')();
    actionHandlers.get('nexttrack')();

    expect(seek).toHaveBeenCalledWith(12);
    expect(audio.pause).toHaveBeenCalled();
    expect(prev).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
