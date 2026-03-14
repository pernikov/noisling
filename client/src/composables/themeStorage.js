export function readStoredValue(key) {
  return localStorage.getItem(key);
}

export function readStoredBool(key, defaultValue = true) {
  const value = localStorage.getItem(key);
  return value === null ? defaultValue : value !== 'false';
}

export function readStoredJson(key, fallback) {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key)) };
  } catch {
    return { ...fallback };
  }
}

export function writeStoredValue(key, value) {
  localStorage.setItem(key, value);
}

export function writeStoredBool(key, value) {
  localStorage.setItem(key, String(value));
}

export function writeStoredJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}
