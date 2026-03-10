<script setup>
import { mdiClose } from '@mdi/js';
import Icon from './Icon.vue';
</script>

<template>
  <button class="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-800">
    <Icon :path="mdiClose" class="w-4 h-4" />
  </button>
</template>
