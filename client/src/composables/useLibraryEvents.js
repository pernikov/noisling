import { onMounted, onUnmounted } from 'vue';

let eventSource = null;
const listeners = new Set();

function ensureConnection() {
  if (eventSource) return;

  eventSource = new EventSource('/api/events');

  eventSource.addEventListener('library-updated', () => {
    for (const fn of listeners) fn();
  });

  eventSource.onerror = () => {
    eventSource.close();
    eventSource = null;
    // Reconnect after a short delay if there are still listeners
    if (listeners.size > 0) {
      setTimeout(ensureConnection, 3000);
    }
  };
}

function cleanup() {
  if (listeners.size === 0 && eventSource) {
    eventSource.close();
    eventSource = null;
  }
}

export function useLibraryEvents(callback) {
  onMounted(() => {
    listeners.add(callback);
    ensureConnection();
  });

  onUnmounted(() => {
    listeners.delete(callback);
    cleanup();
  });
}
