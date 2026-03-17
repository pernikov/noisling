<script setup>
import { computed } from 'vue';
import { mdiPlaylistRemove } from '@mdi/js';
import Icon from './Icon.vue';
import SaveQueueButton from './SaveQueueButton.vue';
import Tooltip from './Tooltip.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useToast } from '../composables/useToast.js';

const props = defineProps({
  buttonClass: { type: String, default: '' },
  iconClass: { type: String, default: 'w-5 h-5' },
  showLabels: { type: Boolean, default: false },
  useTooltips: { type: Boolean, default: false },
  tooltipPlacement: { type: String, default: 'top' },
});

const { state, keepCurrentOnly } = usePlayer();
const { show: showToast } = useToast();

const queueCount = computed(() => {
  if (state.isLargeQueue) {
    return Math.max(state.queue.length, state.queueTotal || 0);
  }
  return state.queue.length;
});

const canKeepCurrentOnly = computed(() => !!state.currentTrack && queueCount.value > 1);

function onKeepCurrentOnly() {
  if (!canKeepCurrentOnly.value) return;
  keepCurrentOnly();
  showToast('Kept current track only');
}
</script>

<template>
  <div class="flex items-center gap-1.5">
    <Tooltip v-if="props.useTooltips" label="Save queue as playlist" :placement="props.tooltipPlacement">
      <SaveQueueButton
        :btn-class="buttonClass"
        :icon-class="iconClass"
        :show-title="false"
      />
    </Tooltip>
    <SaveQueueButton
      v-else
      :btn-class="buttonClass"
      :icon-class="iconClass"
    />

    <Tooltip
      v-if="props.useTooltips && canKeepCurrentOnly"
      label="Keep current track only"
      :placement="props.tooltipPlacement"
    >
      <button
        :class="buttonClass"
        aria-label="Clear queue except current track"
        @click="onKeepCurrentOnly"
      >
        <span class="flex items-center gap-2">
          <Icon :path="mdiPlaylistRemove" :class="iconClass" />
          <span v-if="showLabels" class="text-sm">Keep current track only</span>
        </span>
      </button>
    </Tooltip>
    <button
      v-else-if="canKeepCurrentOnly"
      :class="buttonClass"
      aria-label="Clear queue except current track"
      @click="onKeepCurrentOnly"
    >
      <span class="flex items-center gap-2">
        <Icon :path="mdiPlaylistRemove" :class="iconClass" />
        <span v-if="showLabels" class="text-sm">Keep current track only</span>
      </span>
    </button>
  </div>
</template>
