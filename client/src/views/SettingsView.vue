<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useApi } from '../composables/useApi.js';
import ConfirmModal from '../components/ConfirmModal.vue';

const api = useApi();
const scanning = ref(false);
const scanPercent = ref(null);
const scanResult = ref(null);
const deleting = ref(false);
const showDeleteConfirm = ref(false);

let eventSource = null;

function listenForProgress() {
  eventSource = new EventSource('/api/events');
  eventSource.addEventListener('scan-progress', (e) => {
    const data = JSON.parse(e.data);
    if (data.phase === 'processing' && data.percent != null) {
      scanPercent.value = data.percent;
    } else if (data.phase === 'complete') {
      scanPercent.value = null;
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
  scanResult.value = null;
  try {
    scanResult.value = await api.scanLibrary();
  } catch (err) {
    scanResult.value = { error: err.message };
  } finally {
    scanning.value = false;
    scanPercent.value = null;
  }
}

async function deleteLibrary() {
  showDeleteConfirm.value = false;
  deleting.value = true;
  try {
    await api.deleteLibrary();
  } catch (err) {
    console.error('Delete failed:', err);
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold mb-6">Settings</h1>

    <section class="space-y-4">
      <h2 class="text-lg font-semibold text-zinc-200">Library</h2>
      <div class="flex items-center gap-4">
        <button
          @click="scanLibrary"
          :disabled="scanning"
          class="text-sm px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 transition-colors"
        >
          {{ scanning ? `Scanning${scanPercent != null ? ` ${scanPercent}%` : '...'}` : 'Scan Library' }}
        </button>
        <span v-if="scanResult && !scanResult.error" class="text-sm text-zinc-400">
          Scan complete
        </span>
        <span v-if="scanResult?.error" class="text-sm text-red-400">
          {{ scanResult.error }}
        </span>
      </div>
      <div>
        <button
          @click="showDeleteConfirm = true"
          :disabled="deleting"
          class="text-sm px-4 py-2 rounded bg-red-600/15 text-red-400 hover:bg-red-600/25 disabled:opacity-50 transition-colors"
        >
          {{ deleting ? 'Deleting...' : 'Delete Library' }}
        </button>
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
