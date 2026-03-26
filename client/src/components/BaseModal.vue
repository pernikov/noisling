<script setup>
import { watch, onUnmounted } from 'vue';

const props = defineProps({
  show: { type: Boolean, required: true },
  align: { type: String, default: 'center' }, // 'center' | 'top'
  mobileFullScreen: { type: Boolean, default: false },
});

const emit = defineEmits(['close']);

function onKeydown(e) {
  if (e.key === 'Escape') emit('close');
}

watch(() => props.show, (val) => {
  if (val) document.addEventListener('keydown', onKeydown);
  else document.removeEventListener('keydown', onKeydown);
}, { immediate: true });

onUnmounted(() => document.removeEventListener('keydown', onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" appear>
      <div
        v-if="show"
        class="fixed inset-0 z-[80] flex overflow-y-auto overscroll-contain bg-zinc-950/80 backdrop-blur-sm"
        :class="[
          props.mobileFullScreen ? 'px-0 sm:px-4' : 'px-4',
          align === 'top'
            ? props.mobileFullScreen
              ? 'items-start justify-center pt-0 pb-0 sm:pt-[calc(env(safe-area-inset-top)+4rem)] sm:pb-[calc(env(safe-area-inset-bottom)+1rem)]'
              : 'items-start justify-center pt-[calc(env(safe-area-inset-top)+4rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]'
            : 'items-center justify-center py-[calc(env(safe-area-inset-top)+1rem)]',
        ]"
        @click.self="$emit('close')"
      >
        <div
          class="modal-content w-full shrink-0 flex justify-center"
          :class="{ 'modal-content--top': align === 'top' }"
          @click.self="$emit('close')"
        >
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* Not scoped — descendant selectors on teleported content require global scope. */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}
.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}
.modal-enter-from .modal-content--top,
.modal-leave-to .modal-content--top {
  transform: scale(0.97) translateY(-6px);
}
</style>
