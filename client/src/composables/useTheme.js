import { ref, computed } from 'vue';
import { useApi } from './useApi.js';
import { useToast } from './useToast.js';

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
const BUBBLES_KEY   = 'noisling_showbubbles';
const RANDOMIZE_KEY = 'noisling_randomize';
const VALID_VIZ_MODES = ['spiral', 'wave', 'particles', 'polar', 'spectrum', 'bubbles'];

// Module-level singletons — read from localStorage immediately so there's no
// flash of the wrong value before the API call returns.
const stored = localStorage.getItem(STORAGE_KEY);
const accentColor = ref(VALID_COLORS.includes(stored) ? stored : DEFAULT_COLOR);
const storedTheme = localStorage.getItem(THEME_KEY);
const themeColor = ref(VALID_THEME_COLORS.includes(storedTheme) ? storedTheme : DEFAULT_THEME_COLOR);

const storedDensity = localStorage.getItem(DENSITY_KEY);
const density = ref(storedDensity === 'compact' ? 'compact' : 'comfortable');

const storedCover = localStorage.getItem(COVER_KEY);
const showCoverArt = ref(storedCover === 'false' ? false : true);

const storedFont = localStorage.getItem(FONT_KEY);
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
const tracksColumns = ref((() => {
  try { return { ...DEFAULT_COLS, ...JSON.parse(localStorage.getItem(TRACKS_COLS_KEY)) }; }
  catch { return { ...DEFAULT_COLS }; }
})());

// Tracks sort preference
const DEFAULT_SORT = { field: 'artist', dir: 'asc' };
const tracksSort = ref((() => {
  try { return { ...DEFAULT_SORT, ...JSON.parse(localStorage.getItem(TRACKS_SORT_KEY)) }; }
  catch { return { ...DEFAULT_SORT }; }
})());

// Layout visibility — individual booleans, default all on
function storedBool(key, defaultVal = true) {
  const v = localStorage.getItem(key);
  return v === null ? defaultVal : v !== 'false';
}

const sharpCorners      = ref(storedBool(SHARP_KEY, false));
applySharpCorners(sharpCorners.value);
const reduceMotion      = ref(storedBool(MOTION_KEY, false));
applyReduceMotion(reduceMotion.value);
const lovedUseAccent    = ref(storedBool(LOVED_ACCENT_KEY, false));
const showArtistsNav    = ref(storedBool(ARTISTS_NAV_KEY));
const showPlaylists     = ref(storedBool(PLAYLISTS_KEY, true));
const wideLayout        = ref(storedBool(WIDE_LAYOUT_KEY, false));
const homeShowQuickPlay = ref(storedBool(HOME_QUICK_KEY));
const homeShowRecent    = ref(storedBool(HOME_RECENT_KEY));
const homeShowAlbums    = ref(storedBool(HOME_ALBUMS_KEY));

// Visualizer prefs
const storedViz = localStorage.getItem(VIZ_MODE_KEY);
const vizMode            = ref(VALID_VIZ_MODES.includes(storedViz) ? storedViz : 'spiral');
const showBubbles        = ref(storedBool(BUBBLES_KEY, true));
const randomizeOnNewTrack = ref(storedBool(RANDOMIZE_KEY, false));

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
        localStorage.setItem(STORAGE_KEY, data.accentColor);
      }
      if (VALID_THEME_COLORS.includes(data.themeColor)) {
        themeColor.value = data.themeColor;
        localStorage.setItem(THEME_KEY, data.themeColor);
        applyThemeColor(data.themeColor);
      }
      if (data.density === 'compact' || data.density === 'comfortable') {
        density.value = data.density;
        localStorage.setItem(DENSITY_KEY, data.density);
      }
      if (typeof data.showCoverArt === 'boolean') {
        showCoverArt.value = data.showCoverArt;
        localStorage.setItem(COVER_KEY, String(data.showCoverArt));
      }
      if (VALID_FONT_SIZES.includes(data.fontSize)) {
        fontSize.value = data.fontSize;
        localStorage.setItem(FONT_KEY, data.fontSize);
        applyFontSize(data.fontSize);
      }
      if (data.tracksColumns && typeof data.tracksColumns === 'object') {
        tracksColumns.value = { ...DEFAULT_COLS, ...data.tracksColumns };
        localStorage.setItem(TRACKS_COLS_KEY, JSON.stringify(tracksColumns.value));
      }
      if (data.tracksSort && typeof data.tracksSort.field === 'string') {
        tracksSort.value = { field: data.tracksSort.field, dir: data.tracksSort.dir };
        localStorage.setItem(TRACKS_SORT_KEY, JSON.stringify(tracksSort.value));
      }
      if (typeof data.lovedAccent === 'boolean') {
        lovedUseAccent.value = data.lovedAccent;
        localStorage.setItem(LOVED_ACCENT_KEY, String(data.lovedAccent));
      }
      if (typeof data.showArtistsNav === 'boolean') {
        showArtistsNav.value = data.showArtistsNav;
        localStorage.setItem(ARTISTS_NAV_KEY, String(data.showArtistsNav));
      }
      if (typeof data.wideLayout === 'boolean') {
        wideLayout.value = data.wideLayout;
        localStorage.setItem(WIDE_LAYOUT_KEY, String(data.wideLayout));
      }
      if (typeof data.homeShowQuickPlay === 'boolean') {
        homeShowQuickPlay.value = data.homeShowQuickPlay;
        localStorage.setItem(HOME_QUICK_KEY, String(data.homeShowQuickPlay));
      }
      if (typeof data.homeShowRecent === 'boolean') {
        homeShowRecent.value = data.homeShowRecent;
        localStorage.setItem(HOME_RECENT_KEY, String(data.homeShowRecent));
      }
      if (typeof data.homeShowAlbums === 'boolean') {
        homeShowAlbums.value = data.homeShowAlbums;
        localStorage.setItem(HOME_ALBUMS_KEY, String(data.homeShowAlbums));
      }
      if (VALID_VIZ_MODES.includes(data.vizMode)) {
        vizMode.value = data.vizMode;
        localStorage.setItem(VIZ_MODE_KEY, data.vizMode);
      }
      if (typeof data.showBubbles === 'boolean') {
        showBubbles.value = data.showBubbles;
        localStorage.setItem(BUBBLES_KEY, String(data.showBubbles));
      }
      if (typeof data.randomizeOnNewTrack === 'boolean') {
        randomizeOnNewTrack.value = data.randomizeOnNewTrack;
        localStorage.setItem(RANDOMIZE_KEY, String(data.randomizeOnNewTrack));
      }
      if (typeof data.showPlaylists === 'boolean') {
        showPlaylists.value = data.showPlaylists;
        localStorage.setItem(PLAYLISTS_KEY, String(data.showPlaylists));
      }
      if (typeof data.sharpCorners === 'boolean') {
        sharpCorners.value = data.sharpCorners;
        localStorage.setItem(SHARP_KEY, String(data.sharpCorners));
        applySharpCorners(data.sharpCorners);
      }
      if (typeof data.reduceMotion === 'boolean') {
        reduceMotion.value = data.reduceMotion;
        localStorage.setItem(MOTION_KEY, String(data.reduceMotion));
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

  async function setAccentColor(color) {
    if (!VALID_COLORS.includes(color)) return;
    const prev = accentColor.value;
    accentColor.value = color;
    localStorage.setItem(STORAGE_KEY, color);
    await saveOrRollback(
      { accentColor: color },
      () => {
        accentColor.value = prev;
        localStorage.setItem(STORAGE_KEY, prev);
      },
      'Failed to save accent color.'
    );
  }

  async function setThemeColor(color) {
    if (!VALID_THEME_COLORS.includes(color)) return;
    const prev = themeColor.value;
    themeColor.value = color;
    localStorage.setItem(THEME_KEY, color);
    applyThemeColor(color);
    await saveOrRollback(
      { themeColor: color },
      () => {
        themeColor.value = prev;
        localStorage.setItem(THEME_KEY, prev);
        applyThemeColor(prev);
      },
      'Failed to save background theme.'
    );
  }

  async function setDensity(value) {
    if (value !== 'comfortable' && value !== 'compact') return;
    const prev = density.value;
    density.value = value;
    localStorage.setItem(DENSITY_KEY, value);
    await saveOrRollback(
      { density: value },
      () => {
        density.value = prev;
        localStorage.setItem(DENSITY_KEY, prev);
      },
      'Failed to save list density.'
    );
  }

  async function setShowCoverArt(value) {
    const prev = showCoverArt.value;
    showCoverArt.value = Boolean(value);
    localStorage.setItem(COVER_KEY, String(showCoverArt.value));
    await saveOrRollback(
      { showCoverArt: showCoverArt.value },
      () => {
        showCoverArt.value = prev;
        localStorage.setItem(COVER_KEY, String(prev));
      },
      'Failed to save cover art setting.'
    );
  }

  async function setFontSize(value) {
    if (!VALID_FONT_SIZES.includes(value)) return;
    const prev = fontSize.value;
    fontSize.value = value;
    localStorage.setItem(FONT_KEY, value);
    applyFontSize(value);
    await saveOrRollback(
      { fontSize: value },
      () => {
        fontSize.value = prev;
        localStorage.setItem(FONT_KEY, prev);
        applyFontSize(prev);
      },
      'Failed to save font size.'
    );
  }

  async function setTracksColumn(key, value) {
    const prev = { ...tracksColumns.value };
    tracksColumns.value = { ...tracksColumns.value, [key]: Boolean(value) };
    localStorage.setItem(TRACKS_COLS_KEY, JSON.stringify(tracksColumns.value));
    await saveOrRollback(
      { tracksColumns: tracksColumns.value },
      () => {
        tracksColumns.value = prev;
        localStorage.setItem(TRACKS_COLS_KEY, JSON.stringify(prev));
      },
      'Failed to save visible track columns.'
    );
  }

  async function setTracksSort(field, dir) {
    const prev = { ...tracksSort.value };
    tracksSort.value = { field, dir };
    localStorage.setItem(TRACKS_SORT_KEY, JSON.stringify({ field, dir }));
    await saveOrRollback(
      { tracksSort: { field, dir } },
      () => {
        tracksSort.value = prev;
        localStorage.setItem(TRACKS_SORT_KEY, JSON.stringify(prev));
      },
      'Failed to save tracks sort.'
    );
  }

  async function setLovedUseAccent(value) {
    const prev = lovedUseAccent.value;
    lovedUseAccent.value = Boolean(value);
    localStorage.setItem(LOVED_ACCENT_KEY, String(lovedUseAccent.value));
    await saveOrRollback(
      { lovedAccent: lovedUseAccent.value },
      () => {
        lovedUseAccent.value = prev;
        localStorage.setItem(LOVED_ACCENT_KEY, String(prev));
      },
      'Failed to save loved-track color setting.'
    );
  }

  async function setShowArtistsNav(value) {
    const prev = showArtistsNav.value;
    showArtistsNav.value = Boolean(value);
    localStorage.setItem(ARTISTS_NAV_KEY, String(showArtistsNav.value));
    await saveOrRollback(
      { showArtistsNav: showArtistsNav.value },
      () => {
        showArtistsNav.value = prev;
        localStorage.setItem(ARTISTS_NAV_KEY, String(prev));
      },
      'Failed to save artists navigation visibility.'
    );
  }

  async function setWideLayout(value) {
    const prev = wideLayout.value;
    wideLayout.value = Boolean(value);
    localStorage.setItem(WIDE_LAYOUT_KEY, String(wideLayout.value));
    await saveOrRollback(
      { wideLayout: wideLayout.value },
      () => {
        wideLayout.value = prev;
        localStorage.setItem(WIDE_LAYOUT_KEY, String(prev));
      },
      'Failed to save wide layout setting.'
    );
  }

  async function _setHomeSection(ref, storageKey, serverKey, value) {
    if (!value && homeVisibleCount.value <= 1) return;
    const prev = ref.value;
    ref.value = Boolean(value);
    localStorage.setItem(storageKey, String(ref.value));
    await saveOrRollback(
      { [serverKey]: ref.value },
      () => {
        ref.value = prev;
        localStorage.setItem(storageKey, String(prev));
      },
      'Failed to save home section visibility.'
    );
  }

  async function setVizMode(value) {
    if (!VALID_VIZ_MODES.includes(value)) return;
    const prev = vizMode.value;
    vizMode.value = value;
    localStorage.setItem(VIZ_MODE_KEY, value);
    await saveOrRollback(
      { vizMode: value },
      () => {
        vizMode.value = prev;
        localStorage.setItem(VIZ_MODE_KEY, prev);
      },
      'Failed to save visualizer mode.'
    );
  }

  async function setShowBubbles(value) {
    const prev = showBubbles.value;
    showBubbles.value = Boolean(value);
    localStorage.setItem(BUBBLES_KEY, String(showBubbles.value));
    await saveOrRollback(
      { showBubbles: showBubbles.value },
      () => {
        showBubbles.value = prev;
        localStorage.setItem(BUBBLES_KEY, String(prev));
      },
      'Failed to save bubbles visibility.'
    );
  }

  async function setRandomizeOnNewTrack(value) {
    const prev = randomizeOnNewTrack.value;
    randomizeOnNewTrack.value = Boolean(value);
    localStorage.setItem(RANDOMIZE_KEY, String(randomizeOnNewTrack.value));
    await saveOrRollback(
      { randomizeOnNewTrack: randomizeOnNewTrack.value },
      () => {
        randomizeOnNewTrack.value = prev;
        localStorage.setItem(RANDOMIZE_KEY, String(prev));
      },
      'Failed to save randomize-on-new-track setting.'
    );
  }

  async function setShowPlaylists(value) {
    const prev = showPlaylists.value;
    showPlaylists.value = Boolean(value);
    localStorage.setItem(PLAYLISTS_KEY, String(showPlaylists.value));
    await saveOrRollback(
      { showPlaylists: showPlaylists.value },
      () => {
        showPlaylists.value = prev;
        localStorage.setItem(PLAYLISTS_KEY, String(prev));
      },
      'Failed to save playlists visibility setting.'
    );
  }

  async function setReduceMotion(value) {
    const prev = reduceMotion.value;
    reduceMotion.value = Boolean(value);
    localStorage.setItem(MOTION_KEY, String(reduceMotion.value));
    applyReduceMotion(reduceMotion.value);
    await saveOrRollback(
      { reduceMotion: reduceMotion.value },
      () => {
        reduceMotion.value = prev;
        localStorage.setItem(MOTION_KEY, String(prev));
        applyReduceMotion(prev);
      },
      'Failed to save motion setting.'
    );
  }

  async function setSharpCorners(value) {
    const prev = sharpCorners.value;
    sharpCorners.value = Boolean(value);
    localStorage.setItem(SHARP_KEY, String(sharpCorners.value));
    applySharpCorners(sharpCorners.value);
    await saveOrRollback(
      { sharpCorners: sharpCorners.value },
      () => {
        sharpCorners.value = prev;
        localStorage.setItem(SHARP_KEY, String(prev));
        applySharpCorners(prev);
      },
      'Failed to save corner style setting.'
    );
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
    vizMode, showBubbles, randomizeOnNewTrack, VALID_VIZ_MODES,
    showPlaylists,
    sharpCorners, reduceMotion,
    loadTheme, setAccentColor, setThemeColor, setDensity, setShowCoverArt, setFontSize,
    setLovedUseAccent,
    setTracksColumn, setTracksSort,
    setShowArtistsNav, setWideLayout,
    setVizMode, setShowBubbles, setRandomizeOnNewTrack,
    setShowPlaylists, setSharpCorners, setReduceMotion,
    setHomeSection: (key, value) => {
      if (key === 'quickPlay') _setHomeSection(homeShowQuickPlay, HOME_QUICK_KEY, 'homeShowQuickPlay', value);
      if (key === 'recent')    _setHomeSection(homeShowRecent,    HOME_RECENT_KEY, 'homeShowRecent', value);
      if (key === 'albums')    _setHomeSection(homeShowAlbums,    HOME_ALBUMS_KEY, 'homeShowAlbums', value);
    },
  };
}
