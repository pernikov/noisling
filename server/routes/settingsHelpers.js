export const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
export const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];
export const VALID_REPEAT = ['off', 'all', 'one'];
export const VALID_DENSITY = ['comfortable', 'compact'];
export const VALID_FONT = ['small', 'medium', 'large'];
export const VALID_VIZ_MODES = ['pills', 'nucleus', 'butterchurn'];
export const VALID_BUTTERCHURN_PRESET_MODES = ['single', 'random'];
export const DEFAULT_BUTTERCHURN_PRESET = 'Flexi, martin + geiss - dedicated to the sherwin maxawow';
export const VALID_SORT_DIRS = ['asc', 'desc'];
export const VALID_TRACK_SORT_FIELDS = ['', 'title', 'artist', 'album', 'plays', 'lastPlayed', 'duration'];
export const VALID_COL_KEYS = ['artist', 'album', 'plays', 'lastPlayed'];

export function buildSettingsResponse(settings) {
  const tracksSortField = VALID_TRACK_SORT_FIELDS.includes(settings?.tracksSort?.field)
    ? settings.tracksSort.field
    : 'artist';
  const tracksSortDir = VALID_SORT_DIRS.includes(settings?.tracksSort?.dir)
    ? settings.tracksSort.dir
    : 'asc';

  return {
    accentColor: settings.accentColor,
    themeColor: settings.themeColor ?? 'none',
    volume: settings.volume,
    shuffle: settings.shuffle,
    repeatMode: settings.repeatMode,
    density: settings.density ?? 'comfortable',
    showCoverArt: settings.showCoverArt ?? true,
    fontSize: settings.fontSize ?? 'medium',
    tracksColumns: settings.tracksColumns ?? { artist: true, album: true, plays: true, lastPlayed: true },
    tracksSort: { field: tracksSortField, dir: tracksSortDir },
    lovedAccent: settings.lovedAccent ?? false,
    showArtistsNav: settings.showArtistsNav ?? true,
    wideLayout: settings.wideLayout ?? false,
    homeShowQuickPlay: settings.homeShowQuickPlay ?? true,
    homeShowRecent: settings.homeShowRecent ?? true,
    homeShowAlbums: settings.homeShowAlbums ?? true,
    vizMode: normalizeVizMode(settings.vizMode ?? 'pills'),
    randomizeOnNewTrack: settings.randomizeOnNewTrack ?? false,
    butterchurnPresetMode: settings.butterchurnPresetMode === 'random' ? 'random' : 'single',
    butterchurnPreset: typeof settings.butterchurnPreset === 'string' && settings.butterchurnPreset.trim()
      ? settings.butterchurnPreset
      : DEFAULT_BUTTERCHURN_PRESET,
    showPlaylists: settings.showPlaylists ?? true,
    sharpCorners: settings.sharpCorners ?? false,
    reduceMotion: settings.reduceMotion ?? false,
  };
}

export function normalizeVizMode(value) {
  if (value === 'nebula') return 'pills';
  if (value === 'spiral' || value === 'orb') return 'nucleus';
  return value;
}

export function buildSettingsUpdate(body = {}) {
  const {
    accentColor, themeColor, volume, shuffle, repeatMode, density,
    showCoverArt, fontSize, tracksColumns, tracksSort,
    lovedAccent, showArtistsNav, wideLayout, homeShowQuickPlay, homeShowRecent, homeShowAlbums,
    vizMode, randomizeOnNewTrack, butterchurnPresetMode, butterchurnPreset, showPlaylists, sharpCorners, reduceMotion,
  } = body;

  const update = {};

  if (accentColor !== undefined) {
    if (!VALID_COLORS.includes(accentColor)) return { error: 'Invalid color' };
    update.accentColor = accentColor;
  }
  if (themeColor !== undefined) {
    if (!VALID_THEME_COLORS.includes(themeColor)) return { error: 'Invalid themeColor' };
    update.themeColor = themeColor;
  }
  if (volume !== undefined) {
    if (typeof volume !== 'number' || volume < 0 || volume > 1) return { error: 'Invalid volume' };
    update.volume = volume;
  }
  if (shuffle !== undefined) {
    update.shuffle = Boolean(shuffle);
  }
  if (repeatMode !== undefined) {
    if (!VALID_REPEAT.includes(repeatMode)) return { error: 'Invalid repeatMode' };
    update.repeatMode = repeatMode;
  }
  if (density !== undefined) {
    if (!VALID_DENSITY.includes(density)) return { error: 'Invalid density' };
    update.density = density;
  }
  if (showCoverArt !== undefined) {
    update.showCoverArt = Boolean(showCoverArt);
  }
  if (fontSize !== undefined) {
    if (!VALID_FONT.includes(fontSize)) return { error: 'Invalid fontSize' };
    update.fontSize = fontSize;
  }
  if (tracksColumns !== undefined) {
    if (typeof tracksColumns !== 'object' || tracksColumns === null) return { error: 'Invalid tracksColumns' };
    const cols = {};
    for (const key of VALID_COL_KEYS) {
      if (key in tracksColumns) cols[key] = Boolean(tracksColumns[key]);
    }
    update.tracksColumns = cols;
  }
  if (tracksSort !== undefined) {
    if (typeof tracksSort !== 'object' || tracksSort === null) return { error: 'Invalid tracksSort' };
    if (
      typeof tracksSort.field !== 'string' ||
      !VALID_TRACK_SORT_FIELDS.includes(tracksSort.field) ||
      !VALID_SORT_DIRS.includes(tracksSort.dir)
    ) {
      return { error: 'Invalid tracksSort' };
    }
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
    const normalizedVizMode = normalizeVizMode(vizMode);
    if (!VALID_VIZ_MODES.includes(normalizedVizMode)) return { error: 'Invalid vizMode' };
    update.vizMode = normalizedVizMode;
  }
  if (randomizeOnNewTrack !== undefined) {
    update.randomizeOnNewTrack = Boolean(randomizeOnNewTrack);
  }
  if (butterchurnPresetMode !== undefined) {
    if (!VALID_BUTTERCHURN_PRESET_MODES.includes(butterchurnPresetMode)) {
      return { error: 'Invalid butterchurnPresetMode' };
    }
    update.butterchurnPresetMode = butterchurnPresetMode;
  }
  if (butterchurnPreset !== undefined) {
    if (typeof butterchurnPreset !== 'string' || !butterchurnPreset.trim()) {
      return { error: 'Invalid butterchurnPreset' };
    }
    update.butterchurnPreset = butterchurnPreset;
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

  if (!Object.keys(update).length) return { error: 'No valid fields' };
  return { update };
}
