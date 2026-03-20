<script setup>
import { computed } from 'vue';
import Icon from './Icon.vue';
import Spinner from './Spinner.vue';
import {
  TRANSPORT_BUTTON_BASE_CLASS,
  TRANSPORT_BUTTON_SIZE_CLASS,
  TRANSPORT_BUTTON_VARIANT_CLASS,
  TRANSPORT_ICON_CLASS,
  useAccentButtonStyle,
} from './buttonStyles.js';

const props = defineProps({
  icon: { type: String, default: '' },
  label: { type: String, default: '' },
  variant: { type: String, default: 'subtle' }, // 'subtle' | 'solid' | 'accent'
  size: { type: String, default: 'md' }, // 'sm' | 'md' | 'lg'
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  activeClass: { type: String, default: '' },
  activeStyle: { type: Object, default: null },
});

const { accentStyle } = useAccentButtonStyle();

const buttonClass = computed(() => ([
  TRANSPORT_BUTTON_BASE_CLASS,
  TRANSPORT_BUTTON_SIZE_CLASS[props.size] ?? TRANSPORT_BUTTON_SIZE_CLASS.md,
  props.active
    ? (props.variant === 'bare' ? 'text-zinc-100' : 'text-zinc-100 bg-zinc-800/80')
    : null,
  props.variant === 'accent'
    ? 'hover:brightness-95'
    : (TRANSPORT_BUTTON_VARIANT_CLASS[props.variant] ?? TRANSPORT_BUTTON_VARIANT_CLASS.subtle),
  props.active ? props.activeClass : null,
]));

const iconClass = computed(() => TRANSPORT_ICON_CLASS[props.size] ?? TRANSPORT_ICON_CLASS.md);
</script>

<template>
  <button
    :disabled="disabled || loading"
    :class="buttonClass"
    :style="active && activeStyle ? activeStyle : (variant === 'accent' ? accentStyle : undefined)"
    :aria-label="label || undefined"
  >
    <Spinner v-if="loading" class="w-4 h-4" />
    <slot v-else name="icon">
      <Icon v-if="icon" :path="icon" :class="iconClass" />
    </slot>
  </button>
</template>
