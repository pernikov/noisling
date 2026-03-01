<script setup>
import { ref, computed, watch, nextTick } from 'vue';
import { mdiClose, mdiPlay, mdiRepeatOnce } from '@mdi/js';
import Icon from './Icon.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import CoverArt from './CoverArt.vue';

const props = defineProps({
  open: Boolean,
});
const emit = defineEmits(['close']);

const { state, moveTrack, playFromQueue } = usePlayer();
const { accentColor, density, showCoverArt, songsColumns } = useTheme();

const ITEM_HEIGHT = computed(() => density.value === 'compact' ? 36 : 52);
const OVERSCAN = 10; // extra items rendered above/below viewport

const scrollContainer = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(0);

function onScroll(e) {
  scrollTop.value = e.target.scrollTop;
}

const totalHeight = computed(() => state.queue.length * ITEM_HEIGHT.value);

const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT.value) - OVERSCAN)
);

const endIndex = computed(() =>
  Math.min(
    state.queue.length,
    Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT.value) + OVERSCAN
  )
);

const visibleItems = computed(() =>
  state.queue.slice(startIndex.value, endIndex.value).map((track, i) => ({
    track,
    index: startIndex.value + i,
  }))
);

const offsetY = computed(() => startIndex.value * ITEM_HEIGHT.value);

// Scroll to current track when drawer opens + lock body scroll
watch(() => props.open, async (isOpen) => {
  document.body.style.overflow = isOpen ? 'hidden' : '';
  if (isOpen) {
    await nextTick();
    if (scrollContainer.value) {
      containerHeight.value = scrollContainer.value.clientHeight;
      // Scroll current track into view
      if (state.queueIndex >= 0) {
        const h = ITEM_HEIGHT.value;
        const targetScroll = state.queueIndex * h - containerHeight.value / 2 + h / 2;
        scrollContainer.value.scrollTop = Math.max(0, targetScroll);
      }
    }
  }
});

// Drag and drop
const dragIndex = ref(null);
const dragOverIndex = ref(null);
let ghostEl = null;

function onDragStart(e, index) {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', index);

  // Custom ghost: a styled card so the drag cursor carries a polished row preview
  const row = e.currentTarget;
  ghostEl = row.cloneNode(true);
  Object.assign(ghostEl.style, {
    position: 'fixed',
    top: '-9999px',
    left: '0',
    width: row.offsetWidth + 'px',
    height: row.offsetHeight + 'px',
    background: 'rgb(63 63 70 / 0.97)',
    border: '1px solid rgb(82 82 91 / 0.8)',
    borderRadius: '6px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    pointerEvents: 'none',
    overflow: 'hidden',
  });
  document.body.appendChild(ghostEl);
  e.dataTransfer.setDragImage(ghostEl, e.offsetX, e.offsetY);
  requestAnimationFrame(() => {
    if (ghostEl) { document.body.removeChild(ghostEl); ghostEl = null; }
  });
}

function onDragOver(e, index) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  dragOverIndex.value = index;
}

function onDragLeave() {
  dragOverIndex.value = null;
}

function onDrop(e, toIndex) {
  e.preventDefault();
  const fromIndex = dragIndex.value;
  if (fromIndex !== null && fromIndex !== toIndex) {
    moveTrack(fromIndex, toIndex);
  }
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
  if (ghostEl) { document.body.removeChild(ghostEl); ghostEl = null; }
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
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
        <h2 class="font-semibold">Queue <span class="text-zinc-500 text-sm font-normal">{{ state.queue.length }} tracks</span></h2>
        <button class="text-zinc-400 hover:text-zinc-100" @click="emit('close')">
          <Icon :path="mdiClose" class="w-5 h-5" />
        </button>
      </div>

      <!-- Virtual scrolling track list -->
      <div
        v-if="state.queue.length === 0"
        class="flex-1 flex items-center justify-center text-zinc-500 text-sm"
      >
        Queue is empty
      </div>

      <div
        v-else
        ref="scrollContainer"
        class="flex-1 min-h-0 overflow-y-auto"
        @scroll="onScroll"
      >
        <!-- Total height spacer -->
        <div :style="{ height: totalHeight + 'px', position: 'relative' }">
          <!-- Positioned visible slice -->
          <div :style="{ transform: `translateY(${offsetY}px)` }">
            <div
              v-for="{ track, index: i } in visibleItems"
              :key="track._id + '-' + i"
              class="flex items-center gap-3 px-4 cursor-grab active:cursor-grabbing select-none transition-colors"
              :style="{ height: ITEM_HEIGHT + 'px' }"
              :class="{
                'bg-zinc-800/80': i === state.queueIndex,
                [`border-t-2 border-${accentColor}-400`]: dragOverIndex === i && dragIndex !== i,
                'opacity-40': dragIndex === i,
              }"
              draggable="true"
              @dragstart="onDragStart($event, i)"
              @dragover="onDragOver($event, i)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, i)"
              @dragend="onDragEnd"
            >
              <div v-if="showCoverArt" class="relative flex-shrink-0 group/cover" @click.stop="playFromQueue(i)">
                <CoverArt :cover="track.cover" :size="density === 'compact' ? 'w-6 h-6' : 'w-8 h-8'" />
                <div class="absolute inset-0 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer">
                  <Icon :path="mdiPlay" class="w-4 h-4 text-white" />
                </div>
              </div>

              <div class="flex-1 min-w-0">
                <div
                  class="text-sm truncate cursor-pointer hover:underline"
                  :class="i === state.queueIndex ? `text-${accentColor}-400 font-medium` : ''"
                  @click.stop="playFromQueue(i)"
                >
                  {{ track.title }}
                </div>
                <span v-if="density !== 'compact' && songsColumns.artist" class="text-xs text-zinc-500 truncate block">
                  <template v-for="(artist, ai) in track.artists" :key="ai">
                    <span v-if="ai > 0">, </span>
                    <router-link
                      :to="{ name: 'artist', params: { name: artist } }"
                      class="hover:text-zinc-100 hover:underline"
                      @click="emit('close')"
                    >{{ artist }}</router-link>
                  </template>
                </span>
              </div>

              <Icon
                v-if="i === state.queueIndex && state.repeat === 'one'"
                :path="mdiRepeatOnce"
                class="w-3.5 h-3.5 flex-shrink-0 animate-pulse"
                :class="`text-${accentColor}-400`"
              />
              <span class="text-xs text-zinc-500 flex-shrink-0">{{ formatDuration(track.duration) }}</span>
            </div>
          </div>
        </div>
      </div>
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
