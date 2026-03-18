<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { mdiCheck } from '@mdi/js';
import CoverArt from './CoverArt.vue';
import Icon from './Icon.vue';
import { usePlayer } from '../composables/usePlayer.js';
import { useTheme } from '../composables/useTheme.js';
import { formatTime } from '../composables/useProgressScrub.js';

const props = defineProps({
  track: { type: Object, default: null },
  phase: { type: String, default: 'counting' },
});

const { state } = usePlayer();
const { density, showCoverArt, accentRgb } = useTheme();
const pillSizer = ref(null);
const pillWidth = ref(0);
let pillResizeObserver = null;

const progressPct = computed(() => {
  if (!props.track) return 0;
  if (props.phase !== 'counting') return 100;
  if (state.currentTrack?._id !== props.track._id) return 0;
  return Math.round(Math.max(0, Math.min(1, state.currentTrackPlayProgress || 0)) * 100);
});

const isCompleting = computed(() => props.phase === 'completed' || props.phase === 'fading');

const playThresholdSeconds = computed(() => {
  if (!props.track) return '';
  const duration = Number(props.track.duration) || Number(state.duration) || 0;
  return duration > 0 ? Math.min(duration * 0.5, 240) : 0;
});

const remainingPlayLabel = computed(() => {
  const threshold = playThresholdSeconds.value;
  if (threshold <= 0) return '';
  if (props.phase !== 'counting') return formatTime(0);

  const progress = state.currentTrack?._id === props.track?._id
    ? Math.max(0, Math.min(1, state.currentTrackPlayProgress || 0))
    : 0;
  const remaining = Math.max(0, threshold * (1 - progress));
  return formatTime(remaining);
});

async function updatePillWidth() {
  await nextTick();
  pillWidth.value = pillSizer.value ? Math.ceil(pillSizer.value.offsetWidth) : 0;
}

const pillStyle = computed(() => ({
  width: isCompleting.value ? '2rem' : (pillWidth.value > 0 ? `${pillWidth.value}px` : undefined),
  minWidth: isCompleting.value ? '2rem' : (pillWidth.value > 0 ? `${pillWidth.value}px` : undefined),
  '--pending-pill-accent': `rgb(${accentRgb.value ?? accentRgb})`,
}));

onMounted(async () => {
  await updatePillWidth();
  if (typeof ResizeObserver !== 'undefined' && pillSizer.value) {
    pillResizeObserver = new ResizeObserver(() => {
      updatePillWidth();
    });
    pillResizeObserver.observe(pillSizer.value);
  }
});

onBeforeUnmount(() => {
  pillResizeObserver?.disconnect();
});

watch(remainingPlayLabel, () => {
  if (!isCompleting.value) updatePillWidth();
});

watch(() => props.phase, () => {
  if (!isCompleting.value) updatePillWidth();
});
</script>

<template>
  <div
    v-if="track"
    class="pending-play-status relative overflow-hidden rounded-2xl px-4 shadow-[0_18px_50px_-28px_rgba(0,0,0,0.85)]"
    :class="[
      density === 'compact' ? 'py-2.5' : 'py-3',
      {
        'pending-play-status--counting': phase === 'counting',
        'pending-play-status--completing': phase === 'completed',
        'pending-play-status--leaving': phase === 'fading',
      },
    ]"
    :style="{ '--pending-progress': `${progressPct}%` }"
  >
    <span class="pending-play-status__backdrop"></span>
    <span class="pending-play-status__fill"></span>
    <span class="pending-play-status__sheen"></span>

    <div class="relative z-10 flex items-center gap-3 min-w-0">
      <CoverArt
        v-if="showCoverArt"
        :cover="track.cover"
        :size="density === 'compact' ? 'w-8 h-8 shrink-0 rounded-md' : 'w-10 h-10 shrink-0 rounded-md'"
      />

      <div class="min-w-0 flex-1">
        <div class="truncate text-sm font-medium text-zinc-100">{{ track.title }}</div>
        <div class="truncate text-xs text-zinc-500">{{ track.artists?.join(', ') }}</div>
      </div>

      <div class="pending-play-status__status shrink-0 text-right" :class="{ 'pending-play-status__status--completed': isCompleting }">
        <div
          class="pending-play-status__pill tabular-nums text-[10px] font-medium uppercase tracking-[0.18em]"
          :style="pillStyle"
        >
          <span class="pending-play-status__pill-label" :class="{ 'pending-play-status__pill-label--hidden': isCompleting }">
            <template v-if="remainingPlayLabel">Played after {{ remainingPlayLabel }}</template>
            <template v-else>Marking played</template>
          </span>
          <span class="pending-play-status__check-wrap" :class="{ 'pending-play-status__check-wrap--visible': isCompleting }">
            <Icon :path="mdiCheck" class="h-3.5 w-3.5" />
          </span>
        </div>
        <span ref="pillSizer" class="pending-play-status__pill-sizer tabular-nums text-[10px] font-medium uppercase tracking-[0.18em]">
          <template v-if="remainingPlayLabel">Played after {{ remainingPlayLabel }}</template>
          <template v-else>Marking played</template>
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pending-play-status {
  background:
    radial-gradient(circle at top left, rgb(255 255 255 / 0.08), transparent 38%),
    linear-gradient(135deg, rgb(24 24 27 / 0.98), rgb(18 18 21 / 0.96));
  transition: opacity 320ms ease-out, transform 320ms cubic-bezier(0.22, 1, 0.36, 1), filter 320ms ease-out;
}
.pending-play-status__backdrop {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgb(255 255 255 / 0.02), rgb(255 255 255 / 0));
  pointer-events: none;
}
.pending-play-status__fill {
  position: absolute;
  inset: 0;
  width: var(--pending-progress, 0%);
  background: linear-gradient(90deg, rgb(255 255 255 / 0.09), rgb(255 255 255 / 0.03));
  transition: width 220ms linear, opacity 260ms ease-out;
}
.pending-play-status__sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(115deg, transparent 18%, rgb(255 255 255 / 0.07) 32%, transparent 48%);
  opacity: 0.45;
  transform: translateX(-38%);
  transition: opacity 260ms ease-out, transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}
.pending-play-status--counting {
  animation: pending-play-glow 1.8s ease-in-out infinite;
}
.pending-play-status__status {
  position: relative;
  min-width: 0;
  transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
}
.pending-play-status__status--completed {
  transform: translateX(-0.2rem);
}
.pending-play-status__pill {
  position: relative;
  overflow: hidden;
  min-height: 2rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.48rem 0.9rem;
  border-radius: 999px;
  background: rgb(9 9 11 / 0.62);
  color: rgb(161 161 170 / 1);
  backdrop-filter: blur(10px);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.06);
  transition: width 420ms cubic-bezier(0.22, 1, 0.36, 1), min-width 420ms cubic-bezier(0.22, 1, 0.36, 1), padding 420ms cubic-bezier(0.22, 1, 0.36, 1), background-color 320ms ease-out, color 320ms ease-out, transform 420ms cubic-bezier(0.22, 1, 0.36, 1), box-shadow 320ms ease-out;
}
.pending-play-status__status--completed .pending-play-status__pill {
  padding-left: 0;
  padding-right: 0;
}
.pending-play-status__pill-label {
  display: inline-block;
  max-width: 14rem;
  white-space: nowrap;
  overflow: hidden;
  transition: opacity 220ms ease-out, transform 380ms cubic-bezier(0.22, 1, 0.36, 1), filter 220ms ease-out;
}
.pending-play-status__pill-label--hidden {
  max-width: 0;
  opacity: 0;
  transform: translateY(-7px) scale(0.92);
  filter: blur(3px);
}
.pending-play-status__check-wrap {
  position: absolute;
  left: 50%;
  top: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transform: translate(-50%, -50%) rotate(-10deg) scale(0.6);
  filter: blur(5px);
  transition: opacity 260ms ease-out 80ms, transform 520ms cubic-bezier(0.2, 0.9, 0.2, 1.2) 80ms, filter 260ms ease-out 80ms;
}
.pending-play-status__check-wrap--visible {
  opacity: 1;
  transform: translate(-50%, -50%) rotate(0deg) scale(1);
  filter: blur(0);
}
.pending-play-status__pill-sizer {
  position: absolute;
  visibility: hidden;
  pointer-events: none;
  white-space: nowrap;
  padding: 0.48rem 0.9rem;
}
.pending-play-status--completing .pending-play-status__pill {
  background: color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 18%, rgb(9 9 11 / 0.82));
  color: color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 62%, white);
  transform: scale(1.02);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 30%, rgb(255 255 255 / 0.06)),
    0 14px 28px -24px color-mix(in srgb, var(--pending-pill-accent, rgb(255 255 255)) 45%, transparent);
}
.pending-play-status--completing .pending-play-status__fill,
.pending-play-status--leaving .pending-play-status__fill {
  opacity: 0.85;
}
.pending-play-status--completing .pending-play-status__sheen,
.pending-play-status--leaving .pending-play-status__sheen {
  opacity: 0.9;
  transform: translateX(18%);
}
.pending-play-status--leaving {
  opacity: 0;
  transform: translateY(-2px) scale(0.985);
  filter: blur(1px);
}
@media (prefers-reduced-motion: reduce) {
  .pending-play-status,
  .pending-play-status__fill,
  .pending-play-status__sheen,
  .pending-play-status__status,
  .pending-play-status__pill,
  .pending-play-status__pill-label,
  .pending-play-status__check-wrap {
    transition: none;
  }
  .pending-play-status--counting {
    animation: none;
  }
}
@keyframes pending-play-glow {
  0%, 100% {
    border-color: rgb(63 63 70 / 1);
  }
  50% {
    border-color: rgb(82 82 91 / 1);
  }
}
</style>
