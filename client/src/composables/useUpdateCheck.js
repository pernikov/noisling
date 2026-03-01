import { ref, onMounted } from 'vue';

const GITHUB_RAW_URL = 'https://raw.githubusercontent.com/pernikov/noisling/main/package.json';
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function compareVersions(local, remote) {
  const a = local.split('.').map(Number);
  const b = remote.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((b[i] ?? 0) > (a[i] ?? 0)) return true;
    if ((b[i] ?? 0) < (a[i] ?? 0)) return false;
  }
  return false;
}

const hasUpdate = ref(false);
const latestVersion = ref(null);

async function checkForUpdate() {
  try {
    const res = await fetch(`${GITHUB_RAW_URL}?t=${Date.now()}`);
    if (!res.ok) return;
    const { version } = await res.json();
    latestVersion.value = version;
    hasUpdate.value = compareVersions(__APP_VERSION__, version);
  } catch {
    // silently ignore network errors
  }
}

export function useUpdateCheck() {
  onMounted(() => {
    checkForUpdate();
    const timer = setInterval(checkForUpdate, CHECK_INTERVAL_MS);
    return () => clearInterval(timer);
  });

  return { hasUpdate, latestVersion, localVersion: __APP_VERSION__ };
}
