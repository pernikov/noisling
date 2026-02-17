import { Router } from 'express';
import { scanLibrary } from '../services/scanner.js';
import { broadcast } from '../services/events.js';
import { pauseWatcher, resumeWatcher } from '../services/watcher.js';

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

export default router;
