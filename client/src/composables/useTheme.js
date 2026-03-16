import { ref, computed } from 'vue';
import { useApi } from './useApi.js';
import { useToast } from './useToast.js';
import {
  BUTTERCHURN_PRESET_OPTIONS,
  DEFAULT_BUTTERCHURN_PRESET,
  DEFAULT_BUTTERCHURN_PRESET_MODE,
  VALID_BUTTERCHURN_PRESETS,
  VALID_BUTTERCHURN_PRESET_MODES,
} from '../constants/butterchurnPresets.js';
import {
  readStoredBool,
  readStoredJson,
  readStoredValue,
  writeStoredBool,
  writeStoredJson,
  writeStoredValue,
} from './themeStorage.js';

const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];

const COLOR_RGB = {
  rose:    [244, 63,  94 ],
  amber:   [245, 158, 11 ],
  yellow:  [250, 204, 21 ],
  emerald: [16,  185, 129],
  teal:    [45,  212, 191],
  sky:     [14,  165, 233],
  indigo:  [99,  102, 241],
  violet:  [139, 92,  246],
  slate:   [148, 163, 184],
};

// Approximate -700 shades for gradient end stops
const COLOR_RGB_DARK = {
  rose:    [190, 18,  60 ],
  amber:   [180, 83,  9  ],
  yellow:  [161, 98,  7  ],
  emerald: [4,   120, 87 ],
  teal:    [15,  118, 110],
  sky:     [3,   105, 161],
  indigo:  [67,  56,  202],
  violet:  [109, 40,  217],
  slate:   [51,  65,  85 ],
};

const STORAGE_KEY  = 'noisling_accent';
const THEME_KEY    = 'noisling_theme';
const DENSITY_KEY  = 'noisling_density';
const COVER_KEY    = 'noisling_cover';
const FONT_KEY     = 'noisling_fontsize';
const DEFAULT_COLOR = 'violet';
const DEFAULT_THEME_COLOR = 'none';
const VALID_FONT_SIZES = ['small', 'medium', 'large'];

// Tracks view keys
const TRACKS_COLS_KEY = 'noisling_tracks_cols';
const TRACKS_SORT_KEY = 'noisling_tracks_sort';

// Loved color key
const LOVED_ACCENT_KEY = 'noisling_loved_accent';

// Layout visibility keys
const ARTISTS_NAV_KEY  = 'noisling_artists_nav';
const HOME_QUICK_KEY   = 'noisling_home_quick';
const HOME_RECENT_KEY  = 'noisling_home_recent';
const HOME_ALBUMS_KEY  = 'noisling_home_albums';
const WIDE_LAYOUT_KEY  = 'noisling_wide_layout';
const PLAYLISTS_KEY    = 'noisling_playlists';
const SHARP_KEY        = 'noisling_sharp_corners';
const MOTION_KEY       = 'noisling_reduce_motion';

// Visualizer keys
const VIZ_MODE_KEY  = 'noisling_vizmode';
const RANDOMIZE_KEY = 'noisling_randomize';
const BUTTERCHURN_PRESET_MODE_KEY = 'noisling_butterchurn_preset_mode';
const BUTTERCHURN_PRESET_KEY = 'noisling_butterchurn_preset';
const VALID_VIZ_MODES = ['spiral', 'pills', 'butterchurn'];
function normalizeVizMode(value) {
  if (value === 'nebula') return 'pills';
  return value;
}

// Module-level singletons — read from localStorage immediately so there's no
// flash of the wrong value before the API call returns.
const stored = readStoredValue(STORAGE_KEY);
const accentColor = ref(VALID_COLORS.includes(stored) ? stored : DEFAULT_COLOR);
const storedTheme = readStoredValue(THEME_KEY);
const themeColor = ref(VALID_THEME_COLORS.includes(storedTheme) ? storedTheme : DEFAULT_THEME_COLOR);

const storedDensity = readStoredValue(DENSITY_KEY);
const density = ref(storedDensity === 'compact' ? 'compact' : 'comfortable');

const storedCover = readStoredValue(COVER_KEY);
const showCoverArt = ref(storedCover === 'false' ? false : true);

const storedFont = readStoredValue(FONT_KEY);
const fontSize = ref(VALID_FONT_SIZES.includes(storedFont) ? storedFont : 'medium');

function applyFontSize(size) {
  const html = document.documentElement;
  html.classList.remove('font-small', 'font-large');
  if (size === 'small') html.classList.add('font-small');
  if (size === 'large') html.classList.add('font-large');
}

// Apply immediately to avoid flash
applyFontSize(fontSize.value);

function applySharpCorners(value) {
  document.documentElement.classList.toggle('sharp-corners', value);
}

function applyReduceMotion(value) {
  document.documentElement.classList.toggle('reduce-motion', value);
}

// Tracks columns visibility
const DEFAULT_COLS = { artist: true, album: true, plays: true, lastPlayed: true };
const tracksColumns = ref(readStoredJson(TRACKS_COLS_KEY, DEFAULT_COLS));

// Tracks sort preference
const DEFAULT_SORT = { field: 'artist', dir: 'asc' };
const tracksSort = ref(readStoredJson(TRACKS_SORT_KEY, DEFAULT_SORT));

// Layout visibility — individual booleans, default all on
const sharpCorners      = ref(readStoredBool(SHARP_KEY, false));
applySharpCorners(sharpCorners.value);
const reduceMotion      = ref(readStoredBool(MOTION_KEY, false));
applyReduceMotion(reduceMotion.value);
const lovedUseAccent    = ref(readStoredBool(LOVED_ACCENT_KEY, false));
const showArtistsNav    = ref(readStoredBool(ARTISTS_NAV_KEY));
const showPlaylists     = ref(readStoredBool(PLAYLISTS_KEY, true));
const wideLayout        = ref(readStoredBool(WIDE_LAYOUT_KEY, false));
const homeShowQuickPlay = ref(readStoredBool(HOME_QUICK_KEY));
const homeShowRecent    = ref(readStoredBool(HOME_RECENT_KEY));
const homeShowAlbums    = ref(readStoredBool(HOME_ALBUMS_KEY));

// Visualizer prefs
const storedViz = normalizeVizMode(readStoredValue(VIZ_MODE_KEY));
const vizMode            = ref(VALID_VIZ_MODES.includes(storedViz) ? storedViz : 'pills');
const storedRandomize = readStoredValue(RANDOMIZE_KEY);
const randomizeOnNewTrack = ref(storedRandomize === null ? false : storedRandomize !== 'false');
const storedButterchurnPresetMode = readStoredValue(BUTTERCHURN_PRESET_MODE_KEY);
const butterchurnPresetMode = ref(
  VALID_BUTTERCHURN_PRESET_MODES.includes(storedButterchurnPresetMode)
    ? storedButterchurnPresetMode
    : DEFAULT_BUTTERCHURN_PRESET_MODE
);
const storedButterchurnPreset = readStoredValue(BUTTERCHURN_PRESET_KEY);
const butterchurnPreset = ref(
  VALID_BUTTERCHURN_PRESETS.includes(storedButterchurnPreset)
    ? storedButterchurnPreset
    : DEFAULT_BUTTERCHURN_PRESET
);

const homeVisibleCount = computed(
  () => [homeShowQuickPlay.value, homeShowRecent.value, homeShowAlbums.value].filter(Boolean).length
);

const THEME_BG_RGB = {
  rose:    [28,  10, 16],
  amber:   [31,  18, 8 ],
  yellow:  [33,  24, 10],
  emerald: [7,   24, 18],
  teal:    [7,   23, 22],
  sky:     [7,   18, 29],
  indigo:  [12,  14, 31],
  violet:  [18,  12, 31],
  slate:   [15,  23, 42],
  none:    [9,   9,  11],
};

const THEME_BG_DARK_RGB = {
  rose:    [9,  4,  6 ],
  amber:   [9,  5,  2 ],
  yellow:  [9,  7,  2 ],
  emerald: [2,  8,  6 ],
  teal:    [2,  8,  8 ],
  sky:     [2,  6,  10],
  indigo:  [4,  4,  12],
  violet:  [6,  4,  12],
  slate:   [9,  9,  11],
  none:    [9,  9,  11],
};

function applyThemeColor(color) {
  if (typeof document === 'undefined') return;
  const safeColor = VALID_THEME_COLORS.includes(color) ? color : DEFAULT_THEME_COLOR;
  const root = document.documentElement;
  root.style.setProperty('--theme-bg-rgb', THEME_BG_RGB[safeColor].join(', '));
  root.style.setProperty('--theme-bg-dark-rgb', THEME_BG_DARK_RGB[safeColor].join(', '));
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', `rgb(${THEME_BG_DARK_RGB[safeColor].join(', ')})`);
  }
}

applyThemeColor(themeColor.value);

export function useTheme() {
  const api = useApi();
  const { error: toastError } = useToast();

  const accentRgb     = computed(() => COLOR_RGB[accentColor.value].join(', '));
  const accentDarkRgb = computed(() => COLOR_RGB_DARK[accentColor.value].join(', '));
  const themeBgRgb    = computed(() => THEME_BG_RGB[themeColor.value].join(', '));
  const themeBgDarkRgb = computed(() => THEME_BG_DARK_RGB[themeColor.value].join(', '));

  async function loadTheme() {
    try {
      const data = await api.getSettings();
      if (VALID_COLORS.includes(data.accentColor)) {
        accentColor.value = data.accentColor;
        writeStoredValue(STORAGE_KEY, data.accentColor);
      }
      if (VALID_THEME_COLORS.includes(data.themeColor)) {
        themeColor.value = data.themeColor;
        writeStoredValue(THEME_KEY, data.themeColor);
        applyThemeColor(data.themeColor);
      }
      if (data.density === 'compact' || data.density === 'comfortable') {
        density.value = data.density;
        writeStoredValue(DENSITY_KEY, data.density);
      }
      if (typeof data.showCoverArt === 'boolean') {
        showCoverArt.value = data.showCoverArt;
        writeStoredBool(COVER_KEY, data.showCoverArt);
      }
      if (VALID_FONT_SIZES.includes(data.fontSize)) {
        fontSize.value = data.fontSize;
        writeStoredValue(FONT_KEY, data.fontSize);
        applyFontSize(data.fontSize);
      }
      if (data.tracksColumns && typeof data.tracksColumns === 'object') {
        tracksColumns.value = { ...DEFAULT_COLS, ...data.tracksColumns };
        writeStoredJson(TRACKS_COLS_KEY, tracksColumns.value);
      }
      if (data.tracksSort && typeof data.tracksSort.field === 'string') {
        tracksSort.value = { field: data.tracksSort.field, dir: data.tracksSort.dir };
        writeStoredJson(TRACKS_SORT_KEY, tracksSort.value);
      }
      if (typeof data.lovedAccent === 'boolean') {
        lovedUseAccent.value = data.lovedAccent;
        writeStoredBool(LOVED_ACCENT_KEY, data.lovedAccent);
      }
      if (typeof data.showArtistsNav === 'boolean') {
        showArtistsNav.value = data.showArtistsNav;
        writeStoredBool(ARTISTS_NAV_KEY, data.showArtistsNav);
      }
      if (typeof data.wideLayout === 'boolean') {
        wideLayout.value = data.wideLayout;
        writeStoredBool(WIDE_LAYOUT_KEY, data.wideLayout);
      }
      if (typeof data.homeShowQuickPlay === 'boolean') {
        homeShowQuickPlay.value = data.homeShowQuickPlay;
        writeStoredBool(HOME_QUICK_KEY, data.homeShowQuickPlay);
      }
      if (typeof data.homeShowRecent === 'boolean') {
        homeShowRecent.value = data.homeShowRecent;
        writeStoredBool(HOME_RECENT_KEY, data.homeShowRecent);
      }
      if (typeof data.homeShowAlbums === 'boolean') {
        homeShowAlbums.value = data.homeShowAlbums;
        writeStoredBool(HOME_ALBUMS_KEY, data.homeShowAlbums);
      }
      const normalizedVizMode = normalizeVizMode(data.vizMode);
      if (VALID_VIZ_MODES.includes(normalizedVizMode)) {
        vizMode.value = normalizedVizMode;
        writeStoredValue(VIZ_MODE_KEY, normalizedVizMode);
      }
      if (typeof data.randomizeOnNewTrack === 'boolean') {
        randomizeOnNewTrack.value = data.randomizeOnNewTrack;
        writeStoredBool(RANDOMIZE_KEY, data.randomizeOnNewTrack);
      }
      if (VALID_BUTTERCHURN_PRESET_MODES.includes(data.butterchurnPresetMode)) {
        butterchurnPresetMode.value = data.butterchurnPresetMode;
        writeStoredValue(BUTTERCHURN_PRESET_MODE_KEY, data.butterchurnPresetMode);
      } else {
        butterchurnPresetMode.value = DEFAULT_BUTTERCHURN_PRESET_MODE;
        writeStoredValue(BUTTERCHURN_PRESET_MODE_KEY, butterchurnPresetMode.value);
      }
      if (VALID_BUTTERCHURN_PRESETS.includes(data.butterchurnPreset)) {
        butterchurnPreset.value = data.butterchurnPreset;
        writeStoredValue(BUTTERCHURN_PRESET_KEY, data.butterchurnPreset);
      }
      if (typeof data.showPlaylists === 'boolean') {
        showPlaylists.value = data.showPlaylists;
        writeStoredBool(PLAYLISTS_KEY, data.showPlaylists);
      }
      if (typeof data.sharpCorners === 'boolean') {
        sharpCorners.value = data.sharpCorners;
        writeStoredBool(SHARP_KEY, data.sharpCorners);
        applySharpCorners(data.sharpCorners);
      }
      if (typeof data.reduceMotion === 'boolean') {
        reduceMotion.value = data.reduceMotion;
        writeStoredBool(MOTION_KEY, data.reduceMotion);
        applyReduceMotion(data.reduceMotion);
      }
    } catch {
      // fall back to localStorage values already applied above
    }
  }

  async function saveOrRollback(body, rollback, message = 'Failed to save setting.') {
    try {
      await api.saveSettings(body);
      return true;
    } catch {
      rollback?.();
      toastError(message);
      return false;
    }
  }

  async function applyStoredSetting({
    current,
    previous,
    next,
    persist,
    body,
    message,
    apply,
  }) {
    current.value = next;
    persist(next);
    apply?.(next);

    await saveOrRollback(
      body,
      () => {
        current.value = previous;
        persist(previous);
        apply?.(previous);
      },
      message
    );
  }

  async function applyStoredObjectSetting({
    current,
    previous,
    next,
    persist,
    body,
    message,
  }) {
    current.value = next;
    persist(next);

    await saveOrRollback(
      body,
      () => {
        current.value = previous;
        persist(previous);
      },
      message
    );
  }

  async function setAccentColor(color) {
    if (!VALID_COLORS.includes(color)) return;
    await applyStoredSetting({
      current: accentColor,
      previous: accentColor.value,
      next: color,
      persist: (value) => writeStoredValue(STORAGE_KEY, value),
      body: { accentColor: color },
      message: 'Failed to save accent color.',
    });
  }

  async function setThemeColor(color) {
    if (!VALID_THEME_COLORS.includes(color)) return;
    await applyStoredSetting({
      current: themeColor,
      previous: themeColor.value,
      next: color,
      persist: (value) => writeStoredValue(THEME_KEY, value),
      body: { themeColor: color },
      message: 'Failed to save background theme.',
      apply: applyThemeColor,
    });
  }

  async function setDensity(value) {
    if (value !== 'comfortable' && value !== 'compact') return;
    await applyStoredSetting({
      current: density,
      previous: density.value,
      next: value,
      persist: (nextValue) => writeStoredValue(DENSITY_KEY, nextValue),
      body: { density: value },
      message: 'Failed to save list density.',
    });
  }

  async function setShowCoverArt(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: showCoverArt,
      previous: showCoverArt.value,
      next,
      persist: (nextValue) => writeStoredBool(COVER_KEY, nextValue),
      body: { showCoverArt: next },
      message: 'Failed to save cover art setting.',
    });
  }

  async function setFontSize(value) {
    if (!VALID_FONT_SIZES.includes(value)) return;
    await applyStoredSetting({
      current: fontSize,
      previous: fontSize.value,
      next: value,
      persist: (nextValue) => writeStoredValue(FONT_KEY, nextValue),
      body: { fontSize: value },
      message: 'Failed to save font size.',
      apply: applyFontSize,
    });
  }

  async function setTracksColumn(key, value) {
    const next = { ...tracksColumns.value, [key]: Boolean(value) };
    await applyStoredObjectSetting({
      current: tracksColumns,
      previous: { ...tracksColumns.value },
      next,
      persist: (nextValue) => writeStoredJson(TRACKS_COLS_KEY, nextValue),
      body: { tracksColumns: next },
      message: 'Failed to save visible track columns.',
    });
  }

  async function setTracksSort(field, dir) {
    const next = { field, dir };
    await applyStoredObjectSetting({
      current: tracksSort,
      previous: { ...tracksSort.value },
      next,
      persist: (nextValue) => writeStoredJson(TRACKS_SORT_KEY, nextValue),
      body: { tracksSort: next },
      message: 'Failed to save tracks sort.',
    });
  }

  async function setLovedUseAccent(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: lovedUseAccent,
      previous: lovedUseAccent.value,
      next,
      persist: (nextValue) => writeStoredBool(LOVED_ACCENT_KEY, nextValue),
      body: { lovedAccent: next },
      message: 'Failed to save loved-track color setting.',
    });
  }

  async function setShowArtistsNav(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: showArtistsNav,
      previous: showArtistsNav.value,
      next,
      persist: (nextValue) => writeStoredBool(ARTISTS_NAV_KEY, nextValue),
      body: { showArtistsNav: next },
      message: 'Failed to save artists navigation visibility.',
    });
  }

  async function setWideLayout(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: wideLayout,
      previous: wideLayout.value,
      next,
      persist: (nextValue) => writeStoredBool(WIDE_LAYOUT_KEY, nextValue),
      body: { wideLayout: next },
      message: 'Failed to save wide layout setting.',
    });
  }

  async function _setHomeSection(ref, storageKey, serverKey, value) {
    if (!value && homeVisibleCount.value <= 1) return;
    const next = Boolean(value);
    await applyStoredSetting({
      current: ref,
      previous: ref.value,
      next,
      persist: (nextValue) => writeStoredBool(storageKey, nextValue),
      body: { [serverKey]: next },
      message: 'Failed to save home section visibility.',
    });
  }

  async function setVizMode(value) {
    value = normalizeVizMode(value);
    if (!VALID_VIZ_MODES.includes(value)) return;
    await applyStoredSetting({
      current: vizMode,
      previous: vizMode.value,
      next: value,
      persist: (nextValue) => writeStoredValue(VIZ_MODE_KEY, nextValue),
      body: { vizMode: value },
      message: 'Failed to save visualizer mode.',
    });
  }

  async function setRandomizeOnNewTrack(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: randomizeOnNewTrack,
      previous: randomizeOnNewTrack.value,
      next,
      persist: (nextValue) => writeStoredBool(RANDOMIZE_KEY, nextValue),
      body: { randomizeOnNewTrack: next },
      message: 'Failed to save randomize-on-new-track setting.',
    });
  }

  async function setButterchurnPresetMode(value) {
    if (!VALID_BUTTERCHURN_PRESET_MODES.includes(value)) return;
    await applyStoredSetting({
      current: butterchurnPresetMode,
      previous: butterchurnPresetMode.value,
      next: value,
      persist: (nextValue) => writeStoredValue(BUTTERCHURN_PRESET_MODE_KEY, nextValue),
      body: { butterchurnPresetMode: value },
      message: 'Failed to save Butterchurn preset mode.',
    });
  }

  async function setButterchurnPreset(value) {
    if (!VALID_BUTTERCHURN_PRESETS.includes(value)) return;
    await applyStoredSetting({
      current: butterchurnPreset,
      previous: butterchurnPreset.value,
      next: value,
      persist: (nextValue) => writeStoredValue(BUTTERCHURN_PRESET_KEY, nextValue),
      body: { butterchurnPreset: value },
      message: 'Failed to save Butterchurn preset.',
    });
  }

  async function setShowPlaylists(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: showPlaylists,
      previous: showPlaylists.value,
      next,
      persist: (nextValue) => writeStoredBool(PLAYLISTS_KEY, nextValue),
      body: { showPlaylists: next },
      message: 'Failed to save playlists visibility setting.',
    });
  }

  async function setReduceMotion(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: reduceMotion,
      previous: reduceMotion.value,
      next,
      persist: (nextValue) => writeStoredBool(MOTION_KEY, nextValue),
      body: { reduceMotion: next },
      message: 'Failed to save motion setting.',
      apply: applyReduceMotion,
    });
  }

  async function setSharpCorners(value) {
    const next = Boolean(value);
    await applyStoredSetting({
      current: sharpCorners,
      previous: sharpCorners.value,
      next,
      persist: (nextValue) => writeStoredBool(SHARP_KEY, nextValue),
      body: { sharpCorners: next },
      message: 'Failed to save corner style setting.',
      apply: applySharpCorners,
    });
  }

  return {
    accentColor, accentRgb, accentDarkRgb,
    themeColor, themeBgRgb, themeBgDarkRgb, VALID_COLORS, VALID_THEME_COLORS,
    density,
    showCoverArt,
    fontSize, VALID_FONT_SIZES,
    lovedUseAccent,
    tracksColumns, tracksSort,
    showArtistsNav,
    wideLayout,
    homeShowQuickPlay, homeShowRecent, homeShowAlbums, homeVisibleCount,
    vizMode, randomizeOnNewTrack, VALID_VIZ_MODES,
    butterchurnPresetMode, butterchurnPreset,
    BUTTERCHURN_PRESET_OPTIONS, VALID_BUTTERCHURN_PRESET_MODES,
    showPlaylists,
    sharpCorners, reduceMotion,
    loadTheme, setAccentColor, setThemeColor, setDensity, setShowCoverArt, setFontSize,
    setLovedUseAccent,
    setTracksColumn, setTracksSort,
    setShowArtistsNav, setWideLayout,
    setVizMode, setRandomizeOnNewTrack, setButterchurnPresetMode, setButterchurnPreset,
    setShowPlaylists, setSharpCorners, setReduceMotion,
    setHomeSection: (key, value) => {
      if (key === 'quickPlay') _setHomeSection(homeShowQuickPlay, HOME_QUICK_KEY, 'homeShowQuickPlay', value);
      if (key === 'recent')    _setHomeSection(homeShowRecent,    HOME_RECENT_KEY, 'homeShowRecent', value);
      if (key === 'albums')    _setHomeSection(homeShowAlbums,    HOME_ALBUMS_KEY, 'homeShowAlbums', value);
    },
  };
}
