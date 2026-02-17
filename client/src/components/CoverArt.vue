<script setup>
import { ref } from 'vue';
import { useApi } from '../composables/useApi.js';

const props = defineProps({
  cover: { type: String, default: '' },
  size: { type: String, default: 'w-12 h-12' },
});

const api = useApi();
const loaded = ref(false);

function onLoad() {
  loaded.value = true;
}
</script>

<template>
  <img
    :src="api.coverUrl(props.cover)"
    :class="[props.size, 'rounded object-cover bg-zinc-800 flex-shrink-0 transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0']"
    alt="Cover"
    loading="lazy"
    @load="onLoad"
  />
</template>
