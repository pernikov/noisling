import { Router } from 'express';
import Settings from '../models/Settings.js';

const router = Router();
const VALID_COLORS = ['violet', 'sky', 'rose', 'amber', 'emerald', 'indigo'];

router.get('/settings', async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    {},
    { $setOnInsert: { accentColor: 'violet' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  res.json({ accentColor: s.accentColor });
});

router.patch('/settings', async (req, res) => {
  const { accentColor } = req.body;
  if (!VALID_COLORS.includes(accentColor)) {
    return res.status(400).json({ error: 'Invalid color' });
  }
  const s = await Settings.findOneAndUpdate(
    {},
    { accentColor },
    { upsert: true, new: true }
  ).lean();
  res.json({ accentColor: s.accentColor });
});

export default router;
