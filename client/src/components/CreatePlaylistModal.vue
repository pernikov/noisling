<script setup>
import { ref } from 'vue';
import { useApi } from '../composables/useApi.js';
import BaseModal from './BaseModal.vue';
import Button from './Button.vue';
import FormInput from './FormInput.vue';

const props = defineProps({
  trackIds: { type: Array, default: null },
  playlist: { type: Object, default: null },
});
const emit = defineEmits(['close', 'created', 'renamed']);

const api = useApi();
const name = ref(props.playlist?.name ?? '');
const saving = ref(false);
const error = ref('');

const isRename = !!props.playlist;

async function save() {
  if (!name.value.trim()) {
    error.value = 'Name is required.';
    return;
  }
  saving.value = true;
  error.value = '';
  try {
    if (isRename) {
      if (name.value.trim() === props.playlist.name) {
        emit('close');
        return;
      }
      const updated = await api.updatePlaylist(props.playlist._id, { name: name.value.trim() });
      emit('renamed', updated);
    } else {
      const playlist = await api.createPlaylist({ name: name.value.trim() });
      if (props.trackIds?.length) {
        await api.updatePlaylist(playlist._id, { trackIds: props.trackIds });
      }
      emit('created', playlist);
    }
  } catch (err) {
    error.value = err.message || (isRename ? 'Failed to rename playlist.' : 'Failed to create playlist.');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <BaseModal :show="true" @close="emit('close')">
    <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-sm shadow-2xl">
      <h2 class="text-lg font-bold font-display mb-5">
        {{ isRename ? 'Rename playlist' : (trackIds?.length ? 'Save queue as playlist' : 'New playlist') }}
      </h2>

      <FormInput
        v-model="name"
        type="text"
        placeholder="Playlist name"
        class="w-full px-3 py-2.5"
        autofocus
        @keydown.enter="save"
      />

      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>

      <div class="flex justify-end gap-2 mt-5">
        <Button @click="emit('close')">Cancel</Button>
        <Button variant="accent" :loading="saving" @click="save">
          {{ isRename ? 'Save' : 'Create' }}
        </Button>
      </div>
    </div>
  </BaseModal>
</template>
