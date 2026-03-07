import { Router } from 'express';
import Track from '../models/Track.js';

const router = Router();

// PUT /api/queue/shuffle — server-side shuffle of entire library
// Returns all shuffled IDs + first 50 full track objects for immediate playback.
// No server state stored — each client holds its own ID list in memory.
router.put('/queue/shuffle', async (req, res) => {
  const all = await Track.find({}).select('_id').lean();

  // Fisher-Yates shuffle
  const ids = all.map(t => t._id.toString());
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  // Return first 50 full track objects so playback can start immediately
  const firstIds = ids.slice(0, 50);
  const tracks   = await Track.find({ _id: { $in: firstIds } }).lean();
  const order    = Object.fromEntries(firstIds.map((id, i) => [id, i]));
  tracks.sort((a, b) => order[a._id.toString()] - order[b._id.toString()]);

  res.json({ total: ids.length, ids, tracks });
});

export default router;
