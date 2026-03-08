<script setup>
import { ref } from 'vue';
import { useApi } from '../composables/useApi.js';
import { useTheme } from '../composables/useTheme.js';
import BaseModal from './BaseModal.vue';
import Spinner from './Spinner.vue';

const emit = defineEmits(['close', 'created']);

const api = useApi();
const { accentRgb } = useTheme();
const name = ref('');
const saving = ref(false);
const error = ref('');

async function save() {
  if (!name.value.trim()) {
    error.value = 'Name is required.';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    const playlist = await api.createPlaylist({ name: name.value.trim() });
    emit('created', playlist);
  } catch (err) {
    error.value = err.message || 'Failed to create playlist.';
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :show="true" @close="emit('close')">
    <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
      <h2 class="text-lg font-bold font-display mb-5">New playlist</h2>

      <input
        v-model="name"
        type="text"
        placeholder="Playlist name"
        class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-zinc-500"
        autofocus
        @keydown.enter="save"
      />

      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>

      <div class="flex justify-end gap-2 mt-5">
        <button
          @click="emit('close')"
          class="px-4 py-2 text-sm rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >Cancel</button>
        <button
          @click="save"
          :disabled="saving"
          class="px-4 py-2 text-sm rounded-lg disabled:opacity-50 transition-opacity flex items-center gap-2"
          :style="{ backgroundColor: `rgb(${accentRgb})` }"
        >
          <Spinner v-if="saving" class="w-4 h-4" />
          Create
        </button>
      </div>
    </div>
  </BaseModal>
</template>
