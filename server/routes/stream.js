import { Router } from 'express';
import { stat, createReadStream } from 'fs';
import { promisify } from 'util';
import { spawn } from 'child_process';
import mime from 'mime-types';
import Track from '../models/Track.js';
import config from '../config.js';
import { join } from 'path';

const statAsync = promisify(stat);
const router = Router();

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

  // On-the-fly transcode for browsers that can't play the native format (e.g. FLAC on iOS)
  if (req.query.transcode) {
    const ff = spawn('ffmpeg', [
      '-i', track.path,
      '-vn',          // skip cover art / video streams
      '-c:a', 'aac',
      '-b:a', '192k',
      '-f', 'adts',   // ADTS — frame-based, no container seeking needed, safe to pipe
      'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });

    res.setHeader('Content-Type', 'audio/aac');
    res.setHeader('Cache-Control', 'no-cache');
    // Explicitly disable range requests. Without this iOS retries with a Range
    // header when its buffer stalls; the server ignores the range and serves
    // from byte 0, which iOS interprets as a new stream — causing the song to
    // restart in a tightening loop (1/3 → 1/6 → 1/12 of the song, then faster).
    res.setHeader('Accept-Ranges', 'none');
    ff.stdout.pipe(res);

    ff.on('error', (err) => {
      console.error('[transcode] ffmpeg spawn error:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Transcoding failed' });
    });

    // Kill ffmpeg if the client disconnects mid-stream
    req.on('close', () => ff.kill());
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
