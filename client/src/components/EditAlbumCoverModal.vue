<script setup>
import { computed, ref } from 'vue';
import BaseModal from './BaseModal.vue';
import Button from './Button.vue';
import ConfirmModal from './ConfirmModal.vue';
import CoverArt from './CoverArt.vue';
import { useApi } from '../composables/useApi.js';
import { useToast } from '../composables/useToast.js';

const props = defineProps({
  artist: { type: String, required: true },
  album: { type: String, required: true },
  cover: { type: String, default: '' },
  hasCustomCover: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'saved']);

const api = useApi();
const { show: showToast } = useToast();
const saving = ref(false);
const reverting = ref(false);
const error = ref('');
const previewDataUrl = ref('');
const selectedName = ref('');
const showConfirmRevert = ref(false);
const fileInput = ref(null);

const currentPreview = computed(() => previewDataUrl.value || props.cover);
const hasPreview = computed(() => !!currentPreview.value);
const canSave = computed(() => !!previewDataUrl.value);

function openPicker() {
  fileInput.value?.click();
}

function onFileChange(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    previewDataUrl.value = String(reader.result ?? '');
    selectedName.value = file.name;
    error.value = '';
  };
  reader.onerror = () => {
    error.value = 'Failed to read the selected image.';
  };
  reader.readAsDataURL(file);
}

async function save() {
  if (!previewDataUrl.value) {
    error.value = 'Choose an image first.';
    return;
  }

  saving.value = true;
  error.value = '';

  try {
    await api.updateAlbumCover(props.artist, props.album, { dataUrl: previewDataUrl.value });
    showToast('Artwork updated');
    emit('saved');
    emit('close');
  } catch (err) {
    error.value = err.message || 'Failed to save artwork.';
  } finally {
    saving.value = false;
  }
}

async function revert() {
  reverting.value = true;
  error.value = '';

  try {
    await api.clearAlbumCover(props.artist, props.album);
    showToast('Artwork reverted');
    emit('saved');
    emit('close');
  } catch (err) {
    error.value = err.message || 'Failed to revert artwork.';
  } finally {
    reverting.value = false;
  }
}
</script>

<template>
  <BaseModal :show="true" @close="emit('close')">
    <div class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 w-full max-w-md shadow-2xl">
      <div class="mb-4">
        <h2 class="text-lg font-bold font-display">Edit album artwork</h2>
        <p class="text-xs text-zinc-500 mt-1">Stored in Noisling only.</p>
      </div>

      <div class="mb-4">
        <button
          class="group relative mx-auto block w-full max-w-md aspect-square rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950/60 hover:border-zinc-700 transition-colors"
          :disabled="saving || reverting"
          @click="openPicker"
        >
          <CoverArt :cover="currentPreview" size="w-full h-full" />
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-colors flex items-end justify-center p-4">
            <div class="w-full rounded-xl bg-black/55 px-3 py-2 text-center text-xs text-zinc-200 opacity-90">
              {{ hasPreview ? 'Click to choose different artwork' : 'Click to choose artwork' }}
            </div>
          </div>
        </button>

        <input
          ref="fileInput"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff,image/avif"
          class="hidden"
          :disabled="saving || reverting"
          @change="onFileChange"
        >

        <div class="mt-3 text-center min-h-[1.25rem]">
          <p v-if="selectedName" class="text-xs text-zinc-500 truncate">{{ selectedName }}</p>
          <p v-else class="text-xs text-zinc-600">Square images work best.</p>
        </div>
      </div>

      <p v-if="error" class="mt-3 text-sm text-red-400">{{ error }}</p>

      <div class="flex items-center justify-between gap-2 mt-5">
        <Button
          v-if="hasCustomCover"
          variant="destructive"
          :loading="reverting"
          :disabled="saving"
          @click="showConfirmRevert = true"
        >
          Revert artwork
        </Button>
        <div v-else />
        <div class="flex justify-end gap-2">
          <Button :disabled="saving || reverting" @click="emit('close')">Cancel</Button>
          <Button variant="accent" :loading="saving" :disabled="reverting || !canSave" @click="save">Save artwork</Button>
        </div>
      </div>
    </div>
  </BaseModal>

  <ConfirmModal
    :open="showConfirmRevert"
    title="Revert custom artwork?"
    message="This will remove the local Noisling artwork override and fall back to scanned artwork for this album."
    confirm-label="Revert"
    destructive
    @confirm="showConfirmRevert = false; revert()"
    @cancel="showConfirmRevert = false"
  />
</template>
