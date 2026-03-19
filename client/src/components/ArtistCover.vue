<script setup>
import { ref, computed } from 'vue';
import { useApi } from '../composables/useApi.js';

const props = defineProps({
  covers: { type: Array, default: () => [] },
  size: { type: String, default: 'w-full aspect-square' },
  wrapperClass: { type: String, default: 'mb-3' },
});

const api = useApi();
const loadedSet = ref(new Set());

function onLoad(idx) {
  loadedSet.value = new Set(loadedSet.value).add(idx);
}

function isLoaded(idx) {
  return loadedSet.value.has(idx);
}

const layout = computed(() => {
  const c = Array.isArray(props.covers) ? props.covers.length : 0;
  if (c === 0) return 'empty';
  if (c === 1) return 'single';
  if (c === 2) return 'split';
  if (c === 3) return 'trio';
  return 'quad';
});

const displayCovers = computed(() => Array.isArray(props.covers) ? props.covers.slice(0, 4) : []);
</script>

<template>
  <div :class="[props.size, 'rounded overflow-hidden bg-zinc-800 relative', props.wrapperClass]">
    <!-- No covers -->
    <img
      v-if="layout === 'empty'"
      src="/placeholder.svg"
      class="w-full h-full object-cover"
      alt="Cover"
    />

    <!-- Single cover -->
    <img
      v-else-if="layout === 'single'"
      :src="api.coverUrl(displayCovers[0])"
      :class="['w-full h-full object-cover transition-opacity duration-300', isLoaded(0) ? 'opacity-100' : 'opacity-0']"
      alt="Cover"
      loading="lazy"
      @load="onLoad(0)"
    />

    <!-- 2 covers: vertical split -->
    <div v-else-if="layout === 'split'" class="flex w-full h-full">
      <img
        v-for="(cover, i) in displayCovers"
        :key="i"
        :src="api.coverUrl(cover)"
        :class="['w-1/2 h-full object-cover transition-opacity duration-300', isLoaded(i) ? 'opacity-100' : 'opacity-0']"
        alt="Cover"
        loading="lazy"
        @load="onLoad(i)"
      />
    </div>

    <!-- 3 covers: one large left, two stacked right -->
    <div v-else-if="layout === 'trio'" class="flex w-full h-full">
      <img
        :src="api.coverUrl(displayCovers[0])"
        :class="['w-1/2 h-full object-cover transition-opacity duration-300', isLoaded(0) ? 'opacity-100' : 'opacity-0']"
        alt="Cover"
        loading="lazy"
        @load="onLoad(0)"
      />
      <div class="w-1/2 h-full flex flex-col">
        <img
          v-for="(cover, i) in displayCovers.slice(1)"
          :key="i + 1"
          :src="api.coverUrl(cover)"
          :class="['w-full h-1/2 object-cover transition-opacity duration-300', isLoaded(i + 1) ? 'opacity-100' : 'opacity-0']"
          alt="Cover"
          loading="lazy"
          @load="onLoad(i + 1)"
        />
      </div>
    </div>

    <!-- 4+ covers: 2x2 grid -->
    <div v-else class="grid grid-cols-2 grid-rows-2 w-full h-full">
      <img
        v-for="(cover, i) in displayCovers"
        :key="i"
        :src="api.coverUrl(cover)"
        :class="['w-full h-full object-cover transition-opacity duration-300', isLoaded(i) ? 'opacity-100' : 'opacity-0']"
        alt="Cover"
        loading="lazy"
        @load="onLoad(i)"
      />
    </div>
  </div>
</template>
