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

  canPlayType(mime) {
    return mime === 'audio/flac' ? '' : 'probably';
  }

  addEventListener(name, handler) {
    const list = this._listeners.get(name) ?? [];
    list.push(handler);
    this._listeners.set(name, list);
  }

  emit(name) {
    for (const handler of this._listeners.get(name) ?? []) handler();
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

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
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
  setupGlobals();
  globalThis.localStorage.clear();
});

describe('usePlayer orchestration', () => {
  it('loads only volume from settings into state and audio', async () => {
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
    expect(state.shuffle).toBe(false);
    expect(state.repeat).toBe('off');
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

  it('prewarms the next two transcoded tracks in the queue', async () => {
    const warmTranscode = vi.fn(() => Promise.resolve({ status: 'ready' }));

    const { playAlbum } = await importUsePlayerWithApi({ warmTranscode });
    const tracks = [
      { _id: 'track-1', title: 'Current', format: 'mp3' },
      { _id: 'track-2', title: 'Next FLAC', format: 'flac' },
      { _id: 'track-3', title: 'Then FLAC Too', format: 'flac' },
      { _id: 'track-4', title: 'Native AAC', format: 'aac' },
    ];

    playAlbum(tracks, 0);
    await Promise.resolve();

    expect(warmTranscode).toHaveBeenCalledTimes(2);
    expect(warmTranscode).toHaveBeenNthCalledWith(1, 'track-2');
    expect(warmTranscode).toHaveBeenNthCalledWith(2, 'track-3');
  });

  it('waits for warm transcode readiness before assigning a hidden transcoded track source', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    let releaseWarm;
    const warmTranscode = vi.fn(() => new Promise((resolve) => {
      releaseWarm = () => resolve({ status: 'ready' });
    }));

    const { playAlbum, api } = await importUsePlayerWithApi({ warmTranscode });
    const track = { _id: 'track-hidden', title: 'Hidden FLAC', format: 'flac' };

    playAlbum([track], 0);
    await Promise.resolve();

    expect(warmTranscode).toHaveBeenCalledWith('track-hidden');
    expect(FakeAudio.lastInstance.src).toBe('');

    releaseWarm();
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeAudio.lastInstance.src).toBe('/stream/track-hidden/transcoded');
    expect(api.transcodedStreamUrl).toHaveBeenCalledWith('track-hidden');
  });

  it('keeps foreground transcoded playback immediate to preserve the user-gesture path', async () => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'visible',
    });

    const warmTranscode = vi.fn(() => Promise.resolve({ status: 'ready' }));

    const { playAlbum, api } = await importUsePlayerWithApi({ warmTranscode });
    const track = { _id: 'track-visible', title: 'Visible FLAC', format: 'flac' };

    playAlbum([track], 0);
    await Promise.resolve();

    expect(FakeAudio.lastInstance.src).toBe('/stream/track-visible/transcoded');
    expect(api.transcodedStreamUrl).toHaveBeenCalledWith('track-visible');
  });

  it('keeps progress pinned until the new track reports real playback movement', async () => {
    const { state, playAlbum } = await importUsePlayerWithApi();
    const track = { _id: 'track-progress', title: 'Progress Lock', format: 'mp3', duration: 180 };

    playAlbum([track], 0);

    expect(state.progressLocked).toBe(true);
    expect(state.currentTime).toBe(0);

    FakeAudio.lastInstance.emit('playing');
    expect(state.progressLocked).toBe(true);
    expect(state.currentTime).toBe(0);

    FakeAudio.lastInstance.currentTime = 0.02;
    FakeAudio.lastInstance.emit('timeupdate');
    expect(state.progressLocked).toBe(true);
    expect(state.currentTime).toBe(0);

    FakeAudio.lastInstance.currentTime = 0.5;
    FakeAudio.lastInstance.emit('timeupdate');
    expect(state.progressLocked).toBe(false);
    expect(state.currentTime).toBe(0.5);
  });

  it('starts ordered playback in order and clears shuffle when shuffle was previously on', async () => {
    const { state, playAlbum } = await importUsePlayerWithApi();
    const tracks = [
      { _id: 'track-1', title: 'One', format: 'mp3' },
      { _id: 'track-2', title: 'Two', format: 'mp3' },
      { _id: 'track-3', title: 'Three', format: 'mp3' },
    ];

    state.shuffle = true;

    playAlbum(tracks, 1);

    expect(state.shuffle).toBe(false);
    expect(state.queue.map((track) => track._id)).toEqual(['track-1', 'track-2', 'track-3']);
    expect(state.queueIndex).toBe(1);
    expect(state.currentTrack?._id).toBe('track-2');
  });

  it('starts album playback with shuffle and repeat reset for play-once flows', async () => {
    const { state, api, playAlbumOnce } = await importUsePlayerWithApi();
    const tracks = [
      { _id: 'track-1', title: 'One', format: 'mp3' },
      { _id: 'track-2', title: 'Two', format: 'mp3' },
    ];

    state.shuffle = true;
    state.repeat = 'all';

    playAlbumOnce(tracks, 0);

    expect(state.shuffle).toBe(false);
    expect(state.repeat).toBe('off');
    expect(state.queue.map((track) => track._id)).toEqual(['track-1', 'track-2']);
    expect(state.queueIndex).toBe(0);
    expect(state.currentTrack?._id).toBe('track-1');
    expect(api.saveSettings).not.toHaveBeenCalled();
  });

  it('uses the reported server play count for the current track', async () => {
    const { state, api, playAlbum } = await importUsePlayerWithApi({
      reportPlay: vi.fn(() => Promise.resolve({ playCount: 8 })),
    });
    const track = { _id: 'track-1', title: 'One', format: 'mp3', playCount: 7 };

    playAlbum([track], 0);
    FakeAudio.lastInstance.duration = 2;
    FakeAudio.lastInstance.currentTime = 0;
    FakeAudio.lastInstance.emit('timeupdate');
    FakeAudio.lastInstance.currentTime = 1;
    FakeAudio.lastInstance.emit('timeupdate');
    await Promise.resolve();

    expect(api.reportPlay).toHaveBeenCalledWith('track-1');
    expect(track.playCount).toBe(8);
    expect(state.currentTrack.playCount).toBe(8);
    expect(state.lastReportedTrackId).toBe('track-1');
    expect(state.lastReportedPlayCount).toBe(8);
  });
});
