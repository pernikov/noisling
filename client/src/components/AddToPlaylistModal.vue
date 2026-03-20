<script setup>
import { computed, ref, onMounted, nextTick } from 'vue';
import { mdiPlus } from '@mdi/js';
import { useApi } from '../composables/useApi.js';
import { useTheme } from '../composables/useTheme.js';
import BaseModal from './BaseModal.vue';
import CoverArt from './CoverArt.vue';
import FormInput from './FormInput.vue';
import LoadingState from './LoadingState.vue';
import Icon from './Icon.vue';

const props = defineProps({
  track: { type: Object, required: true },
});
const emit = defineEmits(['close', 'added']);

const api = useApi();
const { accentColor } = useTheme();
const playlists = ref([]);
const loading = ref(true);
const adding = ref(null); // playlist._id currently being added

const creating = ref(false);
const newName = ref('');
const nameInput = ref(null);
const artistText = computed(() => {
  if (props.track.artist) return props.track.artist;
  if (Array.isArray(props.track.artists)) return props.track.artists.join(', ');
  return '';
});

onMounted(async () => {
  try {
    playlists.value = await api.getPlaylists();
  } catch { /* ignore */ }
  finally { loading.value = false; }
});

async function addTo(playlist) {
  adding.value = playlist._id;
  try {
    await api.addToPlaylist(playlist._id, [props.track._id]);
    emit('added', playlist.name);
    emit('close');
  } catch {
    emit('added', null); // signal failure
    emit('close');
  }
}

async function startCreating() {
  creating.value = true;
  await nextTick();
  nameInput.value?.focus();
}

async function confirmCreate() {
  const name = newName.value.trim();
  if (!name) return;
  try {
    const playlist = await api.createPlaylist({ name });
    await addTo(playlist);
  } catch {
    emit('added', null);
    emit('close');
  }
}
</script>

<template>
  <BaseModal :show="true" @close="emit('close')">
    <div class="bg-zinc-900 rounded-lg border border-zinc-800 w-full max-w-sm shadow-2xl">
      <!-- Header with track info -->
      <div class="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-zinc-800">
        <CoverArt
          :cover="track.cover"
          size="w-10 h-10"
          class="rounded shrink-0"
        />
        <div class="min-w-0">
          <p class="text-xs text-zinc-500 mb-0.5">Add to playlist</p>
          <p class="text-sm font-semibold truncate leading-tight">{{ track.title }}</p>
          <p v-if="artistText" class="text-xs text-zinc-500 truncate mt-0.5">{{ artistText }}</p>
        </div>
      </div>

      <div class="py-1 max-h-72 overflow-y-auto">
        <LoadingState v-if="loading" label="Loading playlists…" />
        <div v-else-if="playlists.length === 0" class="px-5 py-4 text-sm text-zinc-500 text-center">
          No playlists yet.
        </div>
        <button
          v-for="pl in playlists"
          :key="pl._id"
          class="flex items-center justify-between w-full px-5 py-3 text-sm hover:bg-zinc-800 transition-colors disabled:opacity-50"
          :disabled="adding !== null"
          @click="addTo(pl)"
        >
          <span class="truncate">{{ pl.name }}</span>
          <span class="text-xs text-zinc-500 shrink-0 ml-3">{{ pl.trackCount }} {{ pl.trackCount === 1 ? 'track' : 'tracks' }}</span>
        </button>
      </div>

      <div class="border-t border-zinc-800">
        <div v-if="creating" class="flex items-center gap-2 px-5 py-3">
          <FormInput
            ref="nameInput"
            v-model="newName"
            type="text"
            placeholder="Playlist name"
            class="flex-1 px-3.5 py-2.5"
            @keydown.enter="confirmCreate"
            @keydown.esc="creating = false"
          />
          <button
            :disabled="!newName.trim()"
            @click="confirmCreate"
            :class="`bg-${accentColor}-500 hover:bg-${accentColor}-400`"
            class="min-h-11 px-3.5 py-2 text-sm rounded-lg text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >Create</button>
          <button @click="creating = false" class="min-h-11 px-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors shrink-0">Cancel</button>
        </div>
        <button
          v-else
          @click="startCreating"
          class="flex min-h-12 items-center gap-3 w-full px-5 py-3 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors rounded-b-xl"
        >
          <Icon :path="mdiPlus" class="w-4 h-4 shrink-0" />
          New playlist
        </button>
      </div>
    </div>
  </BaseModal>
</template>
