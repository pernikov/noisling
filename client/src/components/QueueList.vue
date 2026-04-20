<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { mdiPlay, mdiRepeatOnce, mdiDragVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from './Icon.vue';
import CoverArt from './CoverArt.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { useDragAutoScroll } from '../composables/useDragAutoScroll.js';

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

const emit = defineEmits(['play', 'navigate', 'drag-state']);

const { state, moveTrack, removeTrack, playFromQueue } = usePlayer();
const { accentColor } = useTheme();
const isMobile = ref(false);
const discardHovered = ref(false);
let mediaQuery = null;
let mediaQueryListener = null;
let drawerEl = null;
const swipeIndex = ref(null);
const swipeOffset = ref(0);
const SWIPE_ACTION_WIDTH = 96;
const SWIPE_OPEN_THRESHOLD = 44;
const SWIPE_DELETE_THRESHOLD = SWIPE_ACTION_WIDTH - 8;

// --- Virtual scrolling ---
const ITEM_HEIGHT = computed(() => {
  if (props.roomyMobile && isMobile.value) return 64;
  return 52;
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

// --- Mouse drag and drop (desktop) ---
const dragIndex = ref(null);
const dragOverIndex = ref(null);
let ghostEl = null;
const { start: startAutoScroll, update: updateAutoScroll, stop: stopAutoScroll } = useDragAutoScroll({
  onScroll: updateTouchDragOverIndex,
  onStop: clearDragState,
});

function clearDragState() {
  dragIndex.value = null;
  dragOverIndex.value = null;
  touchDragIndex = null;
  discardHovered.value = false;
  emit('drag-state', { dragging: false, discardHovered: false, activeIndex: null });
  if (ghostEl) {
    document.body.removeChild(ghostEl);
    ghostEl = null;
  }
}

function clearSwipeState() {
  swipeIndex.value = null;
  swipeOffset.value = 0;
  handleTouchSession = null;
}

function emitDragState() {
  emit('drag-state', {
    dragging: dragIndex.value !== null || touchDragIndex !== null,
    discardHovered: discardHovered.value,
    activeIndex: dragIndex.value ?? touchDragIndex,
  });
}

function isPointOutsideDrawer(clientX, clientY) {
  if (!drawerEl) return false;
  const rect = drawerEl.getBoundingClientRect();
  return clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom;
}

function updateTouchDragOverIndex(clientY) {
  const container = scrollContainer.value;
  if (!container || clientY === null) return;
  const rect = container.getBoundingClientRect();
  const relativeY = clientY - rect.top + container.scrollTop;
  const overIndex = Math.floor(relativeY / ITEM_HEIGHT.value);
  dragOverIndex.value = Math.max(0, Math.min(state.queue.length - 1, overIndex));
}

function updateDiscardHover(clientX, clientY) {
  const nextHovered = dragIndex.value !== null && isPointOutsideDrawer(clientX, clientY);
  if (discardHovered.value === nextHovered) return;
  discardHovered.value = nextHovered;
  if (nextHovered) dragOverIndex.value = null;
  emitDragState();
}

function onGlobalDragOver(e) {
  if (dragIndex.value === null) return;
  updateDiscardHover(e.clientX, e.clientY);
}

function onGlobalDrop(e) {
  if (dragIndex.value === null) return;
  if (!isPointOutsideDrawer(e.clientX, e.clientY)) return;
  e.preventDefault();
  removeTrack(dragIndex.value);
  stopAutoScroll();
}

function removeDraggedTrack() {
  const index = dragIndex.value ?? touchDragIndex;
  if (index === null) return;
  removeTrack(index);
  stopAutoScroll();
}

function onDragStart(e, index) {
  dragIndex.value = index;
  discardHovered.value = false;
  startAutoScroll(scrollContainer.value, e.clientY);
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(index));
  emitDragState();
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
  discardHovered.value = false;
  emitDragState();
  updateAutoScroll(e.clientY);
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
  stopAutoScroll();
}

function onDragEnd() {
  stopAutoScroll();
}

// --- Touch drag (mobile) via drag handle ---
// The handle element has touch-action: none so that even with a pan-y ancestor,
// the browser yields control and e.preventDefault() works in touchmove.
let touchDragIndex = null;
let handleTouchSession = null;

function canSwipeToDelete() {
  return props.roomyMobile && isMobile.value;
}

function startHandleReorder(index, clientY) {
  touchDragIndex = index;
  dragIndex.value = index;
  dragOverIndex.value = index;
  discardHovered.value = false;
  startAutoScroll(scrollContainer.value, clientY ?? null);
  emitDragState();
}

function onHandleTouchStart(e, index) {
  e.stopPropagation();
  const touch = e.touches[0];
  if (!touch) return;
  if (swipeIndex.value !== null && swipeIndex.value !== index) clearSwipeState();
  handleTouchSession = {
    index,
    startX: touch.clientX,
    startY: touch.clientY,
    offsetBase: swipeIndex.value === index ? swipeOffset.value : 0,
    mode: null,
  };
  document.addEventListener('touchmove', onHandleTouchMove, { passive: false });
  document.addEventListener('touchend', onHandleTouchEnd);
  document.addEventListener('touchcancel', onHandleTouchEnd);
}

function onHandleTouchMove(e) {
  if (!handleTouchSession) return;
  const touch = e.touches[0];
  if (!touch) return;

  const deltaX = touch.clientX - handleTouchSession.startX;
  const deltaY = touch.clientY - handleTouchSession.startY;

  if (!handleTouchSession.mode && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
    handleTouchSession.mode = Math.abs(deltaX) > Math.abs(deltaY) ? 'swipe' : 'reorder';
    if (handleTouchSession.mode === 'reorder') {
      startHandleReorder(handleTouchSession.index, touch.clientY);
    }
  }

  if (handleTouchSession.mode === 'swipe') {
    e.preventDefault();
    swipeIndex.value = handleTouchSession.index;
    swipeOffset.value = Math.max(-SWIPE_DELETE_THRESHOLD, Math.min(0, handleTouchSession.offsetBase + deltaX));
    return;
  }

  if (handleTouchSession.mode === 'reorder' && touchDragIndex !== null) {
    e.preventDefault();
    updateDiscardHover(touch.clientX, touch.clientY);
    if (discardHovered.value) return;
    updateTouchDragOverIndex(touch.clientY);
    updateAutoScroll(touch.clientY);
  }
}

function onHandleTouchEnd() {
  document.removeEventListener('touchmove', onHandleTouchMove);
  document.removeEventListener('touchend', onHandleTouchEnd);
  document.removeEventListener('touchcancel', onHandleTouchEnd);

  if (!handleTouchSession) {
    stopAutoScroll();
    return;
  }

  const index = handleTouchSession.index;

  if (handleTouchSession.mode === 'swipe') {
    if (swipeOffset.value <= -SWIPE_DELETE_THRESHOLD) {
      removeTrack(index);
      clearSwipeState();
    } else if (swipeOffset.value <= -SWIPE_OPEN_THRESHOLD) {
      swipeIndex.value = index;
      swipeOffset.value = -SWIPE_ACTION_WIDTH;
    } else {
      clearSwipeState();
    }
    handleTouchSession = null;
    return;
  }

  if (touchDragIndex !== null) {
    const fromIndex = touchDragIndex;
    const toIndex = dragOverIndex.value;
    if (fromIndex !== null && discardHovered.value) {
      removeTrack(fromIndex);
    } else if (fromIndex !== null && toIndex !== null && fromIndex !== toIndex) {
      moveTrack(fromIndex, toIndex);
    }
  }

  handleTouchSession = null;
  stopAutoScroll();
}

function removeSwipedTrack(index) {
  removeTrack(index);
  clearSwipeState();
}

onUnmounted(() => {
  // Clean up if component unmounts mid-drag
  document.removeEventListener('touchmove', onHandleTouchMove);
  document.removeEventListener('touchend', onHandleTouchEnd);
  document.removeEventListener('touchcancel', onHandleTouchEnd);
  stopAutoScroll();
  clearSwipeState();
  if (mediaQuery && mediaQueryListener) {
    if (mediaQuery.removeEventListener) mediaQuery.removeEventListener('change', mediaQueryListener);
    else mediaQuery.removeListener(mediaQueryListener);
  }
  window.removeEventListener('dragover', onGlobalDragOver, true);
  window.removeEventListener('drop', onGlobalDrop, true);
});

onMounted(() => {
  drawerEl = scrollContainer.value?.closest('[data-queue-drawer]') ?? null;
  window.addEventListener('dragover', onGlobalDragOver, true);
  window.addEventListener('drop', onGlobalDrop, true);
});

defineExpose({ scrollToCurrent, removeDraggedTrack });

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
            class="relative overflow-hidden rounded-lg"
            :style="{ height: ITEM_HEIGHT + 'px' }"
          >
            <div
              v-if="props.roomyMobile && isMobile && swipeIndex === i && swipeOffset < 0"
              class="absolute inset-y-0 right-0 flex w-[96px] items-stretch"
            >
              <button
                class="flex w-full flex-col items-center justify-center rounded-r-lg bg-red-500 text-white active:bg-red-400"
                @click.stop="removeSwipedTrack(i)"
              >
                <Icon :path="mdiTrashCanOutline" class="h-5 w-5" />
                <div class="mt-1 text-[10px] font-medium uppercase tracking-[0.18em]">Remove</div>
              </button>
            </div>

            <div
              class="flex items-center gap-3 cursor-grab active:cursor-grabbing select-none transition-[transform,opacity,background-color,border-color] duration-200"
              :class="[
                props.rowPaddingClass,
                {
                  'bg-zinc-900/95': props.roomyMobile && isMobile,
                  'bg-zinc-800/80 rounded-lg': i === state.queueIndex,
                  [`border-t-2 border-${accentColor}-400`]: dragOverIndex === i && dragIndex !== null && dragIndex > i,
                  [`border-b-2 border-${accentColor}-400`]: dragOverIndex === i && dragIndex !== null && dragIndex < i,
                  'opacity-40': dragIndex === i,
                },
              ]"
              :style="{
                height: ITEM_HEIGHT + 'px',
                transform: swipeIndex === i ? `translateX(${swipeOffset}px)` : '',
              }"
              draggable="true"
              @dragstart="onDragStart($event, i)"
              @dragover="onDragOver($event, i)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, i)"
              @dragend="onDragEnd"
            >
              <div class="relative flex-shrink-0 group/cover" @click.stop="handlePlay(i)">
                <CoverArt :cover="track.cover" :size="props.roomyMobile && isMobile ? 'w-10 h-10' : 'w-8 h-8'" />
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
                :class="{ 'opacity-0': swipeIndex === i && swipeOffset < 0 }"
                data-queue-drag-handle
                @touchstart.stop="onHandleTouchStart($event, i)"
              >
                <Icon :path="mdiDragVertical" class="w-4 h-4 text-zinc-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
