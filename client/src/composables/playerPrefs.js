const PREFS_KEY = 'noisling_player';

export function readPlayerPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
  } catch (_) {
    return {};
  }
}

export function writePlayerPrefs(updates) {
  const prefs = {
    ...readPlayerPrefs(),
    ...updates,
  };

  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (_) {}
}
