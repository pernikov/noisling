import { Router } from 'express';
import Settings from '../models/Settings.js';

const router = Router();
const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
const VALID_REPEAT = ['off', 'all', 'one'];

router.get('/settings', async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    {},
    { $setOnInsert: { accentColor: 'violet' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({
    accentColor: s.accentColor,
    volume:      s.volume,
    shuffle:     s.shuffle,
    repeatMode:  s.repeatMode,
  });
});

router.patch('/settings', async (req, res) => {
  const { accentColor, volume, shuffle, repeatMode } = req.body;
  const update = {};

  if (accentColor !== undefined) {
    if (!VALID_COLORS.includes(accentColor)) return res.status(400).json({ error: 'Invalid color' });
    update.accentColor = accentColor;
  }
  if (volume !== undefined) {
    if (typeof volume !== 'number' || volume < 0 || volume > 1) return res.status(400).json({ error: 'Invalid volume' });
    update.volume = volume;
  }
  if (shuffle !== undefined) {
    update.shuffle = Boolean(shuffle);
  }
  if (repeatMode !== undefined) {
    if (!VALID_REPEAT.includes(repeatMode)) return res.status(400).json({ error: 'Invalid repeatMode' });
    update.repeatMode = repeatMode;
  }
  if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields' });

  const s = await Settings.findOneAndUpdate({}, update, { upsert: true, new: true }).lean();
  res.json({
    accentColor: s.accentColor,
    volume:      s.volume,
    shuffle:     s.shuffle,
    repeatMode:  s.repeatMode,
  });
});

export default router;
