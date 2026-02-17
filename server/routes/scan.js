import { Router } from 'express';
import { rm } from 'fs/promises';
import { scanLibrary } from '../services/scanner.js';
import { broadcast } from '../services/events.js';
import { pauseWatcher, resumeWatcher } from '../services/watcher.js';
import Track from '../models/Track.js';
import config from '../config.js';

const router = Router();

let scanning = false;

router.post('/scan', async (req, res) => {
  if (scanning) {
    return res.status(409).json({ error: 'Scan already in progress' });
  }

  try {
    scanning = true;
    pauseWatcher();
    const stats = await scanLibrary();
    broadcast('library-updated', stats);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    resumeWatcher();
    scanning = false;
  }
});

router.delete('/library', async (req, res) => {
  try {
    pauseWatcher();
    const { deletedCount } = await Track.deleteMany({});
    await rm(config.coversDir, { recursive: true, force: true });
    broadcast('library-updated', { cleared: true });
    res.json({ deletedTracks: deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    resumeWatcher();
  }
});

export default router;
