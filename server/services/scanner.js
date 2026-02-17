import { readdir, stat, mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';
import { parseFile } from 'music-metadata';
import Track from '../models/Track.js';
import config from '../config.js';
import { broadcast } from './events.js';

const AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.ogg', '.m4a', '.aac',
  '.wav', '.aiff', '.wma', '.opus',
]);

const BATCH_SIZE = 5;

function isAudioFile(filePath) {
  return AUDIO_EXTENSIONS.has(extname(filePath).toLowerCase());
}

async function walkDir(dir) {
  const files = [];
  const entries = await readdir(dir, { withFileTypes: true });

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

const COVER_FILENAMES = [
  'cover', 'folder', 'front', 'album', 'art', 'artwork', 'thumb', 'thumbnail',
];

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.tiff', '.avif'];

async function findFolderCover(audioFilePath) {
  const dir = dirname(audioFilePath);
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return null;
  }

  // Build a lookup of lowercase name -> actual name
  const lookup = new Map(entries.map((e) => [e.toLowerCase(), e]));

  // Try known cover filenames first (cover.jpg, folder.png, etc.)
  for (const name of COVER_FILENAMES) {
    for (const ext of IMAGE_EXTENSIONS) {
      const match = lookup.get(`${name}${ext}`);
      if (match) return join(dir, match);
    }
  }

  // Fall back to any image file in the directory
  for (const entry of entries) {
    if (IMAGE_EXTENSIONS.includes(extname(entry).toLowerCase())) {
      return join(dir, entry);
    }
  }

  return null;
}

async function saveCoverFile(data, ext) {
  const hash = createHash('md5').update(data).digest('hex');
  const filename = `${hash}${ext}`;
  const coverPath = join(config.coversDir, filename);

  await mkdir(config.coversDir, { recursive: true });
  await writeFile(coverPath, data);

  return filename;
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
    return saveCoverFile(pic.data, ext);
  }

  // 2. Look for a cover image file in the same folder
  const folderCover = await findFolderCover(audioFilePath);
  if (folderCover) {
    const data = await readFile(folderCover);
    const ext = extname(folderCover).toLowerCase();
    return saveCoverFile(data, ext === '.jpeg' ? '.jpg' : ext);
  }

  return '';
}

async function processFile(filePath) {
  const metadata = await parseFile(filePath);
  const fileStat = await stat(filePath);
  const cover = await extractCover(metadata, filePath);

  const { common, format } = metadata;

  // Prefer the 'Artists' tag (semicolon-separated) over the single 'Artist' tag
  const rawArtists = common.artists?.length
    ? common.artists
    : common.artist
      ? [common.artist]
      : ['Unknown Artist'];
  const artists = rawArtists.flatMap((a) => a.split(';').map((s) => s.trim())).filter(Boolean);

  return {
    path: filePath,
    title: common.title || basename(filePath, extname(filePath)),
    artists: artists.length ? artists : ['Unknown Artist'],
    artistsNorm: (artists.length ? artists : ['Unknown Artist']).map((a) => a.toLowerCase()),
    albumArtist: common.albumartist || artists[0] || '',
    album: common.album || 'Unknown Album',
    trackNumber: common.track?.no || 0,
    disc: common.disk?.no || 1,
    duration: format.duration || 0,
    format: extname(filePath).slice(1).toLowerCase(),
    bitrate: format.bitrate ? Math.round(format.bitrate / 1000) : 0,
    genre: common.genre?.[0] || '',
    year: common.year || 0,
    cover,
    fileSize: fileStat.size,
    fileMtime: fileStat.mtimeMs,
    scannedAt: new Date(),
  };
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

async function cleanupOrphanedCovers() {
  const referencedCovers = await Track.distinct('cover');
  const referencedSet = new Set(referencedCovers.filter(Boolean));

  let files;
  try {
    files = await readdir(config.coversDir);
  } catch {
    return { removed: 0, errors: 0 };
  }

  let removed = 0;
  let errors = 0;

  for (const file of files) {
    if (!referencedSet.has(file)) {
      try {
        await unlink(join(config.coversDir, file));
        removed++;
      } catch (err) {
        console.error(`Error removing orphaned cover ${file}:`, err.message);
        errors++;
      }
    }
  }

  if (removed > 0) {
    console.log(`Cleaned up ${removed} orphaned cover(s)`);
  }
  return { removed, errors };
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

export async function scanLibrary() {
  if (!config.musicDir) {
    throw new Error('MUSIC_DIR is not set in .env');
  }

  console.log(`Scanning: ${config.musicDir}`);
  broadcast('scan-progress', { phase: 'walking', message: 'Discovering files...' });

  const files = await walkDir(config.musicDir);
  const total = files.length;
  console.log(`Found ${total} audio files`);

  // Build a map of existing tracks keyed by path
  const existingTracks = await Track.find({}, { path: 1, fileMtime: 1 }).lean();
  const existingMap = new Map(existingTracks.map((t) => [t.path, t.fileMtime]));

  const stats = { added: 0, updated: 0, skipped: 0, removed: 0, errors: 0 };
  const scannedPaths = new Set();

  // Split files into those that need processing vs those we can skip
  const toProcess = [];
  for (const filePath of files) {
    scannedPaths.add(filePath);
    const fileStat = await stat(filePath);
    const existingMtime = existingMap.get(filePath);

    if (existingMtime !== undefined && Math.abs(fileStat.mtimeMs - existingMtime) < 1000) {
      stats.skipped++;
    } else {
      toProcess.push({ filePath, isNew: existingMtime === undefined });
    }
  }

  const needProcessing = toProcess.length;
  console.log(`Processing ${needProcessing} files (${stats.skipped} unchanged)`);
  broadcast('scan-progress', { phase: 'processing', total, toProcess: needProcessing, skipped: stats.skipped });

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
        console.error(`Error processing ${result.path}:`, result.error);
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
    });
  }

  // Remove tracks whose files no longer exist
  const removedPaths = existingTracks
    .filter((t) => !scannedPaths.has(t.path))
    .map((t) => t.path);
  if (removedPaths.length > 0) {
    await Track.deleteMany({ path: { $in: removedPaths } });
    stats.removed = removedPaths.length;
  }

  // Clean up cover files no longer referenced by any track
  const coverStats = await cleanupOrphanedCovers();
  stats.coversRemoved = coverStats.removed;

  console.log('Scan complete:', stats);
  broadcast('scan-progress', { phase: 'complete', stats });
  return stats;
}

// Process a single file event from chokidar
export async function handleFileAdd(filePath) {
  if (!isAudioFile(filePath)) return;
  try {
    console.log(`[watcher] Adding/updating: ${filePath}`);
    await upsertFile(filePath);
  } catch (err) {
    console.error(`[watcher] Error processing ${filePath}:`, err.message);
  }
}

export async function handleFileRemove(filePath) {
  if (!isAudioFile(filePath)) return;
  console.log(`[watcher] Removing: ${filePath}`);

  const track = await Track.findOneAndDelete({ path: filePath });

  // If the deleted track had a cover, check if any other track still uses it
  if (track?.cover) {
    const stillUsed = await Track.exists({ cover: track.cover });
    if (!stillUsed) {
      try {
        await unlink(join(config.coversDir, track.cover));
        console.log(`[watcher] Removed orphaned cover: ${track.cover}`);
      } catch {
        // cover file may already be gone
      }
    }
  }
}
