<script setup>
import BaseModal from './BaseModal.vue';
import Button from './Button.vue';

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
        <Button @click="$emit('cancel')">{{ cancelLabel }}</Button>
        <Button :variant="destructive ? 'destructive' : 'accent'" @click="$emit('confirm')">{{ confirmLabel }}</Button>
      </div>
    </div>
  </BaseModal>
</template>
