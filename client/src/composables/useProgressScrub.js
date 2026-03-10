import { ref, computed } from 'vue';

export function formatTime(seconds) {
  if (seconds == null || isNaN(seconds)) return '0:00';
  if (!isFinite(seconds)) return '--:--';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Shared progress-bar scrubbing state and mouse-drag logic.
 *
 * @param {object} options
 * @param {object} options.state   - Reactive player state (needs .currentTime, .duration)
 * @param {Function} options.seek  - seek(seconds) function
 */
export function useProgressScrub({ state, seek }) {
  const isScrubbing = ref(false);
  const scrubPercent = ref(0);

  const displayPercent = computed(() => {
    if (isScrubbing.value) return scrubPercent.value;
    if (!state.duration || !isFinite(state.duration)) return 0;
    return (state.currentTime / state.duration) * 100;
  });

  const displayTime = computed(() => {
    if (isScrubbing.value && state.duration) return scrubPercent.value / 100 * state.duration;
    return state.currentTime;
  });

  /**
   * Start a mouse-drag scrub session.
   *
   * @param {MouseEvent} e
   * @param {object} [opts]
   * @param {boolean} [opts.seekDuringDrag=true] - Whether to call seek() on every mousemove.
   *   Pass false (PlayerBar) to seek only on release; true (NowPlayingModal) for live seeking.
   * @param {Function} [opts.onStart] - Called once at the very start of the drag.
   * @param {Function} [opts.onEnd]   - Called once when the mouse is released.
   */
  function startMouseScrub(e, { seekDuringDrag = true, onStart, onEnd } = {}) {
    if (!state.duration || !isFinite(state.duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clamp = (x) => Math.max(0, Math.min(100, (x - rect.left) / rect.width * 100));

    isScrubbing.value = true;
    scrubPercent.value = clamp(e.clientX);
    onStart?.();
    if (seekDuringDrag) seek(scrubPercent.value / 100 * state.duration);

    const onMove = (ev) => {
      scrubPercent.value = clamp(ev.clientX);
      if (seekDuringDrag) seek(scrubPercent.value / 100 * state.duration);
    };

    const onUp = (ev) => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      scrubPercent.value = clamp(ev.clientX);
      seek(scrubPercent.value / 100 * state.duration);
      isScrubbing.value = false;
      onEnd?.();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return { isScrubbing, scrubPercent, displayPercent, displayTime, startMouseScrub };
}
