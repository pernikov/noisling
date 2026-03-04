import { ref, computed } from 'vue';
import { useApi } from './useApi.js';

const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];

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
const DENSITY_KEY  = 'noisling_density';
const COVER_KEY    = 'noisling_cover';
const FONT_KEY     = 'noisling_fontsize';
const DEFAULT_COLOR = 'violet';
const VALID_FONT_SIZES = ['small', 'medium', 'large'];

// Songs view keys
const SONGS_COLS_KEY = 'noisling_songs_cols';
const SONGS_SORT_KEY = 'noisling_songs_sort';

// Loved color key
const LOVED_ACCENT_KEY = 'noisling_loved_accent';

// Layout visibility keys
const ARTISTS_NAV_KEY = 'noisling_artists_nav';
const HOME_QUICK_KEY  = 'noisling_home_quick';
const HOME_RECENT_KEY = 'noisling_home_recent';
const HOME_ALBUMS_KEY = 'noisling_home_albums';
const WIDE_LAYOUT_KEY = 'noisling_wide_layout';

// Visualizer keys
const VIZ_MODE_KEY  = 'noisling_vizmode';
const BUBBLES_KEY   = 'noisling_showbubbles';
const RANDOMIZE_KEY = 'noisling_randomize';
const VALID_VIZ_MODES = ['spiral', 'wave', 'particles', 'polar', 'spectrum', 'bubbles'];

// Module-level singletons — read from localStorage immediately so there's no
// flash of the wrong value before the API call returns.
const stored = localStorage.getItem(STORAGE_KEY);
const accentColor = ref(VALID_COLORS.includes(stored) ? stored : DEFAULT_COLOR);

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

// Songs columns visibility
const DEFAULT_COLS = { artist: true, album: true, plays: true, lastPlayed: true };
const songsColumns = ref((() => {
  try { return { ...DEFAULT_COLS, ...JSON.parse(localStorage.getItem(SONGS_COLS_KEY)) }; }
  catch { return { ...DEFAULT_COLS }; }
})());

// Songs sort preference
const DEFAULT_SORT = { field: 'artist', dir: 'asc' };
const songsSort = ref((() => {
  try { return { ...DEFAULT_SORT, ...JSON.parse(localStorage.getItem(SONGS_SORT_KEY)) }; }
  catch { return { ...DEFAULT_SORT }; }
})());

// Layout visibility — individual booleans, default all on
function storedBool(key, defaultVal = true) {
  const v = localStorage.getItem(key);
  return v === null ? defaultVal : v !== 'false';
}

const lovedUseAccent    = ref(storedBool(LOVED_ACCENT_KEY, false));
const showArtistsNav    = ref(storedBool(ARTISTS_NAV_KEY));
const wideLayout        = ref(storedBool(WIDE_LAYOUT_KEY, false));
const homeShowQuickPlay = ref(storedBool(HOME_QUICK_KEY));
const homeShowRecent    = ref(storedBool(HOME_RECENT_KEY));
const homeShowAlbums    = ref(storedBool(HOME_ALBUMS_KEY));

// Visualizer prefs
const storedViz = localStorage.getItem(VIZ_MODE_KEY);
const vizMode            = ref(VALID_VIZ_MODES.includes(storedViz) ? storedViz : 'spiral');
const showBubbles        = ref(storedBool(BUBBLES_KEY, true));
const randomizeOnNewSong = ref(storedBool(RANDOMIZE_KEY, false));

const homeVisibleCount = computed(
  () => [homeShowQuickPlay.value, homeShowRecent.value, homeShowAlbums.value].filter(Boolean).length
);

export function useTheme() {
  const api = useApi();

  const accentRgb     = computed(() => COLOR_RGB[accentColor.value].join(', '));
  const accentDarkRgb = computed(() => COLOR_RGB_DARK[accentColor.value].join(', '));

  async function loadTheme() {
    try {
      const data = await api.getSettings();
      if (VALID_COLORS.includes(data.accentColor)) {
        accentColor.value = data.accentColor;
        localStorage.setItem(STORAGE_KEY, data.accentColor);
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
      if (data.songsColumns && typeof data.songsColumns === 'object') {
        songsColumns.value = { ...DEFAULT_COLS, ...data.songsColumns };
        localStorage.setItem(SONGS_COLS_KEY, JSON.stringify(songsColumns.value));
      }
      if (data.songsSort && typeof data.songsSort.field === 'string') {
        songsSort.value = { field: data.songsSort.field, dir: data.songsSort.dir };
        localStorage.setItem(SONGS_SORT_KEY, JSON.stringify(songsSort.value));
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
      if (typeof data.randomizeOnNewSong === 'boolean') {
        randomizeOnNewSong.value = data.randomizeOnNewSong;
        localStorage.setItem(RANDOMIZE_KEY, String(data.randomizeOnNewSong));
      }
    } catch {
      // fall back to localStorage values already applied above
    }
  }

  async function setAccentColor(color) {
    if (!VALID_COLORS.includes(color)) return;
    accentColor.value = color;
    localStorage.setItem(STORAGE_KEY, color);
    try { await api.saveSettings({ accentColor: color }); } catch {}
  }

  async function setDensity(value) {
    if (value !== 'comfortable' && value !== 'compact') return;
    density.value = value;
    localStorage.setItem(DENSITY_KEY, value);
    try { await api.saveSettings({ density: value }); } catch {}
  }

  async function setShowCoverArt(value) {
    showCoverArt.value = Boolean(value);
    localStorage.setItem(COVER_KEY, String(showCoverArt.value));
    try { await api.saveSettings({ showCoverArt: showCoverArt.value }); } catch {}
  }

  async function setFontSize(value) {
    if (!VALID_FONT_SIZES.includes(value)) return;
    fontSize.value = value;
    localStorage.setItem(FONT_KEY, value);
    applyFontSize(value);
    try { await api.saveSettings({ fontSize: value }); } catch {}
  }

  async function setSongsColumn(key, value) {
    songsColumns.value = { ...songsColumns.value, [key]: Boolean(value) };
    localStorage.setItem(SONGS_COLS_KEY, JSON.stringify(songsColumns.value));
    try { await api.saveSettings({ songsColumns: songsColumns.value }); } catch {}
  }

  async function setSongsSort(field, dir) {
    songsSort.value = { field, dir };
    localStorage.setItem(SONGS_SORT_KEY, JSON.stringify({ field, dir }));
    try { await api.saveSettings({ songsSort: { field, dir } }); } catch {}
  }

  async function setLovedUseAccent(value) {
    lovedUseAccent.value = Boolean(value);
    localStorage.setItem(LOVED_ACCENT_KEY, String(lovedUseAccent.value));
    try { await api.saveSettings({ lovedAccent: lovedUseAccent.value }); } catch {}
  }

  async function setShowArtistsNav(value) {
    showArtistsNav.value = Boolean(value);
    localStorage.setItem(ARTISTS_NAV_KEY, String(showArtistsNav.value));
    try { await api.saveSettings({ showArtistsNav: showArtistsNav.value }); } catch {}
  }

  async function setWideLayout(value) {
    wideLayout.value = Boolean(value);
    localStorage.setItem(WIDE_LAYOUT_KEY, String(wideLayout.value));
    try { await api.saveSettings({ wideLayout: wideLayout.value }); } catch {}
  }

  async function _setHomeSection(ref, storageKey, serverKey, value) {
    if (!value && homeVisibleCount.value <= 1) return;
    ref.value = Boolean(value);
    localStorage.setItem(storageKey, String(ref.value));
    try { await api.saveSettings({ [serverKey]: ref.value }); } catch {}
  }

  async function setVizMode(value) {
    if (!VALID_VIZ_MODES.includes(value)) return;
    vizMode.value = value;
    localStorage.setItem(VIZ_MODE_KEY, value);
    try { await api.saveSettings({ vizMode: value }); } catch {}
  }

  async function setShowBubbles(value) {
    showBubbles.value = Boolean(value);
    localStorage.setItem(BUBBLES_KEY, String(showBubbles.value));
    try { await api.saveSettings({ showBubbles: showBubbles.value }); } catch {}
  }

  async function setRandomizeOnNewSong(value) {
    randomizeOnNewSong.value = Boolean(value);
    localStorage.setItem(RANDOMIZE_KEY, String(randomizeOnNewSong.value));
    try { await api.saveSettings({ randomizeOnNewSong: randomizeOnNewSong.value }); } catch {}
  }

  return {
    accentColor, accentRgb, accentDarkRgb, VALID_COLORS,
    density,
    showCoverArt,
    fontSize, VALID_FONT_SIZES,
    lovedUseAccent,
    songsColumns, songsSort,
    showArtistsNav,
    wideLayout,
    homeShowQuickPlay, homeShowRecent, homeShowAlbums, homeVisibleCount,
    vizMode, showBubbles, randomizeOnNewSong, VALID_VIZ_MODES,
    loadTheme, setAccentColor, setDensity, setShowCoverArt, setFontSize,
    setLovedUseAccent,
    setSongsColumn, setSongsSort,
    setShowArtistsNav, setWideLayout,
    setVizMode, setShowBubbles, setRandomizeOnNewSong,
    setHomeSection: (key, value) => {
      if (key === 'quickPlay') _setHomeSection(homeShowQuickPlay, HOME_QUICK_KEY, 'homeShowQuickPlay', value);
      if (key === 'recent')    _setHomeSection(homeShowRecent,    HOME_RECENT_KEY, 'homeShowRecent', value);
      if (key === 'albums')    _setHomeSection(homeShowAlbums,    HOME_ALBUMS_KEY, 'homeShowAlbums', value);
    },
  };
}
