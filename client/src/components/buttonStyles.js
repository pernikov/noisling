import { computed } from 'vue';
import { useTheme } from '../composables/useTheme.js';

export const ACCENT_RGB = {
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

function luminance([r, g, b]) {
  const channel = (value) => {
    const normalized = value / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function useAccentButtonStyle() {
  const { accentColor, accentRgb } = useTheme();

  const accentTextColor = computed(() => {
    const rgb = ACCENT_RGB[accentColor.value];
    return rgb && luminance(rgb) > 0.179 ? '#0a0a0b' : '#ffffff';
  });

  const accentStyle = computed(() => ({
    backgroundColor: `rgb(${accentRgb.value})`,
    color: accentTextColor.value,
  }));

  return { accentStyle };
}

export const BUTTON_BASE_CLASS = 'inline-flex items-center justify-center gap-2 font-medium select-none outline-none disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:brightness-100 focus-visible:ring-2 focus-visible:ring-zinc-100/80 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 transition-[transform,background-color,color,box-shadow,filter,opacity] duration-150 active:scale-[0.98]';

export const CONTROL_BUTTON_BASE_CLASS = `${BUTTON_BASE_CLASS} rounded-lg`;

export const CONTROL_BUTTON_SIZE_CLASS = {
  sm: 'min-h-9 px-3.5 py-2 text-sm',
  md: 'min-h-11 px-4 py-2.5 text-sm',
};

export const CONTROL_BUTTON_VARIANT_CLASS = {
  ghost: 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 shadow-sm',
  muted: 'bg-transparent text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100',
  destructive: 'bg-red-600 text-white hover:bg-red-500 shadow-sm shadow-red-950/30',
};

export const CONTROL_ICON_ONLY_SIZE_CLASS = {
  sm: 'h-9 min-h-0 w-9 px-0',
  md: 'h-11 min-h-0 w-11 px-0',
};

export const TRANSPORT_BUTTON_BASE_CLASS = `${BUTTON_BASE_CLASS} rounded-full`;

export const TRANSPORT_BUTTON_SIZE_CLASS = {
  xs: 'h-7 min-h-0 w-7 text-sm',
  sm: 'h-9 min-h-0 w-9 text-sm',
  md: 'h-11 min-h-0 w-11 text-sm',
  lg: 'h-16 min-h-0 w-16 text-base shadow-lg',
};

export const TRANSPORT_BUTTON_VARIANT_CLASS = {
  bare: 'bg-transparent text-zinc-400 hover:text-zinc-100',
  subtle: 'bg-transparent text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100',
  solid: 'bg-zinc-100 text-zinc-900 hover:brightness-95 shadow-sm',
};

export const TRANSPORT_ICON_CLASS = {
  xs: 'h-4 w-4',
  sm: 'h-4 w-4',
  md: 'h-5 w-5',
  lg: 'h-8 w-8',
};
