<script setup>
import BaseModal from './BaseModal.vue';
import KbdKey from './KbdKey.vue';
import ModalCloseButton from './ModalCloseButton.vue';
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
      { keys: ['L'], description: 'Love / unlove track' },
      { keys: ['A'], description: 'Add track to playlist' },
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
      { keys: ['F'], description: 'Global search' },
      { keys: ['V'], description: 'Toggle visualizer' },
      { keys: ['Q'], description: 'Toggle queue' },
      { keys: ['?'], description: 'Show this panel' },
      { keys: ['Esc'], description: 'Close visualizer / queue / shortcuts' },
    ],
  },
];
</script>

<template>
  <BaseModal :show="playerState.showShortcuts" @close="toggleShortcuts">
    <div class="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-sm p-6">
      <div class="flex items-center justify-between mb-5">
        <h2 class="font-display font-bold text-lg">Keyboard Shortcuts</h2>
        <ModalCloseButton @click="toggleShortcuts" />
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
                <KbdKey v-for="key in s.keys" :key="key">{{ key }}</KbdKey>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseModal>
</template>
