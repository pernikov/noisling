<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import ConfirmModal from '../components/ConfirmModal.vue';

const api = useApi();
const scanning = ref(false);
const scanPhase = ref(null);
const scanPercent = ref(null);
const scanProgress = ref(null);
const scanResult = ref(null);
const deleting = ref(false);
const deleteResult = ref(null);
const showDeleteConfirm = ref(false);

let eventSource = null;

function listenForProgress() {
  eventSource = new EventSource('/api/events');
  eventSource.addEventListener('scan-progress', (e) => {
    const data = JSON.parse(e.data);
    scanPhase.value = data.phase;

    if (data.phase === 'walking') {
      scanProgress.value = { message: data.message };
    } else if (data.phase === 'processing') {
      if (data.percent != null) {
        scanPercent.value = data.percent;
        scanProgress.value = { processed: data.processed, total: data.total };
      } else {
        scanProgress.value = { total: data.total, toProcess: data.toProcess, skipped: data.skipped };
      }
    } else if (data.phase === 'complete') {
      scanPercent.value = null;
      scanProgress.value = null;
      scanPhase.value = null;
    }
  });
}

onMounted(() => listenForProgress());
onUnmounted(() => {
  eventSource?.close();
  eventSource = null;
});

async function scanLibrary() {
  scanning.value = true;
  scanPercent.value = 0;
  scanPhase.value = null;
  scanProgress.value = null;
  scanResult.value = null;
  try {
    scanResult.value = await api.scanLibrary();
  } catch (err) {
    scanResult.value = { error: err.message };
  } finally {
    scanning.value = false;
    scanPercent.value = null;
    scanPhase.value = null;
    scanProgress.value = null;
  }
}

async function deleteLibrary() {
  showDeleteConfirm.value = false;
  deleting.value = true;
  deleteResult.value = null;
  try {
    const res = await api.deleteLibrary();
    deleteResult.value = { deletedTracks: res.deletedTracks };
  } catch (err) {
    deleteResult.value = { error: err.message };
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-8">Settings</h1>

    <section class="bg-zinc-900 rounded-xl border border-zinc-800 p-6 space-y-6">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <svg class="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <h2 class="text-lg font-semibold text-zinc-100">Library</h2>
        </div>
        <p class="text-sm text-zinc-500">Scan your music directory for new tracks or manage your library.</p>
      </div>

      <div class="border-t border-zinc-800" />

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Scan for music</p>
            <p class="text-xs text-zinc-500">Discover and index new audio files from your library folder.</p>
          </div>
          <button
            @click="scanLibrary"
            :disabled="scanning"
            class="text-sm px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
          >
            <svg v-if="!scanning" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            {{ scanning ? 'Scanning...' : 'Scan Library' }}
          </button>
        </div>

        <!-- Scan progress -->
        <div v-if="scanning" class="bg-zinc-800/50 rounded-lg p-4 space-y-3">
          <!-- Walking phase -->
          <div v-if="scanPhase === 'walking'" class="flex items-center gap-2 text-sm text-zinc-300">
            <svg class="w-4 h-4 animate-spin text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Discovering files...
          </div>

          <!-- Processing phase: initial summary -->
          <div v-if="scanPhase === 'processing' && scanProgress?.total && scanProgress?.toProcess != null" class="flex items-center gap-4 text-xs text-zinc-400">
            <span>{{ scanProgress.total }} files found</span>
            <span>{{ scanProgress.toProcess }} to process</span>
            <span>{{ scanProgress.skipped }} unchanged</span>
          </div>

          <!-- Processing phase: progress bar -->
          <div v-if="scanPhase === 'processing' && scanPercent != null" class="space-y-2">
            <div class="flex items-center justify-between text-xs text-zinc-400">
              <span>Processing tracks... {{ scanProgress?.processed ?? 0 }} / {{ scanProgress?.total ?? '?' }}</span>
              <span>{{ scanPercent }}%</span>
            </div>
            <div class="w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                class="h-full bg-emerald-500 rounded-full transition-all duration-300"
                :style="{ width: scanPercent + '%' }"
              />
            </div>
          </div>
        </div>

        <!-- Scan result: success -->
        <div v-if="scanResult && !scanResult.error"
          class="bg-emerald-500/10 rounded-lg px-4 py-3 space-y-1"
        >
          <div class="flex items-center gap-2 text-sm text-emerald-400">
            <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6 9 17l-5-5"/>
            </svg>
            Scan complete
          </div>
          <div class="flex items-center gap-4 text-xs text-zinc-400 pl-6">
            <span v-if="scanResult.added">{{ scanResult.added }} added</span>
            <span v-if="scanResult.updated">{{ scanResult.updated }} updated</span>
            <span v-if="scanResult.removed">{{ scanResult.removed }} removed</span>
            <span v-if="scanResult.skipped">{{ scanResult.skipped }} unchanged</span>
            <span v-if="scanResult.errors">{{ scanResult.errors }} errors</span>
          </div>
        </div>

        <!-- Scan result: error -->
        <div v-if="scanResult?.error"
          class="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
          </svg>
          {{ scanResult.error }}
        </div>
      </div>

      <div class="border-t border-zinc-800" />

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-zinc-200">Delete library</p>
            <p class="text-xs text-zinc-500">Remove all tracks, cover art, and play statistics.</p>
          </div>
          <button
            @click="showDeleteConfirm = true"
            :disabled="deleting"
            class="text-sm px-4 py-2 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 disabled:opacity-50 transition-colors flex items-center gap-2 shrink-0"
          >
            <svg v-if="!deleting" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
            </svg>
            <svg v-else class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            {{ deleting ? 'Deleting...' : 'Delete Library' }}
          </button>
        </div>

        <!-- Delete result: success -->
        <div v-if="deleteResult && !deleteResult.error"
          class="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg px-4 py-3"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 6 9 17l-5-5"/>
          </svg>
          Library deleted — {{ deleteResult.deletedTracks }} track{{ deleteResult.deletedTracks === 1 ? '' : 's' }} removed.
        </div>

        <!-- Delete result: error -->
        <div v-if="deleteResult?.error"
          class="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-4 py-3"
        >
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/>
          </svg>
          {{ deleteResult.error }}
        </div>
      </div>
    </section>

    <ConfirmModal
      v-if="showDeleteConfirm"
      title="Delete library?"
      message="This will permanently delete all tracks from the database, remove all cover art, and clear your play statistics. This action cannot be undone."
      confirm-label="Delete Everything"
      :destructive="true"
      @confirm="deleteLibrary"
      @cancel="showDeleteConfirm = false"
    />
  </div>
</template>
