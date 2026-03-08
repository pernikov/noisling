import { Router } from 'express';
import Settings from '../models/Settings.js';

const router = Router();
const VALID_COLORS    = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];
const VALID_REPEAT    = ['off', 'all', 'one'];
const VALID_DENSITY   = ['comfortable', 'compact'];
const VALID_FONT      = ['small', 'medium', 'large'];
const VALID_VIZ_MODES = ['spiral', 'wave', 'particles', 'polar', 'spectrum', 'bubbles'];
const VALID_SORT_DIRS = ['asc', 'desc'];
const VALID_SONG_SORT_FIELDS = ['', 'title', 'artist', 'album', 'plays', 'lastPlayed', 'duration'];
const VALID_COL_KEYS  = ['artist', 'album', 'plays', 'lastPlayed'];

function buildResponse(s) {
  const songsSortField = VALID_SONG_SORT_FIELDS.includes(s?.songsSort?.field)
    ? s.songsSort.field
    : 'artist';
  const songsSortDir = VALID_SORT_DIRS.includes(s?.songsSort?.dir)
    ? s.songsSort.dir
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
    songsColumns:       s.songsColumns       ?? { artist: true, album: true, plays: true, lastPlayed: true },
    songsSort:          { field: songsSortField, dir: songsSortDir },
    lovedAccent:        s.lovedAccent        ?? false,
    showArtistsNav:     s.showArtistsNav     ?? true,
    wideLayout:         s.wideLayout         ?? false,
    homeShowQuickPlay:  s.homeShowQuickPlay  ?? true,
    homeShowRecent:     s.homeShowRecent     ?? true,
    homeShowAlbums:     s.homeShowAlbums     ?? true,
    vizMode:            s.vizMode            ?? 'spiral',
    showBubbles:        s.showBubbles        ?? true,
    randomizeOnNewSong: s.randomizeOnNewSong ?? false,
    showPlaylists:      s.showPlaylists      ?? true,
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
    showCoverArt, fontSize, songsColumns, songsSort,
    lovedAccent, showArtistsNav, wideLayout, homeShowQuickPlay, homeShowRecent, homeShowAlbums,
    vizMode, showBubbles, randomizeOnNewSong, showPlaylists,
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
  if (songsColumns !== undefined) {
    if (typeof songsColumns !== 'object' || songsColumns === null) return res.status(400).json({ error: 'Invalid songsColumns' });
    const cols = {};
    for (const key of VALID_COL_KEYS) {
      if (key in songsColumns) cols[key] = Boolean(songsColumns[key]);
    }
    update.songsColumns = cols;
  }
  if (songsSort !== undefined) {
    if (typeof songsSort !== 'object' || songsSort === null) return res.status(400).json({ error: 'Invalid songsSort' });
    if (typeof songsSort.field !== 'string' || !VALID_SONG_SORT_FIELDS.includes(songsSort.field) || !VALID_SORT_DIRS.includes(songsSort.dir)) return res.status(400).json({ error: 'Invalid songsSort' });
    update.songsSort = { field: songsSort.field, dir: songsSort.dir };
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
  if (randomizeOnNewSong !== undefined) {
    update.randomizeOnNewSong = Boolean(randomizeOnNewSong);
  }
  if (showPlaylists !== undefined) {
    update.showPlaylists = Boolean(showPlaylists);
  }

  if (!Object.keys(update).length) return res.status(400).json({ error: 'No valid fields' });

  const s = await Settings.findOneAndUpdate({}, update, { upsert: true, new: true }).lean();
  res.json(buildResponse(s));
});

export default router;
