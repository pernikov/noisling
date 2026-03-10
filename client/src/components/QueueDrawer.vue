<script setup>
import { ref, nextTick, watch } from 'vue';
import { mdiClose } from '@mdi/js';
import Icon from './Icon.vue';
import QueueList from './QueueList.vue';
import SaveQueueButton from './SaveQueueButton.vue';
import { usePlayer } from '../composables/usePlayer.js';

const props = defineProps({
  open: Boolean,
});
const emit = defineEmits(['close']);

const { state } = usePlayer();
const queueList = ref(null);

watch(() => props.open, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) {
    await nextTick();
    queueList.value?.scrollToCurrent();
  }
});
</script>

<template>
  <!-- Backdrop -->
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/50 z-50"
      @click="emit('close')"
    />
  </Transition>

  <!-- Drawer -->
  <Transition name="slide">
    <div
      v-if="open"
      class="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-zinc-900 border-l border-zinc-800 z-50 flex flex-col"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h2 class="font-semibold">
          Queue
          <span class="text-zinc-500 text-sm font-normal">
            <template v-if="state.queueLoading">{{ state.queue.length }} / {{ state.queueTotal }}</template>
            <template v-else>{{ state.queue.length }} track{{ state.queue.length !== 1 ? 's' : '' }}</template>
          </span>
        </h2>
        <div class="flex items-center gap-1">
          <SaveQueueButton btn-class="text-zinc-400 hover:text-zinc-100" />
          <button class="text-zinc-400 hover:text-zinc-100" @click="emit('close')">
            <Icon :path="mdiClose" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <QueueList ref="queueList" @navigate="emit('close')" />
    </div>
  </Transition>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
  transition: transform 0.25s ease;
}
.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
}
</style>
