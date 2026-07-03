import { readdir, stat, readFile } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { parseFile } from 'music-metadata';
import Track from '../models/Track.js';
import Playlist from '../models/Playlist.js';
import config from '../config.js';
import { broadcast } from './events.js';
import { createLogger } from '../logger.js';
import {
  IMAGE_EXTENSIONS,
  isAudioFile,
  isImageFile,
  pickFolderCover,
  buildTrackData,
} from './scannerHelpers.js';
import { cleanupOrphanedCovers, removeCoverIfUnused, saveCoverFile } from './coverStorage.js';

const log = createLogger('scanner', 'yellow');
const wlog = createLogger('watcher', 'cyan');

const BATCH_SIZE = 5;

async function walkDir(dir) {
  const files = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (err) {
    log.warn(`Skipping unreadable directory: ${dir} (${err.message})`);
    return files;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walkDir(fullPath));
    } else if (isAudioFile(entry.name)) {
      files.push(fullPath);
    }
  }

  return files;
}

async function findFolderCover(audioFilePath) {
  const dir = dirname(audioFilePath);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }

  const coverEntry = pickFolderCover(entries);
  return coverEntry ? join(dir, coverEntry) : null;
}

async function extractCover(metadata, audioFilePath) {
  const pictures = metadata.common.picture;

  // 1. Use embedded cover art if available
  if (pictures && pictures.length > 0) {
    const pic = pictures[0];
    const mimeToExt = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'image/bmp': '.bmp',
      'image/tiff': '.tiff',
      'image/avif': '.avif',
    };
    const ext = mimeToExt[pic.format] || '.jpg';
    const cover = await saveCoverFile(pic.data, ext);
    return { cover, hasEmbeddedCover: true };
  }

  // 2. Look for a cover image file in the same folder
  const folderCover = await findFolderCover(audioFilePath);
  if (folderCover) {
    const data = await readFile(folderCover);
    const ext = extname(folderCover).toLowerCase();
    const cover = await saveCoverFile(data, ext === '.jpeg' ? '.jpg' : ext);
    return { cover, hasEmbeddedCover: false };
  }

  return { cover: '', hasEmbeddedCover: false };
}

async function processFile(filePath) {
  const metadata = await parseFile(filePath);
  const fileStat = await stat(filePath);
  const { cover, hasEmbeddedCover } = await extractCover(metadata, filePath);

  return buildTrackData({
    filePath,
    metadata,
    fileStat,
    cover,
    hasEmbeddedCover,
  });
}

async function processBatch(filePaths) {
  const results = await Promise.allSettled(filePaths.map((fp) => processFile(fp)));
  return results.map((r, i) => ({
    path: filePaths[i],
    status: r.status,
    data: r.status === 'fulfilled' ? r.value : null,
    error: r.status === 'rejected' ? r.reason.message : null,
  }));
}

// Upsert a single file — preserves playCount and lastPlayedAt
async function upsertFile(filePath) {
  const trackData = await processFile(filePath);
  await Track.updateOne(
    { path: filePath },
    { $set: trackData, $setOnInsert: { playCount: 0, lastPlayedAt: null } },
    { upsert: true },
  );
}

// `forceMetadata` is intentionally supported for one-off backfills when Noisling
// starts reading a new tag field. We keep it out of the normal UI because
// day-to-day rescans should rely on file mtime changes instead.
export async function scanLibrary({ forceMetadata = false } = {}) {
  if (!config.musicDir) {
    throw new Error('MUSIC_DIR is not set in .env');
  }

  log.info(`Scanning: ${config.musicDir}${forceMetadata ? ' (forced metadata refresh)' : ''}`);
  broadcast('scan-progress', {
    phase: 'walking',
    message: forceMetadata ? 'Discovering files for metadata refresh...' : 'Discovering files...',
    forceMetadata,
  });

  const files = await walkDir(config.musicDir);
  const total = files.length;
  log.log(`Found ${total} audio files`);

  // Build a map of existing tracks keyed by path
  const existingTracks = await Track.find({}, { path: 1, fileMtime: 1 }).lean();
  const existingMap = new Map(existingTracks.map((t) => [t.path, t.fileMtime]));

  const stats = { added: 0, updated: 0, skipped: 0, removed: 0, errors: 0, forceMetadata };
  const scannedPaths = new Set();

  // Split files into those that need processing vs those we can skip
  const toProcess = [];
  for (const filePath of files) {
    scannedPaths.add(filePath);
    let fileStat;
    try {
      fileStat = await stat(filePath);
    } catch (err) {
      log.warn(`Skipping missing/unreadable file: ${filePath} (${err.message})`);
      stats.errors++;
      continue;
    }
    const existingMtime = existingMap.get(filePath);

    if (!forceMetadata && existingMtime !== undefined && Math.abs(fileStat.mtimeMs - existingMtime) < 1000) {
      stats.skipped++;
    } else {
      toProcess.push({ filePath, isNew: existingMtime === undefined });
    }
  }

  const needProcessing = toProcess.length;
  log.log(`Processing ${needProcessing} files (${stats.skipped} unchanged)`);
  broadcast('scan-progress', {
    phase: 'processing',
    total,
    toProcess: needProcessing,
    skipped: stats.skipped,
    forceMetadata,
  });

  // Process in batches
  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const results = await processBatch(batch.map((b) => b.filePath));

    // Bulk upsert the successful results
    const bulkOps = [];
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === 'fulfilled') {
        bulkOps.push({
          updateOne: {
            filter: { path: result.path },
            update: { $set: result.data, $setOnInsert: { playCount: 0, lastPlayedAt: null } },
            upsert: true,
          },
        });
        if (batch[j].isNew) stats.added++;
        else stats.updated++;
      } else {
        log.error(`Error processing ${result.path}:`, result.error);
        stats.errors++;
      }
    }

    if (bulkOps.length > 0) {
      await Track.bulkWrite(bulkOps);
    }

    const processed = Math.min(i + BATCH_SIZE, toProcess.length);
    broadcast('scan-progress', {
      phase: 'processing',
      processed,
      total: needProcessing,
      percent: Math.round((processed / needProcessing) * 100),
      forceMetadata,
    });
  }

  // Remove tracks whose files no longer exist
  const removedTracks = existingTracks.filter((t) => !scannedPaths.has(t.path));
  if (removedTracks.length > 0) {
    const removedIds = removedTracks.map((t) => t._id);
    const removedPaths = removedTracks.map((t) => t.path);
    await Track.deleteMany({ path: { $in: removedPaths } });
    await Playlist.updateMany({}, { $pull: { trackIds: { $in: removedIds } } });
    stats.removed = removedTracks.length;
  }

  // Clean up cover files no longer referenced by any track
  const coverStats = await cleanupOrphanedCovers(log);
  stats.coversRemoved = coverStats.removed;

  log.success('Scan complete:', stats);
  broadcast('scan-progress', { phase: 'complete', stats, forceMetadata });
  return stats;
}

// Process a single file event from chokidar
export async function handleFileAdd(filePath) {
  if (!isAudioFile(filePath)) return;
  try {
    wlog.log(`Adding/updating: ${filePath}`);
    await upsertFile(filePath);
  } catch (err) {
    wlog.error(`Error processing ${filePath}:`, err.message);
  }
}

export async function handleFileRemove(filePath) {
  if (!isAudioFile(filePath)) return;
  wlog.log(`Removing: ${filePath}`);

  const track = await Track.findOneAndDelete({ path: filePath });

  if (track) {
    await Playlist.updateMany({}, { $pull: { trackIds: track._id } });
  }

  // If the deleted track had a cover, check if any other track still uses it
  if (track?.cover) {
    const removed = await removeCoverIfUnused(track.cover);
    if (removed) wlog.log(`Removed orphaned cover: ${track.cover}`);
  }

  if (track?.overrides?.cover) {
    const removed = await removeCoverIfUnused(track.overrides.cover);
    if (removed) wlog.log(`Removed orphaned cover: ${track.overrides.cover}`);
  }
}

// Handle a cover image added/changed in an album folder
export async function handleImageAdd(imagePath) {
  if (!isImageFile(imagePath)) return;
  const dir = dirname(imagePath);

  // Find tracks in the same folder that don't have an embedded cover
  const tracks = await Track.find({
    path: { $regex: `^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+$` },
    hasEmbeddedCover: { $ne: true },
  });

  if (tracks.length === 0) return;

  try {
    const data = await readFile(imagePath);
    const ext = extname(imagePath).toLowerCase();
    const coverFilename = await saveCoverFile(data, ext === '.jpeg' ? '.jpg' : ext);

    const oldCovers = new Set(tracks.map((t) => t.cover).filter(Boolean));

    await Track.updateMany(
      { _id: { $in: tracks.map((t) => t._id) } },
      { $set: { cover: coverFilename } },
    );

    // Clean up old folder covers that are no longer referenced
    for (const oldCover of oldCovers) {
      if (oldCover === coverFilename) continue;
      await removeCoverIfUnused(oldCover);
    }

    wlog.success(`Updated cover for ${tracks.length} track(s) in ${dir}`);
  } catch (err) {
    wlog.error(`Error processing cover image ${imagePath}:`, err.message);
  }
}

// Handle a cover image removed from an album folder
export async function handleImageRemove(imagePath) {
  if (!isImageFile(imagePath)) return;
  const dir = dirname(imagePath);

  // Find tracks in this folder without embedded covers
  const tracks = await Track.find({
    path: { $regex: `^${dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/[^/]+$` },
    hasEmbeddedCover: { $ne: true },
  });

  if (tracks.length === 0) return;

  // Try to find another cover image in the folder
  const altCover = await findFolderCover(tracks[0].path);
  let newCoverFilename = '';

  if (altCover) {
    const data = await readFile(altCover);
    const ext = extname(altCover).toLowerCase();
    newCoverFilename = await saveCoverFile(data, ext === '.jpeg' ? '.jpg' : ext);
  }

  const oldCovers = new Set(tracks.map((t) => t.cover).filter(Boolean));

  await Track.updateMany(
    { _id: { $in: tracks.map((t) => t._id) } },
    { $set: { cover: newCoverFilename } },
  );

  // Clean up old covers no longer referenced
  for (const oldCover of oldCovers) {
    if (oldCover === newCoverFilename) continue;
    await removeCoverIfUnused(oldCover);
  }

  wlog.log(`${altCover ? 'Replaced' : 'Cleared'} cover for ${tracks.length} track(s) in ${dir}`);
}
