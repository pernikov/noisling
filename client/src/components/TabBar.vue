<script setup>
import Icon from './Icon.vue';

defineProps({
  tabs: { type: Array, required: true }, // [{ value, label, icon? }]
  modelValue: { type: String, required: true },
  full: { type: Boolean, default: false },
  size: { type: String, default: 'md' }, // 'md' | 'sm'
});

const emit = defineEmits(['update:modelValue']);
</script>

<template>
  <div
    class="p-1 border"
    :class="[
      full ? 'flex w-full' : 'inline-flex',
      size === 'sm'
        ? 'bg-zinc-800 rounded-lg border-zinc-700 gap-1'
        : 'bg-zinc-800/50 rounded-xl border-zinc-800',
    ]"
  >
    <button
      v-for="tab in tabs"
      :key="tab.value"
      @click="emit('update:modelValue', tab.value)"
      class="flex items-center justify-center gap-2 text-sm font-medium transition-all"
      :class="[
        size === 'sm' ? 'px-3 py-1.5 rounded-md' : (full ? 'flex-1 px-2 py-1.5 rounded-lg' : 'px-4 py-2 rounded-lg'),
        modelValue === tab.value ? 'bg-zinc-700 text-zinc-100 shadow-sm' : 'text-zinc-500 hover:text-zinc-300',
      ]"
    >
      <Icon v-if="tab.icon" :path="tab.icon" class="w-4 h-4" />
      {{ tab.label }}
    </button>
  </div>
</template>
