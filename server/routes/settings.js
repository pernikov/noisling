import { Router } from 'express';
import Settings from '../models/Settings.js';
import { buildSettingsResponse, buildSettingsUpdate } from './settingsHelpers.js';

const router = Router();

router.get('/settings', async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    {},
    { $setOnInsert: { accentColor: 'violet' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  res.json(buildSettingsResponse(s));
});

router.patch('/settings', async (req, res) => {
  const result = buildSettingsUpdate(req.body);
  if (result.error) return res.status(400).json({ error: result.error });

  const s = await Settings.findOneAndUpdate({}, result.update, { upsert: true, new: true }).lean();
  res.json(buildSettingsResponse(s));
});

export default router;
