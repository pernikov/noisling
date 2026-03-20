<script setup>
import { computed } from 'vue'
import Icon from './Icon.vue'
import Spinner from './Spinner.vue'
import {
  CONTROL_BUTTON_BASE_CLASS,
  CONTROL_BUTTON_SIZE_CLASS,
  CONTROL_BUTTON_VARIANT_CLASS,
  CONTROL_ICON_ONLY_SIZE_CLASS,
  useAccentButtonStyle,
} from './buttonStyles.js'

const props = defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  variant: { type: String, default: 'ghost' }, // 'ghost' | 'muted' | 'destructive' | 'accent'
  size: { type: String, default: 'md' }, // 'sm' | 'md'
  hideLabelOnMobile: { type: Boolean, default: true },
  iconOnly: { type: Boolean, default: false },
})

const { accentStyle } = useAccentButtonStyle()

const buttonClass = computed(() => {
  const sizeClass = props.iconOnly
    ? (CONTROL_ICON_ONLY_SIZE_CLASS[props.size] ?? CONTROL_ICON_ONLY_SIZE_CLASS.md)
    : (CONTROL_BUTTON_SIZE_CLASS[props.size] ?? CONTROL_BUTTON_SIZE_CLASS.md)

  return [
    CONTROL_BUTTON_BASE_CLASS,
    sizeClass,
    props.iconOnly ? 'gap-0' : null,
    props.variant === 'accent'
      ? 'hover:brightness-95 shadow-sm'
      : (CONTROL_BUTTON_VARIANT_CLASS[props.variant] ?? CONTROL_BUTTON_VARIANT_CLASS.ghost),
  ]
})
</script>

<template>
  <button
    :disabled="disabled || loading"
    :class="buttonClass"
    :style="variant === 'accent' ? accentStyle : undefined"
    :aria-label="iconOnly ? label : undefined"
  >
    <Spinner v-if="loading" class="w-4 h-4" />
    <Icon v-else :path="icon" class="w-4 h-4" />
    <span v-if="!iconOnly" :class="hideLabelOnMobile ? 'hidden sm:inline' : ''">{{ label }}</span>
  </button>
</template>
