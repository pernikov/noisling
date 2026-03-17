<script setup>
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";

const props = defineProps({
  label: { type: String, required: true },
  shortcut: { type: String, default: "" },
  placement: {
    type: String,
    default: "top",
    validator: (value) => ["top", "bottom"].includes(value),
  },
});

const show = ref(false);
const triggerRef = ref(null);
const tooltipRef = ref(null);
const tooltipOffsetX = ref(0);
const positionClass = computed(() => (
  props.placement === "bottom"
    ? "absolute top-full left-1/2 mt-3 pointer-events-none z-50 whitespace-nowrap"
    : "absolute bottom-full left-1/2 mb-3 pointer-events-none z-50 whitespace-nowrap"
));
const motionClass = computed(() => (
  props.placement === "bottom" ? "tooltip-pop-bottom" : "tooltip-pop-top"
));
const tooltipStyle = computed(() => ({
  transform: `translateX(calc(-50% + ${tooltipOffsetX.value}px))`,
}));

function updateTooltipPosition() {
  if (!show.value || !triggerRef.value || !tooltipRef.value || typeof window === "undefined") return;

  const gutter = 8;
  tooltipOffsetX.value = 0;

  const triggerRect = triggerRef.value.getBoundingClientRect();
  const tooltipRect = tooltipRef.value.getBoundingClientRect();
  const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  const minLeft = gutter;
  const maxLeft = window.innerWidth - tooltipRect.width - gutter;

  if (centeredLeft < minLeft) {
    tooltipOffsetX.value = minLeft - centeredLeft;
    return;
  }

  if (centeredLeft > maxLeft) {
    tooltipOffsetX.value = maxLeft - centeredLeft;
  }
}

function hideTooltip() {
  show.value = false;
}

watch(show, async (isVisible) => {
  if (!isVisible) {
    tooltipOffsetX.value = 0;
    return;
  }

  await nextTick();
  updateTooltipPosition();
});

if (typeof window !== "undefined") {
  window.addEventListener("resize", updateTooltipPosition);
  window.addEventListener("scroll", updateTooltipPosition, true);
}

onBeforeUnmount(() => {
  if (typeof window === "undefined") return;
  window.removeEventListener("resize", updateTooltipPosition);
  window.removeEventListener("scroll", updateTooltipPosition, true);
});
</script>

<template>
  <div
    ref="triggerRef"
    class="relative inline-flex items-center justify-center"
    @mouseenter="show = true"
    @mouseleave="hideTooltip"
  >
    <slot />
    <Transition :name="motionClass">
      <div
        v-if="show"
        ref="tooltipRef"
        :class="positionClass"
        :style="tooltipStyle"
      >
        <div
          class="flex items-center gap-1.5 text-xs text-zinc-100 bg-zinc-800/95 backdrop-blur border border-zinc-700/60 px-2 py-1 rounded-md shadow-xl"
        >
          <span>{{ label }}</span>
          <kbd
            v-if="shortcut"
            class="font-mono text-[10px] leading-none bg-zinc-700/60 border border-zinc-600/40 text-zinc-400 px-1 py-px rounded"
          >{{ shortcut }}</kbd>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.tooltip-pop-top-enter-active,
.tooltip-pop-top-leave-active,
.tooltip-pop-bottom-enter-active,
.tooltip-pop-bottom-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-pop-top-enter-from,
.tooltip-pop-top-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(5px) scale(0.93);
}
.tooltip-pop-top-enter-to,
.tooltip-pop-top-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}

.tooltip-pop-bottom-enter-from,
.tooltip-pop-bottom-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-5px) scale(0.93);
}

.tooltip-pop-bottom-enter-to,
.tooltip-pop-bottom-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}
</style>
