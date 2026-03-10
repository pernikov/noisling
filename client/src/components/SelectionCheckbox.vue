<script setup>
import { mdiCheck } from '@mdi/js';
import Icon from './Icon.vue';

defineProps({ checked: Boolean });
defineEmits(['toggle']);
</script>

<template>
  <div
    class="w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors"
    :class="checked ? 'bg-white border-white' : 'border-zinc-600'"
  >
    <Icon v-if="checked" :path="mdiCheck" class="w-3 h-3 text-zinc-900" />
  </div>
</template>
