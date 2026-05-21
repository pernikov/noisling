const DEFAULT_MAX_ACTIVE = 6;

let activeLoads = 0;
const pendingLoads = [];

function scheduleIdle(callback) {
  if (typeof window === 'undefined') return setTimeout(callback, 0);
  if ('requestIdleCallback' in window) {
    return window.requestIdleCallback(callback, { timeout: 400 });
  }
  return window.setTimeout(callback, 0);
}

function cancelIdle(handle) {
  if (typeof window === 'undefined') {
    clearTimeout(handle);
    return;
  }
  if ('cancelIdleCallback' in window) window.cancelIdleCallback(handle);
  else window.clearTimeout(handle);
}

function pumpQueue() {
  while (activeLoads < DEFAULT_MAX_ACTIVE && pendingLoads.length) {
    const job = pendingLoads.shift();
    if (job.cancelled) continue;

    activeLoads += 1;
    job.active = true;
    job.idleHandle = scheduleIdle(() => {
      job.idleHandle = null;
      if (job.cancelled) {
        job.done();
        return;
      }
      job.started = true;
      job.start();
    });
  }
}

export function queueDeferredImageLoad(start, { priority = 'normal' } = {}) {
  let fallbackTimer = null;

  const job = {
    active: false,
    cancelled: false,
    idleHandle: null,
    started: false,
    start,
    done() {
      if (!job.active) return;
      job.active = false;
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      activeLoads = Math.max(0, activeLoads - 1);
      pumpQueue();
    },
  };

  const wrappedStart = job.start;
  job.start = () => {
    fallbackTimer = setTimeout(job.done, 15000);
    wrappedStart();
  };

  if (priority === 'high') pendingLoads.unshift(job);
  else pendingLoads.push(job);

  pumpQueue();

  return {
    done: job.done,
    cancel() {
      job.cancelled = true;
      const index = pendingLoads.indexOf(job);
      if (index !== -1) pendingLoads.splice(index, 1);
      if (job.idleHandle) {
        cancelIdle(job.idleHandle);
        job.idleHandle = null;
      }
      job.done();
    },
  };
}
