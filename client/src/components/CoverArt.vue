<script setup>
import { ref } from 'vue';
import { useApi } from '../composables/useApi.js';
import Spinner from './Spinner.vue';

const props = defineProps({
  cover: { type: String, default: '' },
  size: { type: String, default: 'w-12 h-12' },
  showSpinner: { type: Boolean, default: false },
});

const api = useApi();
const loaded = ref(false);

function onLoad() {
  loaded.value = true;
}
</script>

<template>
  <div :class="[props.size, 'relative rounded overflow-hidden flex-shrink-0 bg-zinc-800']">
    <!-- Spinner while loading -->
    <div
      v-if="props.showSpinner && props.cover && !loaded"
      class="absolute inset-0 flex items-center justify-center"
    >
      <Spinner class="w-4 h-4 text-white/60" />
    </div>
    <!-- Music note when no cover -->
    <div
      v-if="!props.cover"
      class="absolute inset-0 flex items-center justify-center"
    >
      <svg class="w-1/2 h-1/2 text-zinc-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
    </div>
    <img
      v-if="props.cover"
      :src="api.coverUrl(props.cover)"
      class="w-full h-full object-cover transition-opacity duration-300"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      alt="Cover"
      loading="eager"
      @load="onLoad"
    />
  </div>
</template>
