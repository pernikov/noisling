<script setup>
import { ref } from 'vue';
import { mdiPlaylistPlay, mdiPlaylistPlus, mdiPlaylistMinus, mdiPencil } from '@mdi/js';
import Icon from './Icon.vue';
import AddToPlaylistModal from './AddToPlaylistModal.vue';
import EditTrackMetadataModal from './EditTrackMetadataModal.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useToast } from '../composables/useToast.js';

const props = defineProps({
  track: { type: Object, default: null },
  style: { type: Object, default: () => ({}) },
  playlistId: { type: String, default: null },
  showBackdrop: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'cancel-close', 'remove-from-playlist', 'track-updated']);

const { playNext, addToQueue } = usePlayer();
const { show: showToast } = useToast();

const addToPlaylistTrack = ref(null);
const editTrack = ref(null);

function onPlayNext() {
  playNext(props.track);
  showToast('Playing next');
  emit('close');
}

function onAddToQueue() {
  addToQueue(props.track);
  showToast('Added to queue');
  emit('close');
}

function openAddToPlaylist() {
  addToPlaylistTrack.value = props.track;
  emit('close');
}

function onPlaylistAdded(playlistName) {
  if (playlistName) showToast(`Added to "${playlistName}"`);
  else showToast('Failed to add to playlist');
}

function openEditMetadata() {
  editTrack.value = props.track;
  emit('close');
}

function onTrackSaved(updatedTrack) {
  if (editTrack.value) Object.assign(editTrack.value, updatedTrack);
  showToast(updatedTrack.hasOverrides ? 'Metadata updated' : 'Metadata reverted');
  emit('track-updated', updatedTrack);
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="track"
      class="fixed inset-0 z-[90] bg-black/45 sm:bg-transparent"
      :class="showBackdrop ? '' : 'sm:hidden'"
      @click="emit('close')"
    />

    <Transition name="sheet">
      <div
        v-if="track"
        class="fixed inset-x-3 bottom-3 z-[95] rounded-2xl border border-zinc-800 bg-zinc-900/98 p-2 shadow-2xl backdrop-blur-xl sm:hidden"
      >
        <div class="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-700" />
        <button
          class="flex min-h-12 items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-zinc-800 transition-colors"
          @click="onPlayNext"
        >
          <Icon :path="mdiPlaylistPlay" class="w-4 h-4 text-zinc-400" />
          Play next
        </button>
        <button
          class="flex min-h-12 items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-zinc-800 transition-colors"
          @click="onAddToQueue"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to queue
        </button>
        <button
          class="flex min-h-12 items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-zinc-800 transition-colors"
          @click="openAddToPlaylist"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to playlist
        </button>
        <button
          class="flex min-h-12 items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm hover:bg-zinc-800 transition-colors"
          @click="openEditMetadata"
        >
          <Icon :path="mdiPencil" class="w-4 h-4 text-zinc-400" />
          Edit metadata
        </button>
        <button
          v-if="playlistId"
          class="flex min-h-12 items-center gap-3 w-full rounded-xl px-3 py-3 text-left text-sm text-red-400 hover:bg-zinc-800 transition-colors"
          @click="emit('remove-from-playlist', track._id); emit('close')"
        >
          <Icon :path="mdiPlaylistMinus" class="w-4 h-4" />
          Remove from playlist
        </button>
      </div>
    </Transition>

    <Transition name="menu">
      <div
        v-if="track"
        class="fixed z-[95] hidden min-w-[160px] rounded-md border border-zinc-700 bg-zinc-900 py-1 shadow-xl sm:block"
        :style="style"
        @mouseenter="emit('cancel-close')"
        @mouseleave="emit('close')"
      >
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="onPlayNext"
        >
          <Icon :path="mdiPlaylistPlay" class="w-4 h-4 text-zinc-400" />
          Play next
        </button>
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="onAddToQueue"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to queue
        </button>
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="openAddToPlaylist"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to playlist
        </button>
        <button
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="openEditMetadata"
        >
          <Icon :path="mdiPencil" class="w-4 h-4 text-zinc-400" />
          Edit metadata
        </button>
        <button
          v-if="playlistId"
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-800 transition-colors"
          @click="emit('remove-from-playlist', track._id); emit('close')"
        >
          <Icon :path="mdiPlaylistMinus" class="w-4 h-4" />
          Remove from playlist
        </button>
      </div>
    </Transition>

    <AddToPlaylistModal
      v-if="addToPlaylistTrack"
      :track="addToPlaylistTrack"
      @close="addToPlaylistTrack = null"
      @added="onPlaylistAdded"
    />

    <EditTrackMetadataModal
      v-if="editTrack"
      :track="editTrack"
      @close="editTrack = null"
      @saved="onTrackSaved"
    />
  </Teleport>
</template>

<style scoped>
.sheet-enter-active, .sheet-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.sheet-enter-from, .sheet-leave-to {
  opacity: 0;
  transform: translateY(16px);
}

.menu-enter-active, .menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top left;
}
.menu-enter-from, .menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
