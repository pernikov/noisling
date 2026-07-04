export const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
export const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];
export const VALID_FONT = ['small', 'medium', 'large'];
export const VALID_VIZ_MODES = ['pills', 'nucleus', 'butterchurn'];
export const VALID_NUCLEUS_STYLES = ['filled', 'wireframe'];
export const VALID_NUCLEUS_STYLE_MODES = ['single', 'random'];
export const VALID_BUTTERCHURN_PRESET_MODES = ['single', 'random'];
export const DEFAULT_BUTTERCHURN_PRESET = 'Flexi, martin + geiss - dedicated to the sherwin maxawow';
export const VALID_SORT_DIRS = ['asc', 'desc'];
export const VALID_TRACK_SORT_FIELDS = ['', 'title', 'artist', 'album', 'lastPlayed', 'duration'];
export const VALID_HOME_ALBUM_MODES = ['recent', 'random'];

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
    fontSize: settings.fontSize ?? 'medium',
    tracksSort: { field: tracksSortField, dir: tracksSortDir },
    wideLayout: settings.wideLayout ?? false,
    homeAlbumsMode: VALID_HOME_ALBUM_MODES.includes(settings.homeAlbumsMode) ? settings.homeAlbumsMode : 'recent',
    vizMode: normalizeVizMode(settings.vizMode ?? 'pills'),
    nucleusStyleMode: VALID_NUCLEUS_STYLE_MODES.includes(settings.nucleusStyleMode) ? settings.nucleusStyleMode : 'random',
    nucleusStyle: VALID_NUCLEUS_STYLES.includes(settings.nucleusStyle) ? settings.nucleusStyle : 'filled',
    randomizeOnNewTrack: settings.randomizeOnNewTrack ?? false,
    butterchurnPresetMode: settings.butterchurnPresetMode === 'random' ? 'random' : 'single',
    butterchurnPreset: typeof settings.butterchurnPreset === 'string' && settings.butterchurnPreset.trim()
      ? settings.butterchurnPreset
      : DEFAULT_BUTTERCHURN_PRESET,
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
    accentColor, themeColor, volume,
    fontSize, tracksSort, wideLayout,
    homeAlbumsMode,
    vizMode, nucleusStyleMode, nucleusStyle, randomizeOnNewTrack, butterchurnPresetMode, butterchurnPreset, reduceMotion,
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
  if (fontSize !== undefined) {
    if (!VALID_FONT.includes(fontSize)) return { error: 'Invalid fontSize' };
    update.fontSize = fontSize;
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
  if (wideLayout !== undefined) {
    update.wideLayout = Boolean(wideLayout);
  }
  if (homeAlbumsMode !== undefined) {
    if (!VALID_HOME_ALBUM_MODES.includes(homeAlbumsMode)) return { error: 'Invalid homeAlbumsMode' };
    update.homeAlbumsMode = homeAlbumsMode;
  }
  if (vizMode !== undefined) {
    const normalizedVizMode = normalizeVizMode(vizMode);
    if (!VALID_VIZ_MODES.includes(normalizedVizMode)) return { error: 'Invalid vizMode' };
    update.vizMode = normalizedVizMode;
  }
  if (nucleusStyleMode !== undefined) {
    if (!VALID_NUCLEUS_STYLE_MODES.includes(nucleusStyleMode)) return { error: 'Invalid nucleusStyleMode' };
    update.nucleusStyleMode = nucleusStyleMode;
  }
  if (nucleusStyle !== undefined) {
    if (!VALID_NUCLEUS_STYLES.includes(nucleusStyle)) return { error: 'Invalid nucleusStyle' };
    update.nucleusStyle = nucleusStyle;
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
  if (reduceMotion !== undefined) {
    update.reduceMotion = Boolean(reduceMotion);
  }

  if (!Object.keys(update).length) return { error: 'No valid fields' };
  return { update };
}
