import chokidar from 'chokidar';
import config from '../config.js';
import { handleFileAdd, handleFileRemove } from './scanner.js';
import { broadcast } from './events.js';

let watcher = null;
let broadcastTimer = null;

function scheduleBroadcast() {
  clearTimeout(broadcastTimer);
  broadcastTimer = setTimeout(() => {
    broadcast('library-updated', {});
  }, 500);
}

async function onAdd(filePath) {
  await handleFileAdd(filePath);
  scheduleBroadcast();
}

async function onRemove(filePath) {
  await handleFileRemove(filePath);
  scheduleBroadcast();
}

export function startWatcher() {
  if (!config.musicDir) {
    console.warn('[watcher] MUSIC_DIR not set, skipping file watcher');
    return;
  }

  watcher = chokidar.watch(config.musicDir, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 2000, pollInterval: 200 },
  });

  watcher
    .on('add', onAdd)
    .on('change', onAdd)
    .on('unlink', onRemove)
    .on('error', (err) => console.error('[watcher] Error:', err.message))
    .on('ready', () => console.log(`[watcher] Watching ${config.musicDir}`));
}

export function pauseWatcher() {
  if (watcher) {
    watcher.unwatch(config.musicDir);
    console.log('[watcher] Paused during scan');
  }
}

export function resumeWatcher() {
  if (watcher) {
    watcher.add(config.musicDir);
    console.log('[watcher] Resumed after scan');
  }
}

export function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
