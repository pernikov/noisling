<script setup>
import { ref } from "vue";

defineProps({
  label: { type: String, required: true },
  shortcut: { type: String, default: "" },
});

const show = ref(false);
</script>

<template>
  <div
    class="relative inline-flex items-center justify-center"
    @mouseenter="show = true"
    @mouseleave="show = false"
  >
    <slot />
    <Transition name="tooltip-pop">
      <div
        v-if="show"
        class="absolute bottom-full left-1/2 mb-3 pointer-events-none z-50 whitespace-nowrap"
        style="transform: translateX(-50%)"
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
.tooltip-pop-enter-active,
.tooltip-pop-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.tooltip-pop-enter-from,
.tooltip-pop-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(5px) scale(0.93);
}
.tooltip-pop-enter-to,
.tooltip-pop-leave-from {
  opacity: 1;
  transform: translateX(-50%) translateY(0) scale(1);
}
</style>
