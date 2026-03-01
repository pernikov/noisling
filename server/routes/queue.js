import { Router } from 'express';
import Track from '../models/Track.js';
import Queue from '../models/Queue.js';

const router = Router();

// GET /api/queue — metadata only (total, currentIndex, currentTime)
router.get('/queue', async (req, res) => {
  const q = await Queue.findOne().select('trackIds currentIndex currentTime').lean();
  if (!q) return res.json({ total: 0, currentIndex: 0, currentTime: 0 });
  res.json({ total: q.trackIds.length, currentIndex: q.currentIndex, currentTime: q.currentTime });
});

// GET /api/queue/tracks?offset=0&limit=50 — resolve a window of track objects
router.get('/queue/tracks', async (req, res) => {
  const q = await Queue.findOne().select('trackIds').lean();
  if (!q || !q.trackIds.length) return res.json([]);

  const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);
  const limit  = Math.min(500, Math.max(1, parseInt(req.query.limit, 10) || 50));
  const ids    = q.trackIds.slice(offset, offset + limit);

  const tracks = await Track.find({ _id: { $in: ids } }).lean();

  // Re-sort to match queue order (find() doesn't guarantee order)
  const order = Object.fromEntries(ids.map((id, i) => [id, i]));
  tracks.sort((a, b) => order[a._id.toString()] - order[b._id.toString()]);

  res.json(tracks);
});

// PUT /api/queue — replace queue with a new set of track IDs (album / artist play)
router.put('/queue', async (req, res) => {
  const { trackIds, currentIndex = 0, currentTime = 0 } = req.body;
  if (!Array.isArray(trackIds)) return res.status(400).json({ error: 'trackIds required' });

  await Queue.findOneAndUpdate(
    {},
    { trackIds, currentIndex, currentTime, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  res.json({ ok: true });
});

// PUT /api/queue/shuffle — server-side shuffle of entire library
router.put('/queue/shuffle', async (req, res) => {
  const all = await Track.find({}).select('_id').lean();

  // Fisher-Yates shuffle
  const ids = all.map(t => t._id.toString());
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  await Queue.findOneAndUpdate(
    {},
    { trackIds: ids, currentIndex: 0, currentTime: 0, updatedAt: new Date() },
    { upsert: true, new: true }
  );

  // Return first 50 full track objects so playback can start immediately
  const firstIds = ids.slice(0, 50);
  const tracks   = await Track.find({ _id: { $in: firstIds } }).lean();
  const order    = Object.fromEntries(firstIds.map((id, i) => [id, i]));
  tracks.sort((a, b) => order[a._id.toString()] - order[b._id.toString()]);

  res.json({ total: ids.length, tracks });
});

// PATCH /api/queue — update playback position (throttled progress sync)
router.patch('/queue', async (req, res) => {
  const { currentIndex, currentTime } = req.body;
  const updates = { updatedAt: new Date() };
  if (typeof currentIndex === 'number') updates.currentIndex = currentIndex;
  if (typeof currentTime  === 'number') updates.currentTime  = currentTime;
  await Queue.findOneAndUpdate({}, updates);
  res.json({ ok: true });
});

export default router;
