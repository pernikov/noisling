import { computed, reactive } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlayerQueue } from './playerQueue.js';

function makeTrack(id, title = `Track ${id}`) {
  return { _id: id, title };
}

function createQueueHarness(overrides = {}) {
  const state = reactive({
    currentTrack: null,
    queue: [],
    queueIndex: -1,
    largeQueueIds: [],
    queueLoading: false,
    queueTotal: 0,
    queueBufferOffset: 0,
    isLargeQueue: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    shuffle: false,
    repeat: 'off',
    originalQueue: [],
    showQueue: false,
    transcodeWaiting: false,
    transcodeActive: false,
  });

  const audio = { currentTime: 0 };
  const api = {
    getTracksByIds: vi.fn(() => Promise.resolve([])),
    shuffleQueue: vi.fn(() => Promise.resolve({ total: 0, ids: [], tracks: [] })),
    warmTranscode: vi.fn(() => Promise.resolve({ status: 'ready' })),
    ...overrides.api,
  };
  const play = vi.fn((track) => {
    state.currentTrack = track;
  });
  const needsTranscode = overrides.needsTranscode ?? (() => false);

  const queue = createPlayerQueue({
    state,
    audio,
    api,
    play,
    needsTranscode,
  });

  return { state, audio, api, play, queue };
}

beforeEach(() => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value: 'visible',
  });
});

describe('createPlayerQueue', () => {
  it('plays an album from the requested start index when shuffle is off', () => {
    const { state, play, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];

    queue.playAlbum(tracks, 1);

    expect(state.queue.map((track) => track._id)).toEqual(['1', '2', '3']);
    expect(state.queueIndex).toBe(1);
    expect(state.originalQueue.map((track) => track._id)).toEqual(['1', '2', '3']);
    expect(play).toHaveBeenCalledWith(tracks[1]);
  });

  it('plays an album in order and clears shuffle when shuffle was previously on', () => {
    const { state, play, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    state.shuffle = true;

    queue.playAlbum(tracks, 1);

    expect(state.shuffle).toBe(false);
    expect(state.queue.map((track) => track._id)).toEqual(['1', '2', '3']);
    expect(state.queueIndex).toBe(1);
    expect(state.originalQueue.map((track) => track._id)).toEqual(['1', '2', '3']);
    expect(play).toHaveBeenCalledWith(tracks[1]);
  });

  it('keeps the current track first when shuffle is toggled on', async () => {
    const { state, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[1];
    state.queueIndex = 1;

    queue.toggleShuffle();

    expect(state.shuffle).toBe(true);
    expect(state.queue[0]._id).toBe('2');
    expect(new Set(state.queue.map((track) => track._id))).toEqual(new Set(['1', '2', '3']));
    expect(state.queueIndex).toBe(0);
  });

  it('restores the original queue order when shuffle is toggled back off', () => {
    const { state, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];

    state.queue = [tracks[1], tracks[2], tracks[0]];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[1];
    state.queueIndex = 0;
    state.shuffle = true;

    queue.toggleShuffle();

    expect(state.shuffle).toBe(false);
    expect(state.queue.map((track) => track._id)).toEqual(['1', '2', '3']);
    expect(state.queueIndex).toBe(1);
  });

  it('starts shuffled playback from an explicit shuffled action', () => {
    const { state, play, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.75);

    queue.playShuffled(tracks);

    expect(state.shuffle).toBe(true);
    expect(state.queue[0]._id).toBe('3');
    expect(new Set(state.queue.map((track) => track._id))).toEqual(new Set(['1', '2', '3']));
    expect(state.originalQueue.map((track) => track._id)).toEqual(['1', '2', '3']);
    expect(state.queueIndex).toBe(0);
    expect(play).toHaveBeenCalledWith(state.queue[0]);

    randomSpy.mockRestore();
  });

  it('clears playback state when advancing past the last track with repeat off', () => {
    const { state, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[1];
    state.queueIndex = 1;
    state.isPlaying = true;
    state.showQueue = true;

    queue.next();

    expect(state.currentTrack).toBe(null);
    expect(state.queue).toEqual([]);
    expect(state.queueIndex).toBe(-1);
    expect(state.isPlaying).toBe(false);
    expect(state.showQueue).toBe(false);
  });

  it('keeps only the current track in the queue', () => {
    const { state, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[1];
    state.queueIndex = 1;

    queue.keepCurrentOnly();

    expect(state.queue).toEqual([tracks[1]]);
    expect(state.originalQueue).toEqual([tracks[1]]);
    expect(state.queueIndex).toBe(0);
    expect(state.isLargeQueue).toBe(false);
    expect(state.queueLoading).toBe(false);
    expect(state.queueTotal).toBe(0);
    expect(state.queueBufferOffset).toBe(0);
    expect(state.largeQueueIds).toEqual([]);
  });

  it('exposes hasNext and hasPrev based on queue position', () => {
    const { state, audio, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    state.queue = [...tracks];
    state.queueIndex = 1;

    expect(queue.hasNext.value).toBe(true);
    expect(queue.hasPrev.value).toBe(true);

    state.queueIndex = 0;
    audio.currentTime = 0;
    expect(queue.hasPrev.value).toBe(false);

    state.queueIndex = 2;
    expect(queue.hasNext.value).toBe(false);
  });

  it('removes a queued track before the current one and keeps indexes aligned', () => {
    const { state, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[2];
    state.queueIndex = 2;

    queue.removeTrack(1);

    expect(state.queue.map((track) => track._id)).toEqual(['1', '3']);
    expect(state.originalQueue.map((track) => track._id)).toEqual(['1', '3']);
    expect(state.queueIndex).toBe(1);
    expect(state.currentTrack?._id).toBe('3');
  });

  it('removes the current track and immediately plays the next available one', () => {
    const { state, play, queue } = createQueueHarness();
    const tracks = [makeTrack('1'), makeTrack('2'), makeTrack('3')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[1];
    state.queueIndex = 1;

    queue.removeTrack(1);

    expect(state.queue.map((track) => track._id)).toEqual(['1', '3']);
    expect(state.originalQueue.map((track) => track._id)).toEqual(['1', '3']);
    expect(state.queueIndex).toBe(1);
    expect(play).toHaveBeenLastCalledWith(tracks[2]);
    expect(state.currentTrack?._id).toBe('3');
  });

  it('starts the next transcoded track immediately in the foreground', () => {
    const { state, api, play, queue } = createQueueHarness({
      needsTranscode: () => true,
    });
    const tracks = [makeTrack('1'), makeTrack('2')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[0];
    state.queueIndex = 0;

    queue.next();

    expect(state.queueIndex).toBe(1);
    expect(play).toHaveBeenCalledWith(tracks[1]);
    expect(api.warmTranscode).not.toHaveBeenCalled();
  });

  it('starts the next transcoded track immediately in the background', () => {
    const { state, api, play, queue } = createQueueHarness({
      needsTranscode: () => true,
    });
    const tracks = [makeTrack('1'), makeTrack('2')];
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    state.currentTrack = tracks[0];
    state.queueIndex = 0;
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      value: 'hidden',
    });

    queue.next();

    expect(state.queueIndex).toBe(1);
    expect(play).toHaveBeenCalledWith(tracks[1]);
    expect(api.warmTranscode).not.toHaveBeenCalled();
  });
});
