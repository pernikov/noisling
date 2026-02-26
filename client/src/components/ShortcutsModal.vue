<script setup>
import { usePlayer } from '../composables/usePlayer.js';

const { state: playerState, toggleShortcuts } = usePlayer();

const groups = [
  {
    label: 'Playback',
    shortcuts: [
      { keys: ['Space'], description: 'Play / Pause' },
      { keys: ['N'], description: 'Next track' },
      { keys: ['P'], description: 'Previous track' },
      { keys: ['M'], description: 'Mute / Unmute' },
      { keys: ['S'], description: 'Toggle shuffle' },
      { keys: ['R'], description: 'Cycle repeat mode' },
    ],
  },
  {
    label: 'Seeking',
    shortcuts: [
      { keys: ['←'], description: 'Seek back 5 seconds' },
      { keys: ['→'], description: 'Seek forward 5 seconds' },
      { keys: ['↑'], description: 'Volume up' },
      { keys: ['↓'], description: 'Volume down' },
    ],
  },
  {
    label: 'Interface',
    shortcuts: [
      { keys: ['V'], description: 'Toggle visualizer' },
      { keys: ['Q'], description: 'Toggle queue' },
      { keys: ['?'], description: 'Show this panel' },
      { keys: ['Esc'], description: 'Close visualizer / queue / shortcuts' },
    ],
  },
];
</script>

<template>
  <Teleport to="body">
    <Transition name="shortcuts">
      <div
        v-if="playerState.showShortcuts"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="toggleShortcuts"
      >
        <div class="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" @click="toggleShortcuts" />

        <div class="shortcuts-card relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div class="flex items-center justify-between mb-5">
            <h2 class="font-display font-bold text-lg">Keyboard Shortcuts</h2>
            <button
              class="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-800"
              @click="toggleShortcuts"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <div class="space-y-5">
            <div v-for="group in groups" :key="group.label">
              <p class="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">{{ group.label }}</p>
              <div class="space-y-1">
                <div
                  v-for="s in group.shortcuts"
                  :key="s.description"
                  class="flex items-center justify-between gap-4"
                >
                  <span class="text-sm text-zinc-300">{{ s.description }}</span>
                  <div class="flex items-center gap-1 shrink-0">
                    <kbd
                      v-for="key in s.keys"
                      :key="key"
                      class="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 shadow-sm"
                    >{{ key }}</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
/* Not scoped — descendant selectors on teleported content require global scope. */
.shortcuts-enter-active,
.shortcuts-leave-active {
  transition: opacity 0.2s ease;
}
.shortcuts-enter-active .shortcuts-card,
.shortcuts-leave-active .shortcuts-card {
  transition: transform 0.2s ease;
}
.shortcuts-enter-from,
.shortcuts-leave-to {
  opacity: 0;
}
.shortcuts-enter-from .shortcuts-card,
.shortcuts-leave-to .shortcuts-card {
  transform: scale(0.96) translateY(6px);
}
</style>
