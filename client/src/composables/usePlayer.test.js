import { beforeEach, describe, expect, it, vi } from 'vitest';

class FakeAudio {
  constructor() {
    FakeAudio.lastInstance = this;
    this.volume = 1;
    this.paused = true;
    this.ended = false;
    this.currentTime = 0;
    this.duration = 0;
    this.playbackRate = 1;
    this.readyState = 4;
    this.networkState = 1;
    this.error = null;
    this.src = '';
    this.seekable = {
      length: 1,
      end: () => 999,
    };
    this._listeners = new Map();
  }

  canPlayType() {
    return 'probably';
  }

  addEventListener(name, handler) {
    const list = this._listeners.get(name) ?? [];
    list.push(handler);
    this._listeners.set(name, list);
  }

  removeAttribute(name) {
    if (name === 'src') this.src = '';
  }

  load() {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

function setupGlobals() {
  globalThis.Audio = FakeAudio;
  globalThis.MediaMetadata = class {
    constructor(init) {
      Object.assign(this, init);
    }
  };

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      userAgent: 'test',
      platform: 'MacIntel',
      maxTouchPoints: 0,
      mediaSession: {
        metadata: null,
        playbackState: 'none',
        setActionHandler: vi.fn(),
        setPositionState: vi.fn(),
      },
    },
  });

  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
}

async function importUsePlayerWithApi(apiOverrides = {}) {
  const api = {
    getSettings: vi.fn(() => Promise.resolve({})),
    saveSettings: vi.fn(() => Promise.resolve({})),
    toggleLove: vi.fn(() => Promise.resolve({ isLoved: true })),
    warmTranscode: vi.fn(() => Promise.resolve({ status: 'ready' })),
    streamUrl: vi.fn((id) => `/stream/${id}`),
    transcodedStreamUrl: vi.fn((id) => `/stream/${id}/transcoded`),
    coverUrl: vi.fn((cover) => `/covers/${cover}`),
    getTracksByIds: vi.fn(() => Promise.resolve([])),
    shuffleQueue: vi.fn(() => Promise.resolve({ total: 0, ids: [], tracks: [] })),
    reportPlay: vi.fn(() => Promise.resolve({})),
    ...apiOverrides,
  };

  vi.doMock('./useApi.js', () => ({
    useApi: () => api,
  }));

  const mod = await import('./usePlayer.js');
  return { api, ...mod.usePlayer() };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  localStorage.clear();
  setupGlobals();
});

describe('usePlayer orchestration', () => {
  it('loads player prefs from settings into state and audio', async () => {
    const { state, loadPlayerPrefs } = await importUsePlayerWithApi({
      getSettings: vi.fn(() => Promise.resolve({
        volume: 0.4,
        shuffle: true,
        repeatMode: 'all',
      })),
    });

    await loadPlayerPrefs();

    expect(state.volume).toBe(0.4);
    expect(FakeAudio.lastInstance.volume).toBe(0.4);
    expect(state.shuffle).toBe(true);
    expect(state.repeat).toBe('all');
  });

  it('applies a successful love toggle to the track and current player state', async () => {
    const { state, toggleLove } = await importUsePlayerWithApi({
      toggleLove: vi.fn(() => Promise.resolve({ isLoved: true })),
    });
    const track = { _id: 'track-1', isLoved: false };
    state.currentTrack = track;

    await toggleLove(track);

    expect(track.isLoved).toBe(true);
    expect(state.currentTrack.isLoved).toBe(true);
    expect(state.loveToggled).toEqual({ id: 'track-1', isLoved: true });
  });

  it('rolls back the optimistic love toggle when the API request fails', async () => {
    const { state, toggleLove } = await importUsePlayerWithApi({
      toggleLove: vi.fn(() => Promise.reject(new Error('nope'))),
    });
    const track = { _id: 'track-2', isLoved: false };
    state.currentTrack = track;

    await toggleLove(track);

    expect(track.isLoved).toBe(false);
    expect(state.currentTrack.isLoved).toBe(false);
    expect(state.loveToggled).toEqual({ id: 'track-2', isLoved: false });
  });
});
