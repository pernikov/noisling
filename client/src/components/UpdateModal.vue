<script setup>
import { ref, nextTick } from 'vue';

const props = defineProps({
  latestVersion: String,
});

const emit = defineEmits(['close']);

// States: 'confirm' | 'running' | 'restarting' | 'ready' | 'error'
const phase = ref('confirm');
const lines = ref([]);
const outputEl = ref(null);

function close() {
  if (phase.value === 'running') return; // don't close mid-update
  emit('close');
}

async function scrollToBottom() {
  await nextTick();
  if (outputEl.value) {
    outputEl.value.scrollTop = outputEl.value.scrollHeight;
  }
}

function addLine(text, cls = '') {
  const raw = text.replace(/\n$/, '');
  for (const part of raw.split('\n')) {
    lines.value.push({ text: part, cls });
  }
  scrollToBottom();
}

async function pollUntilAlive() {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        phase.value = 'ready';
        return;
      }
    } catch {
      // server still down
    }
  }
  // Timed out — still show ready so user can reload manually
  phase.value = 'ready';
}

async function startUpdate() {
  phase.value = 'running';
  lines.value = [];

  try {
    const res = await fetch('/api/update', { method: 'POST' });

    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Unknown error' }));
      addLine(error, 'text-red-400');
      phase.value = 'error';
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const parts = buf.split('\n\n');
      buf = parts.pop();
      for (const chunk of parts) {
        const line = chunk.replace(/^data: /, '').trim();
        if (!line) continue;
        try {
          const { type, message } = JSON.parse(line);
          if (type === 'step') addLine(`\n▶ ${message}`, 'text-amber-400 font-medium');
          else if (type === 'output') addLine(message);
          else if (type === 'done') {
            addLine(`\n✓ ${message}`, 'text-green-400 font-medium');
            phase.value = 'restarting';
            pollUntilAlive();
          } else if (type === 'error') {
            addLine(`\n✗ ${message}`, 'text-red-400');
            phase.value = 'error';
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    // Stream ended without 'done' — container restarted and killed our connection
    if (phase.value === 'running') {
      addLine('\n▶ Container is restarting...', 'text-amber-400 font-medium');
      phase.value = 'restarting';
      pollUntilAlive();
    }
  } catch {
    if (phase.value === 'running') {
      // Fetch error usually means server restarted
      addLine('\n▶ Container is restarting...', 'text-amber-400 font-medium');
      phase.value = 'restarting';
      pollUntilAlive();
    }
  }
}

function reload() {
  window.location.reload();
}
</script>

<template>
  <Teleport to="body">
    <Transition name="update-modal">
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        @click.self="close"
      >
        <div class="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm" @click="close" />

        <div class="update-card relative bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-lg p-6">
          <!-- Header -->
          <div class="flex items-center justify-between mb-5">
            <div class="flex items-center gap-2">
              <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <h2 class="font-bold text-base">Update Noisling</h2>
            </div>
            <button
              v-if="phase !== 'running'"
              class="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-800"
              @click="close"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          <!-- Confirm phase -->
          <div v-if="phase === 'confirm'" class="space-y-4">
            <p class="text-sm text-zinc-300">
              A new version <span class="text-amber-400 font-mono">v{{ latestVersion }}</span> is available.
              Clicking <strong>Update</strong> will run <code class="text-zinc-400 bg-zinc-800 px-1 rounded text-xs">git pull</code>
              and <code class="text-zinc-400 bg-zinc-800 px-1 rounded text-xs">docker compose up -d --build</code>
              on the host machine.
            </p>
            <p class="text-xs text-zinc-500">
              The app will briefly go offline while the new image is built and the container restarts.
            </p>
            <div class="flex justify-end gap-2 pt-1">
              <button
                class="px-4 py-1.5 text-sm rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                @click="close"
              >
                Cancel
              </button>
              <button
                class="px-4 py-1.5 text-sm rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors"
                @click="startUpdate"
              >
                Update
              </button>
            </div>
          </div>

          <!-- Running / error phase -->
          <div v-else-if="phase === 'running' || phase === 'error'" class="space-y-3">
            <div
              ref="outputEl"
              class="bg-zinc-950 rounded-lg p-3 h-64 overflow-y-auto font-mono text-xs leading-5 text-zinc-300 whitespace-pre-wrap"
            >
              <span
                v-for="(line, i) in lines"
                :key="i"
                :class="line.cls"
              >{{ line.text }}<br /></span>
              <span v-if="phase === 'running'" class="inline-block w-2 h-3.5 bg-zinc-400 animate-pulse align-middle" />
            </div>
            <div v-if="phase === 'error'" class="flex justify-end">
              <button
                class="px-4 py-1.5 text-sm rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
                @click="close"
              >
                Close
              </button>
            </div>
          </div>

          <!-- Restarting phase -->
          <div v-else-if="phase === 'restarting'" class="space-y-3">
            <div
              ref="outputEl"
              class="bg-zinc-950 rounded-lg p-3 h-52 overflow-y-auto font-mono text-xs leading-5 text-zinc-300 whitespace-pre-wrap"
            >
              <span
                v-for="(line, i) in lines"
                :key="i"
                :class="line.cls"
              >{{ line.text }}<br /></span>
            </div>
            <div class="flex items-center gap-2 text-sm text-zinc-400">
              <svg class="w-4 h-4 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Waiting for the server to come back online...
            </div>
          </div>

          <!-- Ready phase -->
          <div v-else-if="phase === 'ready'" class="space-y-4">
            <div
              ref="outputEl"
              class="bg-zinc-950 rounded-lg p-3 h-44 overflow-y-auto font-mono text-xs leading-5 text-zinc-300 whitespace-pre-wrap"
            >
              <span
                v-for="(line, i) in lines"
                :key="i"
                :class="line.cls"
              >{{ line.text }}<br /></span>
            </div>
            <p class="text-sm text-zinc-300">Server is back online. Reload to use the new version.</p>
            <div class="flex justify-end">
              <button
                class="px-4 py-1.5 text-sm rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold transition-colors"
                @click="reload"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style>
.update-modal-enter-active,
.update-modal-leave-active {
  transition: opacity 0.2s ease;
}
.update-modal-enter-active .update-card,
.update-modal-leave-active .update-card {
  transition: transform 0.2s ease;
}
.update-modal-enter-from,
.update-modal-leave-to {
  opacity: 0;
}
.update-modal-enter-from .update-card,
.update-modal-leave-to .update-card {
  transform: scale(0.96) translateY(6px);
}
</style>
