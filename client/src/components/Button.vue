<script setup>
import { computed } from 'vue'
import { useTheme } from '../composables/useTheme.js'
import Spinner from './Spinner.vue'

defineProps({
  variant: { type: String, default: 'ghost' }, // 'ghost' | 'muted' | 'destructive' | 'accent'
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const { accentColor, accentRgb } = useTheme()

const ACCENT_RGB = {
  rose:    [244, 63,  94 ],
  amber:   [245, 158, 11 ],
  yellow:  [250, 204, 21 ],
  emerald: [16,  185, 129],
  teal:    [45,  212, 191],
  sky:     [14,  165, 233],
  indigo:  [99,  102, 241],
  violet:  [139, 92,  246],
  slate:   [148, 163, 184],
}

function luminance([r, g, b]) {
  const f = c => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

const accentTextColor = computed(() => {
  const rgb = ACCENT_RGB[accentColor.value]
  return rgb && luminance(rgb) > 0.179 ? '#0a0a0b' : '#ffffff'
})

const accentBg = computed(() => `rgb(${accentRgb.value})`)
</script>

<template>
  <button
    :disabled="disabled || loading"
    class="min-h-11 sm:min-h-10 text-sm rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.98]"
    :class="[
      size === 'sm' ? 'px-3.5 py-2 sm:min-h-10' : 'px-4 py-2.5',
      {
        'bg-zinc-800 hover:bg-zinc-700': variant === 'ghost',
        'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800': variant === 'muted',
        'bg-red-600 hover:bg-red-500 text-white': variant === 'destructive',
        'hover:brightness-90': variant === 'accent',
      }
    ]"
    :style="variant === 'accent' ? { backgroundColor: accentBg, color: accentTextColor } : undefined"
  >
    <Spinner v-if="loading" class="w-4 h-4" />
    <slot />
  </button>
</template>
