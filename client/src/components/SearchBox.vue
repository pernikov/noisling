<script setup>
import { mdiMagnify } from '@mdi/js';
import Icon from './Icon.vue';
import FormInput from './FormInput.vue';

defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: 'Search…' },
});
defineEmits(['update:modelValue']);
</script>

<template>
  <div class="relative">
    <Icon :path="mdiMagnify" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
    <FormInput
      :modelValue="modelValue"
      type="text"
      :placeholder="placeholder"
      class="w-full pl-9 pr-3 py-2"
      @update:modelValue="$emit('update:modelValue', $event)"
    />
  </div>
</template>
