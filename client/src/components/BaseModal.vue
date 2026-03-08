<script setup>
import { watch, onUnmounted } from 'vue';

const props = defineProps({
  show: { type: Boolean, required: true },
  align: { type: String, default: 'center' }, // 'center' | 'top'
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
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex px-4 bg-zinc-950/80 backdrop-blur-sm"
        :class="align === 'top' ? 'items-start pt-16 justify-center' : 'items-center justify-center'"
        @click.self="$emit('close')"
      >
        <div class="modal-content w-full flex justify-center" :class="{ 'modal-content--top': align === 'top' }" @click.self="$emit('close')">
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
