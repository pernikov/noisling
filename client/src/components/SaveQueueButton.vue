<script setup>
import { ref, computed } from 'vue';
import { mdiPlaylistPlus } from '@mdi/js';
import Icon from './Icon.vue';
import CreatePlaylistModal from './CreatePlaylistModal.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useToast } from '../composables/useToast.js';

defineProps({
  iconClass: { type: String, default: 'w-5 h-5' },
  btnClass:  { type: String, default: '' },
});

const { state } = usePlayer();
const { show: showToast } = useToast();

const showModal = ref(false);

const queueTrackIds = computed(() => {
  if (state.isLargeQueue) return state.largeQueueIds;
  return state.queue.map(t => t._id);
});

function onCreated() {
  showModal.value = false;
  showToast('Queue saved as playlist');
}
</script>

<template>
  <button
    v-if="queueTrackIds.length"
    :class="btnClass"
    title="Save queue as playlist"
    aria-label="Save queue as playlist"
    @click="showModal = true"
  >
    <Icon :path="mdiPlaylistPlus" :class="iconClass" />
  </button>

  <CreatePlaylistModal
    v-if="showModal"
    :track-ids="queueTrackIds"
    @close="showModal = false"
    @created="onCreated"
  />
</template>
