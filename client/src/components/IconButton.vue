<script setup>
import Icon from './Icon.vue'
defineProps({
  icon: { type: String, required: true },
  label: { type: String, required: true },
  disabled: { type: Boolean, default: false },
})
</script>

<template>
  <button
    :disabled="disabled"
    class="flex items-center gap-2 text-sm p-2 sm:px-4 sm:py-2 rounded-full sm:rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 transition-colors"
  >
    <Icon :path="icon" class="w-4 h-4" />
    <span class="hidden sm:inline">{{ label }}</span>
  </button>
</template>
