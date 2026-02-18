import chokidar from 'chokidar';
import config from '../config.js';
import { handleFileAdd, handleFileRemove, handleImageAdd, handleImageRemove } from './scanner.js';
import { broadcast } from './events.js';
import { createLogger } from '../logger.js';

const log = createLogger('watcher', 'cyan');

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
  await handleImageAdd(filePath);
  scheduleBroadcast();
}

async function onRemove(filePath) {
  await handleFileRemove(filePath);
  await handleImageRemove(filePath);
  scheduleBroadcast();
}

export function startWatcher() {
  if (!config.musicDir) {
    log.warn('MUSIC_DIR not set, skipping file watcher');
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
    .on('error', (err) => log.error('Error:', err.message))
    .on('ready', () => log.success(`Watching ${config.musicDir}`));
}

export function pauseWatcher() {
  if (watcher) {
    watcher.unwatch(config.musicDir);
    log.log('Paused during scan');
  }
}

export function resumeWatcher() {
  if (watcher) {
    watcher.add(config.musicDir);
    log.log('Resumed after scan');
  }
}

export function stopWatcher() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
}
