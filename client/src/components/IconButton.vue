<script setup>
import Icon from './Icon.vue'
import Spinner from './Spinner.vue'
defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  variant: { type: String, default: 'default' }, // 'default' | 'destructive'
})
</script>

<template>
  <button
    :disabled="disabled"
    class="flex items-center gap-2 text-sm p-2 sm:px-4 sm:py-2 rounded-lg sm:rounded-lg disabled:opacity-40 transition-all active:scale-95"
    :class="variant === 'destructive'
      ? 'bg-red-600/10 text-red-400 hover:bg-red-600/20'
      : 'bg-zinc-800 hover:bg-zinc-700 ring-1 ring-zinc-700/60 sm:ring-0'"
  >
    <Spinner v-if="loading" class="w-4 h-4" />
    <Icon v-else :path="icon" class="w-4 h-4" />
    <span class="hidden sm:inline">{{ label }}</span>
  </button>
</template>
