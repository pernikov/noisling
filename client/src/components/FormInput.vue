<script setup>
defineProps({
  modelValue: { type: String, default: '' },
});
defineEmits(['update:modelValue']);
</script>

<!-- Base styling only; layout classes (w-full, flex-1, padding, etc.) are passed from parent via :class -->
<template>
  <input
    class="min-h-11 sm:min-h-0 bg-zinc-800 border border-zinc-700 rounded-lg text-sm focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
    :value="modelValue"
    @input="$emit('update:modelValue', $event.target.value)"
  />
</template>
