<script setup>
import { computed } from 'vue'
import Spinner from './Spinner.vue'
import {
  CONTROL_BUTTON_BASE_CLASS,
  CONTROL_BUTTON_SIZE_CLASS,
  CONTROL_BUTTON_VARIANT_CLASS,
  useAccentButtonStyle,
} from './buttonStyles.js'

const props = defineProps({
  variant: { type: String, default: 'ghost' }, // 'ghost' | 'muted' | 'destructive' | 'accent'
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
})

const { accentStyle } = useAccentButtonStyle()

const buttonClass = computed(() => ([
  CONTROL_BUTTON_BASE_CLASS,
  CONTROL_BUTTON_SIZE_CLASS[props.size] ?? CONTROL_BUTTON_SIZE_CLASS.md,
  props.variant === 'accent'
    ? 'hover:brightness-95 shadow-sm'
    : (CONTROL_BUTTON_VARIANT_CLASS[props.variant] ?? CONTROL_BUTTON_VARIANT_CLASS.ghost),
]))
</script>

<template>
  <button
    :disabled="disabled || loading"
    :class="buttonClass"
    :style="variant === 'accent' ? accentStyle : undefined"
  >
    <Spinner v-if="loading" class="w-4 h-4" />
    <slot />
  </button>
</template>
