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

const STORAGE_KEY = 'noisling_accent';
const DENSITY_KEY = 'noisling_density';
const COVER_KEY   = 'noisling_cover';
const FONT_KEY    = 'noisling_fontsize';
const DEFAULT_COLOR = 'violet';
const VALID_FONT_SIZES = ['small', 'medium', 'large'];

// Songs view keys
const SONGS_COLS_KEY  = 'noisling_songs_cols';
const SONGS_SORT_KEY  = 'noisling_songs_sort';

// Loved color key
const LOVED_ACCENT_KEY     = 'noisling_loved_accent';

// Layout visibility keys
const ARTISTS_NAV_KEY      = 'noisling_artists_nav';
const HOME_QUICK_KEY       = 'noisling_home_quick';
const HOME_RECENT_KEY      = 'noisling_home_recent';
const HOME_ALBUMS_KEY      = 'noisling_home_albums';

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
const homeShowQuickPlay = ref(storedBool(HOME_QUICK_KEY));
const homeShowRecent    = ref(storedBool(HOME_RECENT_KEY));
const homeShowAlbums    = ref(storedBool(HOME_ALBUMS_KEY));

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
    } catch {
      // fall back to localStorage value already applied above
    }
  }

  async function setAccentColor(color) {
    if (!VALID_COLORS.includes(color)) return;
    accentColor.value = color;
    localStorage.setItem(STORAGE_KEY, color);
    try {
      await api.saveSettings({ accentColor: color });
    } catch {
      // silent — color is still applied locally
    }
  }

  async function setDensity(value) {
    if (value !== 'comfortable' && value !== 'compact') return;
    density.value = value;
    localStorage.setItem(DENSITY_KEY, value);
    try {
      await api.saveSettings({ density: value });
    } catch {
      // silent — density is still applied locally
    }
  }

  function setShowCoverArt(value) {
    showCoverArt.value = Boolean(value);
    localStorage.setItem(COVER_KEY, String(showCoverArt.value));
  }

  function setFontSize(value) {
    if (!VALID_FONT_SIZES.includes(value)) return;
    fontSize.value = value;
    localStorage.setItem(FONT_KEY, value);
    applyFontSize(value);
  }

  function setSongsColumn(key, value) {
    songsColumns.value = { ...songsColumns.value, [key]: Boolean(value) };
    localStorage.setItem(SONGS_COLS_KEY, JSON.stringify(songsColumns.value));
  }

  function setSongsSort(field, dir) {
    songsSort.value = { field, dir };
    localStorage.setItem(SONGS_SORT_KEY, JSON.stringify({ field, dir }));
  }

  function setLovedUseAccent(value) {
    lovedUseAccent.value = Boolean(value);
    localStorage.setItem(LOVED_ACCENT_KEY, String(lovedUseAccent.value));
  }

  function setShowArtistsNav(value) {
    showArtistsNav.value = Boolean(value);
    localStorage.setItem(ARTISTS_NAV_KEY, String(showArtistsNav.value));
  }

  function setHomeSection(ref, storageKey, value) {
    // Prevent hiding the last visible home section
    if (!value && homeVisibleCount.value <= 1) return;
    ref.value = Boolean(value);
    localStorage.setItem(storageKey, String(ref.value));
  }

  return {
    accentColor, accentRgb, accentDarkRgb, VALID_COLORS,
    density,
    showCoverArt,
    fontSize, VALID_FONT_SIZES,
    lovedUseAccent,
    songsColumns, songsSort,
    showArtistsNav,
    homeShowQuickPlay, homeShowRecent, homeShowAlbums, homeVisibleCount,
    loadTheme, setAccentColor, setDensity, setShowCoverArt, setFontSize,
    setLovedUseAccent,
    setSongsColumn, setSongsSort,
    setShowArtistsNav,
    setHomeSection: (key, value) => {
      if (key === 'quickPlay') setHomeSection(homeShowQuickPlay, HOME_QUICK_KEY, value);
      if (key === 'recent')    setHomeSection(homeShowRecent,    HOME_RECENT_KEY, value);
      if (key === 'albums')    setHomeSection(homeShowAlbums,    HOME_ALBUMS_KEY, value);
    },
  };
}
