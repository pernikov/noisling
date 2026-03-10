<script setup>
import Spinner from './Spinner.vue';
defineProps({
  label: { type: String, default: 'Loading…' },
});
</script>

<template>
  <div class="px-5 py-4 text-sm text-zinc-500 flex items-center gap-2">
    <Spinner class="w-4 h-4 shrink-0" />
    {{ label }}
  </div>
</template>
