import { Router } from 'express';
import { stat, createReadStream, createWriteStream, unlink } from 'fs';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import mime from 'mime-types';
import Track from '../models/Track.js';
import PlayHistory from '../models/PlayHistory.js';
import config from '../config.js';
import { join } from 'path';

const statAsync = promisify(stat);
const unlinkAsync = promisify(unlink);
const router = Router();

// Transcode cache — persists for the lifetime of the server process.
// transcodeReady: tracks whose temp file is fully written and safe to range-serve.
// transcodeInProgress: tracks currently being transcoded (value = Promise that
//   resolves when the temp file is complete).
const transcodeReady = new Set();
const transcodeInProgress = new Map();

function tempPath(id) {
  return join(tmpdir(), `noisling_tc_${id}.aac`);
}

// Serve a fully-written ADTS file with HTTP range support (same logic as
// regular files, just using the cached temp path).
async function serveCachedTranscode(id, req, res) {
  const path = tempPath(id);
  let st;
  try { st = await statAsync(path); } catch { return false; }

  const size = st.size;
  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': 'audio/aac',
    });
    createReadStream(path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': 'audio/aac',
      'Accept-Ranges': 'bytes',
    });
    createReadStream(path).pipe(res);
  }
  return true;
}

// GET /api/stream/:id/warm — pre-transcode to cache without streaming.
// Called by the client while the current track is playing so the next track's
// cache is ready before playback starts (eliminates the stall/gap on first play).
router.get('/stream/:id/warm', async (req, res) => {
  const track = await Track.findById(req.params.id).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const id = req.params.id;

  // Already done or in progress — nothing to do.
  if (transcodeReady.has(id)) return res.json({ status: 'ready' });
  if (transcodeInProgress.has(id)) return res.json({ status: 'in_progress' });

  // Check if the file is already on disk from a previous server run.
  try {
    await statAsync(tempPath(id));
    transcodeReady.add(id);
    return res.json({ status: 'ready' });
  } catch { /* not on disk */ }

  // Start ffmpeg writing directly to the temp file (no piping to response).
  const ff = spawn('ffmpeg', [
    '-i', track.path,
    '-vn',
    '-c:a', 'aac',
    '-b:a', '320k',
    '-f', 'adts',
    tempPath(id),
  ], { stdio: 'ignore' });

  let resolveTranscode, rejectTranscode;
  const transcodePromise = new Promise((res, rej) => {
    resolveTranscode = res;
    rejectTranscode = rej;
  });
  transcodeInProgress.set(id, transcodePromise);

  ff.on('close', (code) => {
    transcodeInProgress.delete(id);
    if (code === 0) {
      transcodeReady.add(id);
      resolveTranscode();
    } else {
      unlinkAsync(tempPath(id)).catch(() => {});
      rejectTranscode(new Error(`ffmpeg warm exit ${code}`));
    }
  });

  ff.on('error', (err) => {
    console.error('[transcode] warm ffmpeg spawn error:', err);
    transcodeInProgress.delete(id);
    unlinkAsync(tempPath(id)).catch(() => {});
    rejectTranscode(err);
  });

  // Return immediately — transcoding runs in the background.
  res.json({ status: 'started' });
});

// GET /api/stream/:id — stream audio with range support
router.get('/stream/:id', async (req, res) => {
  const track = await Track.findById(req.params.id).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });

  let fileStat;
  try {
    fileStat = await statAsync(track.path);
  } catch {
    return res.status(404).json({ error: 'File not found on disk' });
  }

  const fileSize = fileStat.size;
  const contentType = mime.lookup(track.path) || 'application/octet-stream';

  // On-the-fly transcode for browsers that can't play the native format (e.g. FLAC on iOS).
  if (req.query.transcode) {
    const id = req.params.id;

    // Already fully transcoded — serve with range support so iOS can seek/resume.
    if (transcodeReady.has(id)) {
      if (await serveCachedTranscode(id, req, res)) return;
      transcodeReady.delete(id); // file was deleted; fall through to re-transcode
    }

    // Check for a cached file left over from a previous server run.
    try {
      await statAsync(tempPath(id));
      transcodeReady.add(id);
      if (await serveCachedTranscode(id, req, res)) return;
    } catch { /* not on disk yet */ }

    // Another request is already transcoding this track — wait for it, then serve.
    if (transcodeInProgress.has(id)) {
      try {
        await transcodeInProgress.get(id);
        if (await serveCachedTranscode(id, req, res)) return;
      } catch { /* transcoding failed; fall through to retry */ }
    }

    // First request for this track: stream from ffmpeg to the client AND
    // simultaneously write to a temp file.  When ffmpeg finishes (it transcodes
    // much faster than real-time), the temp file is complete.  iOS typically
    // buffers only a fraction of a long track, fires 'ended' early, and the
    // client re-requests — that second request hits the cache above and gets
    // a proper seekable response, letting iOS resume from where it stalled.
    const ff = spawn('ffmpeg', [
      '-i', track.path,
      '-vn',
      '-c:a', 'aac',
      '-b:a', '320k',
      '-f', 'adts',
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    const ws = createWriteStream(tempPath(id));

    res.setHeader('Content-Type', 'audio/aac');
    res.setHeader('Cache-Control', 'no-cache');
    // First response is non-seekable (live pipe). The client will re-request
    // after the stall and get the cached, seekable version.
    res.setHeader('Accept-Ranges', 'none');

    // Tee ffmpeg stdout: write to response AND to the temp file.
    ff.stdout.on('data', (chunk) => {
      if (!res.writableEnded) res.write(chunk);
      ws.write(chunk);
    });
    ff.stdout.on('end', () => {
      if (!res.writableEnded) res.end();
      ws.end();
    });

    let resolveTranscode, rejectTranscode;
    const transcodePromise = new Promise((res, rej) => {
      resolveTranscode = res;
      rejectTranscode = rej;
    });
    transcodeInProgress.set(id, transcodePromise);

    ff.on('close', (code) => {
      transcodeInProgress.delete(id);
      if (code === 0) {
        transcodeReady.add(id);
        resolveTranscode();
      } else {
        ws.destroy();
        unlinkAsync(tempPath(id)).catch(() => {});
        rejectTranscode(new Error(`ffmpeg exit ${code}`));
      }
    });

    ff.on('error', (err) => {
      console.error('[transcode] ffmpeg spawn error:', err);
      transcodeInProgress.delete(id);
      ws.destroy(err);
      unlinkAsync(tempPath(id)).catch(() => {});
      rejectTranscode(err);
      if (!res.headersSent) res.status(500).json({ error: 'Transcoding failed' });
    });

    // Do NOT kill ffmpeg when the client disconnects — let it finish writing
    // the temp file so the next request (iOS retry after stall) can be served
    // from the seekable cache.
    return;
  }

  const range = req.headers.range;
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': contentType,
    });

    createReadStream(track.path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
    });

    createReadStream(track.path).pipe(res);
  }
});

// POST /api/tracks/:id/play — increment play count and record history
router.post('/tracks/:id/play', async (req, res) => {
  const now = new Date();
  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { $inc: { playCount: 1 }, lastPlayedAt: now },
    { new: true },
  ).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });

  PlayHistory.create({
    trackId: track._id,
    playedAt: now,
    title: track.title,
    artists: track.artists,
    album: track.album,
    cover: track.cover,
    duration: track.duration,
    format: track.format,
    path: track.path,
  }).catch(() => {});

  res.json({ playCount: track.playCount });
});

// GET /api/covers/:filename — serve cover art
router.get('/covers/:filename', async (req, res) => {
  const filePath = join(config.coversDir, req.params.filename);

  try {
    await statAsync(filePath);
  } catch {
    return res.status(404).json({ error: 'Cover not found' });
  }

  const contentType = mime.lookup(filePath) || 'image/jpeg';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  createReadStream(filePath).pipe(res);
});

export default router;
