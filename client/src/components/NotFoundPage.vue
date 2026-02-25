<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useApi } from '../composables/useApi.js';
import { useTheme } from '../composables/useTheme.js';
import ArtistCover from './ArtistCover.vue';

const props = defineProps({
  type: { type: String, default: 'artist' }, // 'artist' | 'album'
  name: { type: String, default: '' },
});

const router = useRouter();
const api = useApi();
const { accentColor, accentRgb } = useTheme();

const suggestions = ref([]);

onMounted(async () => {
  try {
    suggestions.value = await api.getRandomArtists(6);
  } catch {}
});

const headline = computed(() => {
  if (props.type === 'album') return 'Record lost in the stacks';
  if (props.type === 'artist') return 'Artist has left the building';
  return 'This page is off the record';
});

const subtext = computed(() => {
  if (props.type === 'album') return 'The album may have been removed or renamed.';
  if (props.type === 'artist') return 'The artist may have been removed from your library.';
  return "The page you're looking for doesn't exist.";
});

const labelColor = computed(() => `rgb(${accentRgb.value})`);
const accentClass = computed(() => `text-${accentColor.value}-400`);
</script>

<template>
  <div class="flex flex-col items-center py-12 text-center">
    <!-- Spinning vinyl with skip glitch -->
    <div class="relative mb-10">
      <div class="vinyl">
        <svg viewBox="0 0 200 200" class="w-44 h-44 drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
          <!-- Main disc -->
          <circle cx="100" cy="100" r="95" fill="#18181b"/>
          <!-- Groove rings -->
          <circle cx="100" cy="100" r="88" fill="none" stroke="#27272a" stroke-width="0.8"/>
          <circle cx="100" cy="100" r="80" fill="none" stroke="#27272a" stroke-width="0.8"/>
          <circle cx="100" cy="100" r="72" fill="none" stroke="#27272a" stroke-width="0.8"/>
          <circle cx="100" cy="100" r="64" fill="none" stroke="#27272a" stroke-width="0.8"/>
          <circle cx="100" cy="100" r="56" fill="none" stroke="#27272a" stroke-width="0.8"/>
          <circle cx="100" cy="100" r="48" fill="none" stroke="#3f3f46" stroke-width="1.5"/>
          <!-- Center label -->
          <circle cx="100" cy="100" r="36" :fill="labelColor"/>
          <circle cx="100" cy="100" r="30" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
          <!-- Center hole -->
          <circle cx="100" cy="100" r="5" fill="#09090b"/>
          <!-- Scratch/crack -->
          <path
            d="M 92 12 L 96 50 L 110 66 L 116 92"
            fill="none" stroke="#09090b" stroke-width="3"
            stroke-linecap="round" stroke-linejoin="round" opacity="0.5"
          />
        </svg>
      </div>
      <!-- 404 badge -->
      <div
        class="absolute -bottom-3 -right-3 w-12 h-12 rounded-full flex items-center justify-center font-bold font-display text-sm bg-zinc-950 border-2"
        :style="{ borderColor: labelColor, color: labelColor }"
      >
        404
      </div>
    </div>

    <!-- Message -->
    <h1 class="text-2xl font-bold font-display mb-2" :class="accentClass">
      {{ headline }}
    </h1>
    <p v-if="name" class="text-zinc-400 mb-1">
      Couldn't find <span class="text-zinc-200 font-medium">{{ name }}</span> in your library.
    </p>
    <p class="text-zinc-600 text-sm mb-8">{{ subtext }}</p>

    <!-- Navigation buttons -->
    <div class="flex items-center gap-2 mb-14 flex-wrap justify-center">
      <button
        class="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
        @click="router.back()"
      >
        ← Go back
      </button>
      <router-link
        to="/artists"
        class="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
      >
        Browse Artists
      </router-link>
      <router-link
        to="/recent"
        class="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
      >
        Recent Plays
      </router-link>
    </div>

    <!-- Suggestions -->
    <div v-if="suggestions.length" class="w-full">
      <p class="text-xs uppercase tracking-widest text-zinc-600 mb-4">Maybe you'll vibe with</p>
      <div class="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <router-link
          v-for="artist in suggestions"
          :key="artist.name"
          :to="{ name: 'artist', params: { name: artist.name } }"
          class="rounded-lg p-2 hover:bg-zinc-900 transition-colors text-left"
        >
          <ArtistCover :covers="artist.covers" />
          <div class="text-sm font-medium truncate">{{ artist.name }}</div>
          <div class="text-xs text-zinc-500">{{ artist.albumCount }} album{{ artist.albumCount !== 1 ? 's' : '' }}</div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vinyl {
  animation: vinyl-skip 3s linear infinite;
  will-change: transform;
}

@keyframes vinyl-skip {
  0%   { transform: rotate(0deg); }
  80%  { transform: rotate(288deg); }
  83%  { transform: rotate(282deg); }
  86%  { transform: rotate(295deg); }
  100% { transform: rotate(360deg); }
}
</style>
