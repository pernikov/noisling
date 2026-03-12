import { Router } from 'express';
import Settings from '../models/Settings.js';

const router = Router();
const VALID_COLORS    = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];
const VALID_REPEAT    = ['off', 'all', 'one'];
const VALID_DENSITY   = ['comfortable', 'compact'];
const VALID_FONT      = ['small', 'medium', 'large'];
const VALID_VIZ_MODES = ['spiral', 'wave', 'particles', 'polar', 'spectrum', 'nebula', 'bubbles'];
const VALID_SORT_DIRS = ['asc', 'desc'];
const VALID_TRACK_SORT_FIELDS = ['', 'title', 'artist', 'album', 'plays', 'lastPlayed', 'duration'];
const VALID_COL_KEYS  = ['artist', 'album', 'plays', 'lastPlayed'];

function buildResponse(s) {
  const tracksSortField = VALID_TRACK_SORT_FIELDS.includes(s?.tracksSort?.field)
    ? s.tracksSort.field
    : 'artist';
  const tracksSortDir = VALID_SORT_DIRS.includes(s?.tracksSort?.dir)
    ? s.tracksSort.dir
    : 'asc';

  return {
    accentColor:        s.accentColor,
    themeColor:         s.themeColor         ?? 'none',
    volume:             s.volume,
    shuffle:            s.shuffle,
    repeatMode:         s.repeatMode,
    density:            s.density            ?? 'comfortable',
    showCoverArt:       s.showCoverArt       ?? true,
    fontSize:           s.fontSize           ?? 'medium',
    tracksColumns:       s.tracksColumns       ?? { artist: true, album: true, plays: true, lastPlayed: true },
    tracksSort:          { field: tracksSortField, dir: tracksSortDir },
    lovedAccent:        s.lovedAccent        ?? false,
    showArtistsNav:     s.showArtistsNav     ?? true,
    wideLayout:         s.wideLayout         ?? false,
    homeShowQuickPlay:  s.homeShowQuickPlay  ?? true,
    homeShowRecent:     s.homeShowRecent     ?? true,
    homeShowAlbums:     s.homeShowAlbums     ?? true,
    vizMode:            s.vizMode            ?? 'spiral',
    showBubbles:        s.showBubbles        ?? true,
    randomizeOnNewTrack: s.randomizeOnNewTrack ?? false,
    showPlaylists:      s.showPlaylists      ?? true,
    sharpCorners:       s.sharpCorners       ?? false,
    reduceMotion:       s.reduceMotion       ?? false,
  };
}

router.get('/settings', async (req, res) => {
  const s = await Settings.findOneAndUpdate(
    {},
    { $setOnInsert: { accentColor: 'violet' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();
  res.json(buildResponse(s));
});

router.patch('/settings', async (req, res) => {
  const {
    accentColor, themeColor, volume, shuffle, repeatMode, density,
    showCoverArt, fontSize, tracksColumns, tracksSort,
    lovedAccent, showArtistsNav, wideLayout, homeShowQuickPlay, homeShowRecent, homeShowAlbums,
    vizMode, showBubbles, randomizeOnNewTrack, showPlaylists, sharpCorners, reduceMotion,
  } = req.body;
  const update = {};

  if (accentColor !== undefined) {
    if (!VALID_COLORS.includes(accentColor)) return res.status(400).json({ error: 'Invalid color' });
    update.accentColor = accentColor;
  }
  if (themeColor !== undefined) {
    if (!VALID_THEME_COLORS.includes(themeColor)) return res.status(400).json({ error: 'Invalid themeColor' });
    update.themeColor = themeColor;
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
  if (density !== undefined) {
    if (!VALID_DENSITY.includes(density)) return res.status(400).json({ error: 'Invalid density' });
    update.density = density;
  }
  if (showCoverArt !== undefined) {
    update.showCoverArt = Boolean(showCoverArt);
  }
  if (fontSize !== undefined) {
    if (!VALID_FONT.includes(fontSize)) return res.status(400).json({ error: 'Invalid fontSize' });
    update.fontSize = fontSize;
  }
  if (tracksColumns !== undefined) {
    if (typeof tracksColumns !== 'object' || tracksColumns === null) return res.status(400).json({ error: 'Invalid tracksColumns' });
    const cols = {};
    for (const key of VALID_COL_KEYS) {
      if (key in tracksColumns) cols[key] = Boolean(tracksColumns[key]);
    }
    update.tracksColumns = cols;
  }
  if (tracksSort !== undefined) {
    if (typeof tracksSort !== 'object' || tracksSort === null) return res.status(400).json({ error: 'Invalid tracksSort' });
    if (typeof tracksSort.field !== 'string' || !VALID_TRACK_SORT_FIELDS.includes(tracksSort.field) || !VALID_SORT_DIRS.includes(tracksSort.dir)) return res.status(400).json({ error: 'Invalid tracksSort' });
    update.tracksSort = { field: tracksSort.field, dir: tracksSort.dir };
  }
  if (lovedAccent !== undefined) {
    update.lovedAccent = Boolean(lovedAccent);
  }
  if (showArtistsNav !== undefined) {
    update.showArtistsNav = Boolean(showArtistsNav);
  }
  if (wideLayout !== undefined) {
    update.wideLayout = Boolean(wideLayout);
  }
  if (homeShowQuickPlay !== undefined) {
    update.homeShowQuickPlay = Boolean(homeShowQuickPlay);
  }
  if (homeShowRecent !== undefined) {
    update.homeShowRecent = Boolean(homeShowRecent);
  }
  if (homeShowAlbums !== undefined) {
    update.homeShowAlbums = Boolean(homeShowAlbums);
  }
  if (vizMode !== undefined) {
    if (!VALID_VIZ_MODES.includes(vizMode)) return res.status(400).json({ error: 'Invalid vizMode' });
    update.vizMode = vizMode;
  }
  if (showBubbles !== undefined) {
    update.showBubbles = Boolean(showBubbles);
  }
  if (randomizeOnNewTrack !== undefined) {
    update.randomizeOnNewTrack = Boolean(randomizeOnNewTrack);
  }
  if (showPlaylists !== undefined) {
    update.showPlaylists = Boolean(showPlaylists);
  }
  if (sharpCorners !== undefined) {
    update.sharpCorners = Boolean(sharpCorners);
  }
  if (reduceMotion !== undefined) {
    update.reduceMotion = Boolean(reduceMotion);
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields' });

  const s = await Settings.findOneAndUpdate({}, update, { upsert: true, new: true }).lean();
  res.json(buildResponse(s));
});

export default router;
