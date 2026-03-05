import { Router } from 'express';
import { stat, createReadStream, unlink } from 'fs';
import { promisify } from 'util';
import { spawn } from 'child_process';
import { tmpdir } from 'os';
import mime from 'mime-types';
import Track from '../models/Track.js';
import config from '../config.js';
import { join } from 'path';
import { broadcast } from '../services/events.js';

const statAsync = promisify(stat);
const unlinkAsync = promisify(unlink);
const router = Router();

// Transcode cache — persists for the lifetime of the server process.
// transcodeReady: tracks whose faststart M4A is fully written and safe to range-serve.
// transcodeInProgress: tracks currently being transcoded to faststart M4A (value =
//   Promise that resolves when the temp file is complete).
const transcodeReady = new Set();
const transcodeInProgress = new Map();

function tempPath(id) {
  return join(tmpdir(), `noisling_tc_${id}.m4a`);
}

// Serve a fully-written faststart M4A with HTTP range support.
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
      'Content-Type': 'audio/mp4',
    });
    createReadStream(path, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': size,
      'Content-Type': 'audio/mp4',
      'Accept-Ranges': 'bytes',
    });
    createReadStream(path).pipe(res);
  }
  return true;
}

// Start a background ffmpeg job that writes a faststart MP4 to tempPath(id).
// The faststart flag moves the moov atom to the front so iOS can seek immediately
// over byte-range requests once the cache is served.
// No-op if already done or in progress.
function startWarm(id, trackPath, label) {
  if (transcodeReady.has(id) || transcodeInProgress.has(id)) return;

  console.log(`[stream] warm start  — ${label}`);

  const ff = spawn('ffmpeg', [
    '-i', trackPath,
    '-vn',
    '-c:a', 'aac',
    '-b:a', '256k',
    '-ar', '44100',   // normalise to 44.1 kHz — iOS rejects unusual rates in AAC streams
    '-ac', '2',       // normalise to stereo
    '-movflags', '+faststart',
    '-f', 'mp4',
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
      broadcast('transcode_ready', { trackId: id });
      console.log(`[stream] warm done   — ${label}`);
    } else {
      unlinkAsync(tempPath(id)).catch(() => {});
      rejectTranscode(new Error(`ffmpeg exit ${code}`));
      console.error(`[stream] warm failed (exit ${code}) — ${label}`);
    }
  });

  ff.on('error', (err) => {
    console.error(`[stream] warm spawn error — ${label}:`, err.message);
    transcodeInProgress.delete(id);
    unlinkAsync(tempPath(id)).catch(() => {});
    rejectTranscode(err);
  });
}

// GET /api/stream/:id/warm — pre-transcode to faststart M4A cache without streaming.
// Called by the client while the current track plays so the next track's cache is
// ready before playback starts, eliminating the first-play stall/gap.
router.get('/stream/:id/warm', async (req, res) => {
  const track = await Track.findById(req.params.id).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const id = req.params.id;
  const label = `"${track.title || id}"`;

  if (transcodeReady.has(id)) return res.json({ status: 'ready' });
  if (transcodeInProgress.has(id)) return res.json({ status: 'in_progress' });

  // Check if the file is already on disk from a previous server run.
  try {
    await statAsync(tempPath(id));
    transcodeReady.add(id);
    return res.json({ status: 'ready' });
  } catch { /* not on disk */ }

  startWarm(id, track.path, label);
  res.json({ status: 'started' });
});

// GET /api/stream/:id/transcoded — serve a stable, cached faststart M4A URL.
// Unlike /stream/:id?transcode=1, this endpoint always resolves to the same URL
// for a given track id and only serves the completed cached file.
router.get('/stream/:id/transcoded', async (req, res) => {
  const track = await Track.findById(req.params.id).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });

  const id = req.params.id;
  const label = `"${track.title || id}"`;

  if (transcodeReady.has(id)) {
    if (await serveCachedTranscode(id, req, res)) return;
    transcodeReady.delete(id);
  }

  // Check for a completed cache file left from a previous server run.
  if (!transcodeInProgress.has(id)) {
    try {
      await statAsync(tempPath(id));
      transcodeReady.add(id);
      if (await serveCachedTranscode(id, req, res)) return;
      transcodeReady.delete(id);
    } catch { /* not on disk yet */ }
  }

  if (!transcodeInProgress.has(id)) startWarm(id, track.path, label);
  const inFlight = transcodeInProgress.get(id);
  if (!inFlight) return res.status(500).json({ error: 'Transcode did not start' });

  try {
    await inFlight;
    transcodeReady.add(id);
    if (await serveCachedTranscode(id, req, res)) return;
    transcodeReady.delete(id);
    return res.status(500).json({ error: 'Transcoded file unavailable' });
  } catch (err) {
    console.error(`[stream] transcoded endpoint warm failed — ${label}:`, err.message);
    return res.status(500).json({ error: 'Transcoding failed' });
  }
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
    const label = `"${track.title || id}"`;
    const range = req.headers.range || 'none';
    console.log(`[stream] transcode req — ${label}  range=${range}`);

    // Already fully transcoded (faststart M4A) — serve with range support so iOS can seek.
    if (transcodeReady.has(id)) {
      console.log(`[stream] serving M4A cache — ${label}`);
      if (await serveCachedTranscode(id, req, res)) return;
      transcodeReady.delete(id); // file was deleted externally; fall through to re-transcode
      console.log(`[stream] M4A cache gone, re-transcoding — ${label}`);
    }

    // Check for a faststart M4A left over from a previous server run.
    // Skip this check while a warm is actively writing to the file — statAsync
    // would succeed on the still-incomplete M4A and we'd serve corrupt data.
    if (!transcodeInProgress.has(id)) {
      try {
        await statAsync(tempPath(id));
        transcodeReady.add(id);
        console.log(`[stream] serving M4A from disk — ${label}`);
        if (await serveCachedTranscode(id, req, res)) return;
      } catch { /* not on disk yet */ }
    } else {
      console.log(`[stream] warm in progress, waiting for M4A — ${label}`);
    }

    // No ready cache yet: start warm and wait for the finished faststart M4A.
    // This avoids mid-playback source switches and audible gaps.
    if (!transcodeInProgress.has(id)) startWarm(id, track.path, label);
    const inFlight = transcodeInProgress.get(id);
    if (!inFlight) return res.status(500).json({ error: 'Transcode did not start' });

    try {
      await inFlight;
      transcodeReady.add(id);
      console.log(`[stream] warm completed during request — ${label}`);
      if (await serveCachedTranscode(id, req, res)) return;
      transcodeReady.delete(id);
      return res.status(500).json({ error: 'Transcoded file unavailable' });
    } catch (err) {
      console.error(`[stream] warm failed while waiting — ${label}:`, err.message);
      return res.status(500).json({ error: 'Transcoding failed' });
    }
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

// POST /api/tracks/:id/play — increment play count
router.post('/tracks/:id/play', async (req, res) => {
  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { $inc: { playCount: 1 }, lastPlayedAt: new Date() },
    { new: true },
  ).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });
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
