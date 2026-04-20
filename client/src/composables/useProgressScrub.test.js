import { computed, reactive } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import { useProgressScrub } from './useProgressScrub.js';

describe('useProgressScrub', () => {
  it('pins progress to the start while playback is still starting', () => {
    const state = reactive({
      currentTime: 37,
      duration: 180,
      progressLocked: true,
    });

    const { displayPercent, displayTime } = useProgressScrub({
      state,
      seek: vi.fn(),
    });

    expect(displayPercent.value).toBe(0);
    expect(displayTime.value).toBe(0);
  });

  it('uses the real playback position once progress is unlocked', () => {
    const state = reactive({
      currentTime: 45,
      duration: 180,
      progressLocked: false,
    });

    const { displayPercent, displayTime } = useProgressScrub({
      state,
      seek: vi.fn(),
    });

    expect(displayPercent.value).toBe(25);
    expect(displayTime.value).toBe(45);
  });

  it('does not start scrubbing while startup progress is locked', () => {
    const state = reactive({
      currentTime: 0,
      duration: 180,
      progressLocked: true,
    });
    const seek = vi.fn();
    const { isScrubbing, startMouseScrub } = useProgressScrub({ state, seek });

    startMouseScrub({
      currentTarget: {
        getBoundingClientRect: () => ({ left: 0, width: 100 }),
      },
      clientX: 40,
    });

    expect(isScrubbing.value).toBe(false);
    expect(seek).not.toHaveBeenCalled();
  });
});
