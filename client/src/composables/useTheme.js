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

const STORAGE_KEY = 'noisling_accent';
const DEFAULT_COLOR = 'violet';

// Module-level singleton — reads from localStorage immediately so there's no
// flash of the wrong color before the API call returns.
const stored = localStorage.getItem(STORAGE_KEY);
const accentColor = ref(VALID_COLORS.includes(stored) ? stored : DEFAULT_COLOR);

export function useTheme() {
  const api = useApi();

  const accentRgb = computed(() => COLOR_RGB[accentColor.value].join(', '));

  async function loadTheme() {
    try {
      const data = await api.getSettings();
      if (VALID_COLORS.includes(data.accentColor)) {
        accentColor.value = data.accentColor;
        localStorage.setItem(STORAGE_KEY, data.accentColor);
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

  return { accentColor, accentRgb, VALID_COLORS, loadTheme, setAccentColor };
}
