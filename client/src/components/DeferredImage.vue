<script setup>
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { queueDeferredImageLoad } from '../utils/deferredImageLoad.js';

defineOptions({ inheritAttrs: false });

const props = defineProps({
  src: { type: String, default: '' },
  alt: { type: String, default: '' },
  eager: { type: Boolean, default: false },
  priority: { type: String, default: 'normal' },
  loading: { type: String, default: 'lazy' },
  decoding: { type: String, default: 'async' },
  fetchpriority: { type: String, default: 'low' },
  loadedClass: { type: String, default: 'opacity-100' },
  pendingClass: { type: String, default: 'opacity-0' },
  visibleRootMargin: { type: String, default: '500px' },
});

const emit = defineEmits(['loaded', 'error']);

const imgEl = ref(null);
const activeSrc = ref('');
const loaded = ref(false);
const visible = ref(false);

let observer = null;
let queuedLoad = null;
let loadToken = 0;

function cleanupQueue() {
  queuedLoad?.cancel();
  queuedLoad = null;
}

function scheduleLoad() {
  cleanupQueue();
  loaded.value = false;
  activeSrc.value = '';

  if (!props.src || !visible.value) return;

  const token = ++loadToken;
  queuedLoad = queueDeferredImageLoad(() => {
    if (token !== loadToken) return;
    activeSrc.value = props.src;

    nextTick(() => {
      const img = imgEl.value;
      if (token !== loadToken || !img) return;
      if (img.complete && img.naturalWidth > 0) handleLoad();
    });
  }, { priority: props.priority });
}

function handleLoad(event) {
  loaded.value = true;
  queuedLoad?.done();
  queuedLoad = null;
  emit('loaded', event);
}

function handleError(event) {
  queuedLoad?.done();
  queuedLoad = null;
  emit('error', event);
}

onMounted(() => {
  if (props.eager || typeof IntersectionObserver === 'undefined') {
    visible.value = true;
    return;
  }

  observer = new IntersectionObserver((entries) => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    visible.value = true;
    observer?.disconnect();
    observer = null;
  }, { rootMargin: props.visibleRootMargin });

  if (imgEl.value) observer.observe(imgEl.value);
});

watch(() => [props.src, visible.value], scheduleLoad, { immediate: true });

onUnmounted(() => {
  observer?.disconnect();
  cleanupQueue();
  loadToken += 1;
});
</script>

<template>
  <img
    ref="imgEl"
    v-bind="$attrs"
    :src="activeSrc || undefined"
    :alt="props.alt"
    :loading="props.loading"
    :decoding="props.decoding"
    :fetchpriority="props.fetchpriority"
    :class="loaded ? props.loadedClass : props.pendingClass"
    @load="handleLoad"
    @error="handleError"
  />
</template>
