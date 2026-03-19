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
const VALID_FONT_SIZES = ['small', 'medium', 'large'];
const VALID_VIZ_MODES = ['pills', 'nucleus', 'butterchurn'];

const COLOR_RGB = {
  rose: [244, 63, 94],
  amber: [245, 158, 11],
  yellow: [250, 204, 21],
  emerald: [16, 185, 129],
  teal: [45, 212, 191],
  sky: [14, 165, 233],
  indigo: [99, 102, 241],
  violet: [139, 92, 246],
  slate: [148, 163, 184],
};

const COLOR_RGB_DARK = {
  rose: [190, 18, 60],
  amber: [180, 83, 9],
  yellow: [161, 98, 7],
  emerald: [4, 120, 87],
  teal: [15, 118, 110],
  sky: [3, 105, 161],
  indigo: [67, 56, 202],
  violet: [109, 40, 217],
  slate: [51, 65, 85],
};

const THEME_BG_RGB = {
  rose: [28, 10, 16],
  amber: [31, 18, 8],
  yellow: [33, 24, 10],
  emerald: [7, 24, 18],
  teal: [7, 23, 22],
  sky: [7, 18, 29],
  indigo: [12, 14, 31],
  violet: [18, 12, 31],
  slate: [15, 23, 42],
  none: [9, 9, 11],
};

const THEME_BG_DARK_RGB = {
  rose: [9, 4, 6],
  amber: [9, 5, 2],
  yellow: [9, 7, 2],
  emerald: [2, 8, 6],
  teal: [2, 8, 8],
  sky: [2, 6, 10],
  indigo: [4, 4, 12],
  violet: [6, 4, 12],
  slate: [9, 9, 11],
  none: [9, 9, 11],
};

const STORAGE_KEY = 'noisling_accent';
const THEME_KEY = 'noisling_theme';
const FONT_KEY = 'noisling_fontsize';
const TRACKS_SORT_KEY = 'noisling_tracks_sort';
const HOME_ALBUM_MODE_KEY = 'noisling_home_album_mode';
const WIDE_LAYOUT_KEY = 'noisling_wide_layout';
const MOTION_KEY = 'noisling_reduce_motion';
const VIZ_MODE_KEY = 'noisling_vizmode';
const RANDOMIZE_KEY = 'noisling_randomize';
const BUTTERCHURN_PRESET_MODE_KEY = 'noisling_butterchurn_preset_mode';
const BUTTERCHURN_PRESET_KEY = 'noisling_butterchurn_preset';

const DEFAULT_COLOR = 'violet';
const DEFAULT_THEME_COLOR = 'none';
const DEFAULT_SORT = { field: 'artist', dir: 'asc' };

function normalizeVizMode(value) {
  if (value === 'nebula') return 'pills';
  if (value === 'spiral' || value === 'orb') return 'nucleus';
  return value;
}

function applyFontSize(size) {
  const html = document.documentElement;
  html.classList.remove('font-small', 'font-large');
  if (size === 'small') html.classList.add('font-small');
  if (size === 'large') html.classList.add('font-large');
}

function applyReduceMotion(value) {
  document.documentElement.classList.toggle('reduce-motion', value);
}

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

const storedAccent = readStoredValue(STORAGE_KEY);
const accentColor = ref(VALID_COLORS.includes(storedAccent) ? storedAccent : DEFAULT_COLOR);

const storedTheme = readStoredValue(THEME_KEY);
const themeColor = ref(VALID_THEME_COLORS.includes(storedTheme) ? storedTheme : DEFAULT_THEME_COLOR);
applyThemeColor(themeColor.value);

const storedFont = readStoredValue(FONT_KEY);
const fontSize = ref(VALID_FONT_SIZES.includes(storedFont) ? storedFont : 'medium');
applyFontSize(fontSize.value);

const tracksSort = ref(readStoredJson(TRACKS_SORT_KEY, DEFAULT_SORT));
const wideLayout = ref(readStoredBool(WIDE_LAYOUT_KEY, false));
const reduceMotion = ref(readStoredBool(MOTION_KEY, false));
applyReduceMotion(reduceMotion.value);

const storedHomeAlbumMode = readStoredValue(HOME_ALBUM_MODE_KEY);
const homeAlbumsMode = ref(['recent', 'random', 'top'].includes(storedHomeAlbumMode) ? storedHomeAlbumMode : 'recent');

const storedViz = normalizeVizMode(readStoredValue(VIZ_MODE_KEY));
const vizMode = ref(VALID_VIZ_MODES.includes(storedViz) ? storedViz : 'pills');
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

export function useTheme() {
  const api = useApi();
  const { error: toastError } = useToast();

  const accentRgb = computed(() => COLOR_RGB[accentColor.value].join(', '));
  const accentDarkRgb = computed(() => COLOR_RGB_DARK[accentColor.value].join(', '));
  const themeBgRgb = computed(() => THEME_BG_RGB[themeColor.value].join(', '));
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
      if (VALID_FONT_SIZES.includes(data.fontSize)) {
        fontSize.value = data.fontSize;
        writeStoredValue(FONT_KEY, data.fontSize);
        applyFontSize(data.fontSize);
      }
      if (data.tracksSort && typeof data.tracksSort.field === 'string') {
        tracksSort.value = { field: data.tracksSort.field, dir: data.tracksSort.dir };
        writeStoredJson(TRACKS_SORT_KEY, tracksSort.value);
      }
      if (typeof data.wideLayout === 'boolean') {
        wideLayout.value = data.wideLayout;
        writeStoredBool(WIDE_LAYOUT_KEY, data.wideLayout);
      }
      if (typeof data.reduceMotion === 'boolean') {
        reduceMotion.value = data.reduceMotion;
        writeStoredBool(MOTION_KEY, data.reduceMotion);
        applyReduceMotion(data.reduceMotion);
      }
      if (['recent', 'random', 'top'].includes(data.homeAlbumsMode)) {
        homeAlbumsMode.value = data.homeAlbumsMode;
        writeStoredValue(HOME_ALBUM_MODE_KEY, data.homeAlbumsMode);
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

  async function applyStoredSetting({ current, previous, next, persist, body, message, apply }) {
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

  async function applyStoredObjectSetting({ current, previous, next, persist, body, message }) {
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

  async function setHomeAlbumsMode(value) {
    if (!['recent', 'random', 'top'].includes(value)) return;
    await applyStoredSetting({
      current: homeAlbumsMode,
      previous: homeAlbumsMode.value,
      next: value,
      persist: (nextValue) => writeStoredValue(HOME_ALBUM_MODE_KEY, nextValue),
      body: { homeAlbumsMode: value },
      message: 'Failed to save home album mode.',
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

  return {
    accentColor,
    accentRgb,
    accentDarkRgb,
    themeColor,
    themeBgRgb,
    themeBgDarkRgb,
    VALID_COLORS,
    VALID_THEME_COLORS,
    fontSize,
    VALID_FONT_SIZES,
    tracksSort,
    wideLayout,
    reduceMotion,
    homeAlbumsMode,
    vizMode,
    randomizeOnNewTrack,
    VALID_VIZ_MODES,
    butterchurnPresetMode,
    butterchurnPreset,
    BUTTERCHURN_PRESET_OPTIONS,
    VALID_BUTTERCHURN_PRESET_MODES,
    loadTheme,
    setAccentColor,
    setThemeColor,
    setFontSize,
    setTracksSort,
    setWideLayout,
    setReduceMotion,
    setHomeAlbumsMode,
    setVizMode,
    setRandomizeOnNewTrack,
    setButterchurnPresetMode,
    setButterchurnPreset,
  };
}
