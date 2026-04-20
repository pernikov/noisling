<script setup>
import { ref, nextTick, watch } from 'vue';
import { mdiClose, mdiTrashCanOutline } from '@mdi/js';
import Icon from './Icon.vue';
import QueueList from './QueueList.vue';
import QueueActions from './QueueActions.vue';
import { usePlayer } from '../composables/usePlayer.js';

const props = defineProps({
  open: Boolean,
});
const emit = defineEmits(['close']);

const { state } = usePlayer();
const queueList = ref(null);
const queueDragState = ref({
  dragging: false,
  discardHovered: false,
  activeIndex: null,
});

function handleDragState(nextState) {
  queueDragState.value = {
    dragging: !!nextState?.dragging,
    discardHovered: !!nextState?.discardHovered,
    activeIndex: Number.isInteger(nextState?.activeIndex) ? nextState.activeIndex : null,
  };
}

function handleBackdropDragOver(e) {
  if (!queueDragState.value.dragging) return;
  e.preventDefault();
}

function handleBackdropDrop(e) {
  if (!queueDragState.value.dragging) return;
  e.preventDefault();
  queueList.value?.removeDraggedTrack?.();
}

watch(() => props.open, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (!isOpen) {
    queueDragState.value = { dragging: false, discardHovered: false, activeIndex: null };
  }
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
      class="fixed inset-0 z-50 transition-all duration-150"
      :class="[
        queueDragState.dragging ? 'backdrop-blur-md' : '',
        queueDragState.discardHovered ? 'bg-red-950/40' : 'bg-black/50',
      ]"
      @click="emit('close')"
      @dragover="handleBackdropDragOver"
      @drop="handleBackdropDrop"
    >
      <div
        v-if="queueDragState.dragging"
        class="pointer-events-none absolute inset-y-0 left-0 flex items-center justify-center px-6 sm:w-[calc(100%-24rem)] sm:translate-x-6 sm:px-10"
      >
        <div
          class="flex flex-col items-center text-center transition-all duration-150"
          :class="queueDragState.discardHovered ? 'scale-110 text-red-100' : 'text-zinc-100'"
        >
          <div
            class="flex h-20 w-20 items-center justify-center rounded-full transition-colors duration-150"
            :class="queueDragState.discardHovered ? 'bg-red-500/20' : 'bg-white/8'"
          >
            <Icon :path="mdiTrashCanOutline" class="h-10 w-10" />
          </div>
          <div class="mt-3 text-xs uppercase tracking-[0.22em]">
            {{ queueDragState.discardHovered ? 'Release to remove' : 'Drag here to remove' }}
          </div>
          <div
            class="mt-1 text-[11px]"
            :class="queueDragState.discardHovered ? 'text-red-100/80' : 'text-zinc-400'"
          >
            Remove from queue
          </div>
        </div>
      </div>
    </div>
  </Transition>

  <!-- Drawer -->
  <Transition name="slide">
    <div
      v-if="open"
      data-queue-drawer
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
        <div class="flex items-center gap-3">
          <QueueActions
            button-class="text-zinc-400 hover:text-zinc-100 rounded-md p-1.5 transition-colors"
            icon-class="w-5 h-5"
            :use-tooltips="true"
            tooltip-placement="bottom"
          />
          <button class="text-zinc-400 hover:text-zinc-100" @click="emit('close')">
            <Icon :path="mdiClose" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <QueueList
        ref="queueList"
        @navigate="emit('close')"
        @drag-state="handleDragState"
      />
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
