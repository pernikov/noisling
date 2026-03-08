<script setup>
defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, default: 'Are you sure?' },
  message: { type: String, default: '' },
  confirmLabel: { type: String, default: 'Confirm' },
  cancelLabel: { type: String, default: 'Cancel' },
  destructive: { type: Boolean, default: false },
});

defineEmits(['confirm', 'cancel']);
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm">
      <div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm" @click.self="$emit('cancel')">
        <div class="confirm-card bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-sm w-full mx-4 p-5">
          <h3 class="text-lg font-semibold mb-2">{{ title }}</h3>
          <p class="text-sm text-zinc-400 mb-5">{{ message }}</p>
          <div class="flex justify-end gap-3">
            <button
              @click="$emit('cancel')"
              class="text-sm px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              {{ cancelLabel }}
            </button>
            <button
              @click="$emit('confirm')"
              class="text-sm px-4 py-2 rounded transition-colors"
              :class="destructive
                ? 'bg-red-600 hover:bg-red-500'
                : 'bg-zinc-100 text-zinc-900 hover:bg-white'"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* Not scoped — descendant selectors on teleported content require global scope. */
.confirm-enter-active,
.confirm-leave-active {
  transition: opacity 0.2s ease;
}
.confirm-enter-active .confirm-card,
.confirm-leave-active .confirm-card {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.confirm-enter-from,
.confirm-leave-to {
  opacity: 0;
}
.confirm-enter-from .confirm-card,
.confirm-leave-to .confirm-card {
  opacity: 0;
  transform: scale(0.96) translateY(6px);
}
</style>
