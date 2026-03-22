<script setup>
import { computed, ref, watch } from 'vue';
import BaseModal from './BaseModal.vue';
import Button from './Button.vue';
import ConfirmModal from './ConfirmModal.vue';
import ArtistTokenInput from './ArtistTokenInput.vue';
import FormInput from './FormInput.vue';
import { useApi } from '../composables/useApi.js';

const props = defineProps({
  track: { type: Object, required: true },
});

const emit = defineEmits(['close', 'saved']);

const api = useApi();
const loading = ref(false);
const saving = ref(false);
const reverting = ref(false);
const error = ref('');

const title = ref('');
const artists = ref([]);
const album = ref('');
const albumArtist = ref('');
const trackNumber = ref('');
const year = ref('');
const showConfirmRevert = ref(false);

const hasMetadataOverrides = computed(() =>
  ['title', 'artists', 'artistsNorm', 'albumArtist', 'album', 'trackNumber', 'year']
    .some((field) => props.track?.overrideFields?.includes(field)),
);

function fillForm(track) {
  title.value = track?.title ?? '';
  artists.value = Array.isArray(track?.artists) ? [...track.artists] : [];
  album.value = track?.album ?? '';
  albumArtist.value = track?.albumArtist ?? '';
  trackNumber.value = track?.trackNumber ? String(track.trackNumber) : '';
  year.value = track?.year ? String(track.year) : '';
}

watch(
  () => props.track,
  async (track) => {
    error.value = '';
    fillForm(track);

    if (!track?._id) return;

    loading.value = true;
    try {
      const fullTrack = await api.getTrack(track._id);
      Object.assign(track, fullTrack);
      fillForm(fullTrack);
    } catch (err) {
      error.value = err.message || 'Failed to load full metadata.';
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

async function save() {
  saving.value = true;
  error.value = '';

  try {
    const updated = await api.updateTrackOverrides(props.track._id, {
      title: title.value,
      artists: artists.value,
      album: album.value,
      albumArtist: albumArtist.value,
      trackNumber: trackNumber.value === '' ? 0 : Number(trackNumber.value),
      year: year.value === '' ? 0 : Number(year.value),
    });
    emit('saved', updated);
    emit('close');
  } catch (err) {
    error.value = err.message || 'Failed to save metadata.';
  } finally {
    saving.value = false;
  }
}

async function revert() {
  reverting.value = true;
  error.value = '';

  try {
    const updated = await api.clearTrackMetadataOverrides(props.track._id);
    emit('saved', updated);
    emit('close');
  } catch (err) {
    error.value = err.message || 'Failed to revert metadata.';
  } finally {
    reverting.value = false;
  }
}
</script>

<template>
  <BaseModal :show="true" @close="emit('close')">
    <div class="bg-zinc-900 rounded-lg border border-zinc-800 p-6 w-full max-w-lg shadow-2xl flex max-h-[calc(100svh-2rem)] sm:max-h-[calc(100svh-3rem)] flex-col overflow-hidden">
      <div class="flex items-start justify-between gap-4 mb-5 shrink-0">
        <div>
          <h2 class="text-lg font-bold font-display">Edit track metadata</h2>
          <p class="text-xs text-zinc-500 mt-1">Stored in Noisling only. Your audio files won't be changed.</p>
        </div>
        <span
          v-if="props.track?.hasOverrides"
          class="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300"
        >
          Edited
        </span>
      </div>

      <div class="space-y-3 flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">
        <div>
          <label class="block text-xs text-zinc-500 mb-1">Title</label>
          <FormInput v-model="title" type="text" class="w-full px-3.5 py-2.5" :disabled="loading || saving || reverting" autofocus />
        </div>
        <div>
          <label class="block text-xs text-zinc-500 mb-1">Artists</label>
          <ArtistTokenInput v-model="artists" :disabled="loading || saving || reverting" placeholder="Add another artist" />
          <p class="mt-1 text-xs text-zinc-600">Press Enter to add each artist.</p>
        </div>
        <div>
          <label class="block text-xs text-zinc-500 mb-1">Album</label>
          <FormInput v-model="album" type="text" class="w-full px-3.5 py-2.5" :disabled="loading || saving || reverting" />
        </div>
        <div>
          <label class="block text-xs text-zinc-500 mb-1">Album artist</label>
          <FormInput v-model="albumArtist" type="text" class="w-full px-3.5 py-2.5" :disabled="loading || saving || reverting" />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-zinc-500 mb-1">Track #</label>
            <FormInput v-model="trackNumber" type="number" min="0" class="w-full px-3.5 py-2.5" :disabled="loading || saving || reverting" />
          </div>
          <div>
            <label class="block text-xs text-zinc-500 mb-1">Year</label>
            <FormInput v-model="year" type="number" min="0" class="w-full px-3.5 py-2.5" :disabled="loading || saving || reverting" />
          </div>
        </div>
      </div>

      <p v-if="loading" class="mt-3 text-sm text-zinc-500 shrink-0">Loading full metadata...</p>
      <p v-if="error" class="mt-3 text-sm text-red-400 shrink-0">{{ error }}</p>

      <div class="flex items-center justify-between gap-2 mt-5 shrink-0">
        <Button
          v-if="hasMetadataOverrides"
          variant="destructive"
          :loading="reverting"
          :disabled="loading || saving"
          @click="showConfirmRevert = true"
        >
          Revert
        </Button>
        <div v-else />
        <div class="flex justify-end gap-2">
          <Button :disabled="saving || reverting" @click="emit('close')">Cancel</Button>
          <Button variant="accent" :loading="saving" :disabled="loading || reverting" @click="save">Save</Button>
        </div>
      </div>
    </div>
  </BaseModal>

  <ConfirmModal
    :open="showConfirmRevert"
    title="Revert metadata overrides?"
    message="This will remove local title, artist, album, track number, and year edits for this track. Artwork overrides will be kept."
    confirm-label="Revert"
    destructive
    @confirm="showConfirmRevert = false; revert()"
    @cancel="showConfirmRevert = false"
  />
</template>
