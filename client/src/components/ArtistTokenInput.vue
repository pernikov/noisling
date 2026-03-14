<script setup>
import { computed, ref, watch } from 'vue';
import { mdiClose } from '@mdi/js';
import Icon from './Icon.vue';
import { useTheme } from '../composables/useTheme.js';

const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  disabled: { type: Boolean, default: false },
  placeholder: { type: String, default: 'Add artist' },
});

const emit = defineEmits(['update:modelValue']);
const { accentRgb } = useTheme();

const draft = ref('');
const inputRef = ref(null);
const artists = computed(() => Array.isArray(props.modelValue) ? props.modelValue : []);
const tokenStyle = computed(() => ({
  backgroundColor: `rgba(${accentRgb.value}, 0.14)`,
  borderColor: `rgba(${accentRgb.value}, 0.28)`,
  boxShadow: `inset 0 0 0 1px rgba(${accentRgb.value}, 0.12)`,
}));
const tokenIconStyle = computed(() => ({
  color: `rgba(${accentRgb.value}, 0.78)`,
  backgroundColor: `rgba(${accentRgb.value}, 0.22)`,
}));

watch(() => props.modelValue, () => {
  if (props.disabled) return;
}, { deep: true });

function update(nextArtists) {
  emit('update:modelValue', Array.from(new Set(nextArtists.map((artist) => artist.trim()).filter(Boolean))));
}

function commitDraft() {
  const value = draft.value.trim();
  if (!value) return;
  update([...artists.value, value]);
  draft.value = '';
}

function removeArtist(index) {
  update(artists.value.filter((_, i) => i !== index));
  requestAnimationFrame(() => inputRef.value?.focus());
}

function onKeydown(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    commitDraft();
    return;
  }

  if (event.key === 'Backspace' && !draft.value && artists.value.length) {
    event.preventDefault();
    removeArtist(artists.value.length - 1);
  }
}

function onPaste(event) {
  const text = event.clipboardData?.getData('text');
  if (!text) return;

  const parts = text
    .split(/[\n;,]/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return;

  event.preventDefault();
  update([...artists.value, ...parts]);
  draft.value = '';
}
</script>

<template>
  <div class="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 min-h-[40px] focus-within:border-zinc-500">
    <div class="flex flex-wrap items-center gap-1.5 min-h-[24px]">
      <span
        v-for="(artist, index) in artists"
        :key="`${artist}-${index}`"
        class="inline-flex items-center gap-1 rounded-full border pl-3 pr-1.5 py-1 text-xs font-medium text-zinc-100 transition-colors"
        :style="tokenStyle"
      >
        <span>{{ artist }}</span>
        <button
          type="button"
          class="flex items-center justify-center w-4 h-4 rounded-full text-zinc-100/90 transition-all hover:brightness-110 hover:scale-105 active:scale-95"
          :style="tokenIconStyle"
          :disabled="disabled"
          @click="removeArtist(index)"
        >
          <Icon :path="mdiClose" class="w-3 h-3" />
        </button>
      </span>

      <input
        ref="inputRef"
        v-model="draft"
        type="text"
        class="min-w-[8rem] flex-1 h-6 bg-transparent text-sm leading-6 text-zinc-100 placeholder-zinc-500 focus:outline-none"
        :placeholder="artists.length ? placeholder : 'Type an artist and press Enter'"
        :disabled="disabled"
        @keydown="onKeydown"
        @blur="commitDraft"
        @paste="onPaste"
      >
    </div>
  </div>
</template>
