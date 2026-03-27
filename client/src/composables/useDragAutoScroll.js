import { onUnmounted } from 'vue';

const EDGE_THRESHOLD = 56;
const MAX_SCROLL_STEP = 22;

function isScrollable(element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return ['auto', 'scroll', 'overlay'].includes(overflowY) && element.scrollHeight > element.clientHeight;
}

export function findScrollTarget(startElement) {
  let current = startElement instanceof HTMLElement ? startElement : null;

  while (current) {
    if (isScrollable(current)) return current;
    current = current.parentElement;
  }

  return window;
}

function getMetrics(target) {
  if (target === window) {
    const doc = document.documentElement;
    return {
      top: 0,
      bottom: window.innerHeight,
      scrollTop: window.scrollY,
      maxScrollTop: Math.max(0, doc.scrollHeight - window.innerHeight),
    };
  }

  const rect = target.getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    scrollTop: target.scrollTop,
    maxScrollTop: Math.max(0, target.scrollHeight - target.clientHeight),
  };
}

function scrollTargetBy(target, delta) {
  if (!delta) return;
  if (target === window) window.scrollBy(0, delta);
  else target.scrollTop += delta;
}

function getScrollDelta(clientY, metrics) {
  if (clientY < metrics.top + EDGE_THRESHOLD && metrics.scrollTop > 0) {
    const strength = 1 - Math.max(0, clientY - metrics.top) / EDGE_THRESHOLD;
    return -Math.ceil(MAX_SCROLL_STEP * strength);
  }

  if (clientY > metrics.bottom - EDGE_THRESHOLD && metrics.scrollTop < metrics.maxScrollTop) {
    const strength = 1 - Math.max(0, metrics.bottom - clientY) / EDGE_THRESHOLD;
    return Math.ceil(MAX_SCROLL_STEP * strength);
  }

  return 0;
}

export function useDragAutoScroll(options = {}) {
  let target = null;
  let clientY = null;
  let frameId = null;
  let cleanupRegistered = false;

  function pause() {
    clientY = null;
    if (frameId !== null) {
      window.cancelAnimationFrame(frameId);
      frameId = null;
    }
  }

  function onWindowBlur() {
    stop();
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'visible') stop();
  }

  function onGlobalDragOver(e) {
    if (!target) return;

    const metrics = getMetrics(target);
    const insideActiveBand =
      target === window ||
      (e.clientY >= metrics.top - EDGE_THRESHOLD && e.clientY <= metrics.bottom + EDGE_THRESHOLD);

    if (!insideActiveBand) {
      pause();
      options.onPause?.();
      return;
    }

    clientY = e.clientY;
    ensureRunning();
  }

  function registerCleanupListeners() {
    if (cleanupRegistered) return;
    cleanupRegistered = true;
    window.addEventListener('dragend', stop);
    window.addEventListener('drop', stop);
    window.addEventListener('dragover', onGlobalDragOver, true);
    window.addEventListener('mouseup', stop);
    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
  }

  function unregisterCleanupListeners() {
    if (!cleanupRegistered) return;
    cleanupRegistered = false;
    window.removeEventListener('dragend', stop);
    window.removeEventListener('drop', stop);
    window.removeEventListener('dragover', onGlobalDragOver, true);
    window.removeEventListener('mouseup', stop);
    window.removeEventListener('blur', onWindowBlur);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }

  function step() {
    if (!target || clientY === null) {
      frameId = null;
      return;
    }

    const metrics = getMetrics(target);
    const delta = getScrollDelta(clientY, metrics);

    if (delta !== 0) {
      scrollTargetBy(target, delta);
      options.onScroll?.(clientY);
      frameId = window.requestAnimationFrame(step);
      return;
    }

    frameId = null;
  }

  function ensureRunning() {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(step);
  }

  function start(nextTarget, nextClientY = null) {
    target = nextTarget;
    clientY = nextClientY;
    if (target) registerCleanupListeners();
    if (target && clientY !== null) ensureRunning();
  }

  function update(nextClientY) {
    clientY = nextClientY;
    if (target && clientY !== null) ensureRunning();
  }

  function stop() {
    target = null;
    pause();
    unregisterCleanupListeners();
    options.onStop?.();
  }

  onUnmounted(stop);

  return { start, update, stop };
}
