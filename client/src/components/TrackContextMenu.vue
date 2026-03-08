<script setup>
import { ref } from 'vue';
import { mdiPlaylistPlay, mdiPlaylistPlus, mdiPlaylistMinus } from '@mdi/js';
import Icon from './Icon.vue';
import AddToPlaylistModal from './AddToPlaylistModal.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';

const props = defineProps({
  track: { type: Object, default: null },
  style: { type: Object, default: () => ({}) },
  playlistId: { type: String, default: null },
  showBackdrop: { type: Boolean, default: false },
});

const emit = defineEmits(['close', 'cancel-close', 'toast', 'remove-from-playlist']);

const { playNext, addToQueue } = usePlayer();
const { showPlaylists } = useTheme();

const addToPlaylistTrack = ref(null);

function onPlayNext() {
  playNext(props.track);
  emit('toast', 'Playing next');
  emit('close');
}

function onAddToQueue() {
  addToQueue(props.track);
  emit('toast', 'Added to queue');
  emit('close');
}

function openAddToPlaylist() {
  addToPlaylistTrack.value = props.track;
  emit('close');
}

function onPlaylistAdded(playlistName) {
  if (playlistName) emit('toast', `Added to "${playlistName}"`);
  else emit('toast', 'Failed to add to playlist');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="track && showBackdrop" class="fixed inset-0 z-40" @click="emit('close')" />
    <Transition name="menu">
      <div
        v-if="track"
        class="fixed z-50 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl py-1 min-w-[160px]"
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
          v-if="showPlaylists"
          class="flex items-center gap-2.5 w-full px-3 py-2 text-sm hover:bg-zinc-800 transition-colors"
          @click="openAddToPlaylist"
        >
          <Icon :path="mdiPlaylistPlus" class="w-4 h-4 text-zinc-400" />
          Add to playlist
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
  </Teleport>
</template>

<style scoped>
.menu-enter-active, .menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
  transform-origin: top left;
}
.menu-enter-from, .menu-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
