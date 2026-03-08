<script setup>
import BaseModal from './BaseModal.vue';

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
  <BaseModal :show="open" @close="$emit('cancel')">
    <div class="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-w-sm w-full mx-4 p-5">
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
  </BaseModal>
</template>
