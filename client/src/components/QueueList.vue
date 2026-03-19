<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { mdiPlay, mdiRepeatOnce, mdiDragVertical } from '@mdi/js';
import Icon from './Icon.vue';
import CoverArt from './CoverArt.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';

const props = defineProps({
  // Row horizontal padding — 'px-4' for QueueDrawer, 'px-3' for modal
  rowPaddingClass: {
    type: String,
    default: 'px-4',
  },
  roomyMobile: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['play', 'navigate']);

const { state, moveTrack, playFromQueue } = usePlayer();
const { accentColor, density, showCoverArt, tracksColumns } = useTheme();
const isMobile = ref(false);
let mediaQuery = null;
let mediaQueryListener = null;

// --- Virtual scrolling ---
const ITEM_HEIGHT = computed(() => {
  if (props.roomyMobile && isMobile.value) return density.value === 'compact' ? 52 : 64;
  return density.value === 'compact' ? 36 : 52;
});
const OVERSCAN = 10;
const scrollContainer = ref(null);
const scrollTop = ref(0);
const containerHeight = ref(0);

function onScroll(e) {
  scrollTop.value = e.target.scrollTop;
  containerHeight.value = e.target.clientHeight;
}

const atTop = computed(() => scrollTop.value <= 0);
const atBottom = computed(() => scrollTop.value + containerHeight.value >= totalHeight.value - 1);

const scrollMask = computed(() => {
  if (atTop.value && atBottom.value) return 'none';
  if (atTop.value) return 'linear-gradient(to bottom, black 0%, black calc(100% - 1.5rem), transparent 100%)';
  if (atBottom.value) return 'linear-gradient(to bottom, transparent 0%, black 1.5rem, black 100%)';
  return 'linear-gradient(to bottom, transparent 0%, black 1.5rem, black calc(100% - 1.5rem), transparent 100%)';
});

onMounted(() => {
  mediaQuery = window.matchMedia('(max-width: 639px)');
  mediaQueryListener = () => { isMobile.value = mediaQuery.matches; };
  mediaQueryListener();
  if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', mediaQueryListener);
  else mediaQuery.addListener(mediaQueryListener);

  if (scrollContainer.value) {
    containerHeight.value = scrollContainer.value.clientHeight;
  }
});

const totalHeight = computed(() => state.queue.length * ITEM_HEIGHT.value);
const startIndex = computed(() =>
  Math.max(0, Math.floor(scrollTop.value / ITEM_HEIGHT.value) - OVERSCAN)
);
const endIndex = computed(() =>
  Math.min(state.queue.length, Math.ceil((scrollTop.value + containerHeight.value) / ITEM_HEIGHT.value) + OVERSCAN)
);
const visibleItems = computed(() =>
  state.queue.slice(startIndex.value, endIndex.value).map((track, i) => ({
    track,
    index: startIndex.value + i,
  }))
);
const offsetY = computed(() => startIndex.value * ITEM_HEIGHT.value);

function scrollToCurrent() {
  if (!scrollContainer.value || state.queueIndex < 0) return;
  containerHeight.value = scrollContainer.value.clientHeight;
  const h = ITEM_HEIGHT.value;
  const target = state.queueIndex * h - containerHeight.value / 2 + h / 2;
  scrollContainer.value.scrollTop = Math.max(0, target);
}

defineExpose({ scrollToCurrent });

// --- Mouse drag and drop (desktop) ---
const dragIndex = ref(null);
const dragOverIndex = ref(null);
let ghostEl = null;

function onDragStart(e, index) {
  dragIndex.value = index;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  const row = e.currentTarget;
  ghostEl = row.cloneNode(true);
  Object.assign(ghostEl.style, {
    position: 'fixed', top: '-9999px', left: '0',
    width: row.offsetWidth + 'px', height: row.offsetHeight + 'px',
    background: 'rgb(63 63 70 / 0.97)',
    border: '1px solid rgb(82 82 91 / 0.8)',
    borderRadius: '6px', boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
    pointerEvents: 'none', overflow: 'hidden',
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

function onDragLeave(e) {
  // Only clear when actually leaving the row, not when entering a child element
  if (!e.currentTarget.contains(e.relatedTarget)) {
    dragOverIndex.value = null;
  }
}

function onDrop(e, toIndex) {
  e.preventDefault();
  const fromIndex = dragIndex.value;
  if (fromIndex !== null && fromIndex !== toIndex) moveTrack(fromIndex, toIndex);
  dragIndex.value = null;
  dragOverIndex.value = null;
}

function onDragEnd() {
  dragIndex.value = null;
  dragOverIndex.value = null;
  if (ghostEl) { document.body.removeChild(ghostEl); ghostEl = null; }
}

// --- Touch drag (mobile) via drag handle ---
// The handle element has touch-action: none so that even with a pan-y ancestor,
// the browser yields control and e.preventDefault() works in touchmove.
let touchDragIndex = null;

function onHandleTouchStart(e, index) {
  // stopPropagation so NowPlayingModal's swipe handler doesn't fire
  e.stopPropagation();
  touchDragIndex = index;
  dragIndex.value = index;
  document.addEventListener('touchmove', onTouchDragMove, { passive: false });
  document.addEventListener('touchend', onTouchDragEnd);
}

function onTouchDragMove(e) {
  if (touchDragIndex === null) return;
  e.preventDefault(); // block scroll during drag; works because handle has touch-action: none
  const touch = e.touches[0];
  const container = scrollContainer.value;
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const relativeY = touch.clientY - rect.top + container.scrollTop;
  const overIndex = Math.floor(relativeY / ITEM_HEIGHT.value);
  dragOverIndex.value = Math.max(0, Math.min(state.queue.length - 1, overIndex));
}

function onTouchDragEnd() {
  document.removeEventListener('touchmove', onTouchDragMove);
  document.removeEventListener('touchend', onTouchDragEnd);
  const fromIndex = touchDragIndex;
  const toIndex = dragOverIndex.value;
  if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
    moveTrack(fromIndex, toIndex);
  }
  touchDragIndex = null;
  dragIndex.value = null;
  dragOverIndex.value = null;
}

onUnmounted(() => {
  // Clean up if component unmounts mid-drag
  document.removeEventListener('touchmove', onTouchDragMove);
  document.removeEventListener('touchend', onTouchDragEnd);
  if (mediaQuery && mediaQueryListener) {
    if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mediaQueryListener);
    else mediaQuery.removeListener(mediaQueryListener);
  }
});

// --- Play ---
function handlePlay(index) {
  playFromQueue(index);
  emit('play', index);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<template>
  <div class="flex-1 min-h-0 flex flex-col">
    <div v-if="state.queue.length === 0" class="flex-1 flex items-center justify-center text-zinc-500 text-sm">
      Queue is empty
    </div>

    <div
      v-else
      ref="scrollContainer"
      class="flex-1 min-h-0 overflow-y-auto overscroll-contain"
      :style="{ maskImage: scrollMask, WebkitMaskImage: scrollMask }"
      @scroll="onScroll"
    >
      <div :style="{ height: totalHeight + 'px', position: 'relative' }">
        <div :style="{ transform: `translateY(${offsetY}px)` }">
          <div
            v-for="{ track, index: i } in visibleItems"
            :key="track._id + '-' + i"
            class="flex items-center gap-3 cursor-grab active:cursor-grabbing select-none transition-colors"
            :class="[
              props.rowPaddingClass,
              {
                'bg-zinc-800/80 rounded-lg': i === state.queueIndex,
                [`border-t-2 border-${accentColor}-400`]: dragOverIndex === i && dragIndex !== null && dragIndex > i,
              [`border-b-2 border-${accentColor}-400`]: dragOverIndex === i && dragIndex !== null && dragIndex < i,
                'opacity-40': dragIndex === i,
              },
            ]"
            :style="{ height: ITEM_HEIGHT + 'px' }"
            draggable="true"
            @dragstart="onDragStart($event, i)"
            @dragover="onDragOver($event, i)"
            @dragleave="onDragLeave"
            @drop="onDrop($event, i)"
            @dragend="onDragEnd"
          >
            <div v-if="showCoverArt" class="relative flex-shrink-0 group/cover" @click.stop="handlePlay(i)">
              <CoverArt :cover="track.cover" :size="props.roomyMobile && isMobile ? (density === 'compact' ? 'w-9 h-9' : 'w-10 h-10') : (density === 'compact' ? 'w-6 h-6' : 'w-8 h-8')" />
              <div class="absolute inset-0 bg-black/60 rounded flex items-center justify-center opacity-0 group-hover/cover:opacity-100 transition-opacity cursor-pointer">
                <Icon :path="mdiPlay" class="w-4 h-4 text-white" />
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div
                class="truncate cursor-pointer hover:underline"
                :class="[
                  props.roomyMobile && isMobile ? 'text-[15px]' : 'text-sm',
                  i === state.queueIndex ? `text-${accentColor}-400 font-medium` : '',
                ]"
                @click.stop="handlePlay(i)"
              >{{ track.title }}</div>
              <span
                v-if="density !== 'compact' && tracksColumns.artist"
                class="text-zinc-500 truncate block"
                :class="props.roomyMobile && isMobile ? 'text-[13px] mt-0.5' : 'text-xs'"
              >
                <template v-for="(artist, ai) in track.artists" :key="ai">
                  <span v-if="ai > 0">, </span>
                  <router-link
                    :to="{ name: 'artist', params: { name: artist } }"
                    class="hover:text-zinc-100 hover:underline"
                    @click.stop="emit('navigate')"
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
            <span
              class="text-zinc-500 flex-shrink-0"
              :class="props.roomyMobile && isMobile ? 'text-[13px]' : 'text-xs'"
            >{{ formatDuration(track.duration) }}</span>

            <!-- Touch drag handle (mobile only — desktop uses HTML5 drag on the full row) -->
            <div
              class="sm:hidden touch-none flex-shrink-0 px-1 -mr-1"
              @touchstart.stop="onHandleTouchStart($event, i)"
            >
              <Icon :path="mdiDragVertical" class="w-4 h-4 text-zinc-500" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
