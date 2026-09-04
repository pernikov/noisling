import { createApp, nextTick } from 'vue';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import GlobalSearch from './GlobalSearch.vue';

const api = vi.hoisted(() => ({
  globalSearch: vi.fn(),
  coverUrl: vi.fn(() => ''),
}));

vi.mock('../composables/useApi.js', () => ({ useApi: () => api }));
vi.mock('../composables/usePlayer.js', () => ({
  usePlayer: () => ({ playAlbum: vi.fn(), playNext: vi.fn(), addToQueue: vi.fn() }),
}));
vi.mock('../composables/useToast.js', () => ({ useToast: () => ({ show: vi.fn() }) }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));

let app;

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

async function enterSearch(value) {
  const input = document.querySelector('input');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}

beforeEach(async () => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="app"></div>';
  app = createApp(GlobalSearch);
  app.mount('#app');
  document.querySelector('[aria-label="Search"]').click();
  await nextTick();
});

afterEach(() => {
  app.unmount();
  vi.useRealTimers();
  vi.clearAllMocks();
});

test('keeps the newest results when an older search finishes last', async () => {
  const oldSearch = deferred();
  const newSearch = deferred();
  api.globalSearch.mockImplementation((query) => query === 'old' ? oldSearch.promise : newSearch.promise);

  await enterSearch('old');
  vi.advanceTimersByTime(300);
  await enterSearch('new');
  vi.advanceTimersByTime(300);

  newSearch.resolve({ tracks: [{ _id: 'new', title: 'New result', artists: [] }], artists: [], albums: [] });
  await nextTick();
  oldSearch.resolve({ tracks: [{ _id: 'old', title: 'Old result', artists: [] }], artists: [], albums: [] });
  await nextTick();

  expect(document.body.textContent).toContain('New result');
  expect(document.body.textContent).not.toContain('Old result');
});

test('does not restore results after search is closed', async () => {
  const pendingSearch = deferred();
  api.globalSearch.mockReturnValue(pendingSearch.promise);

  await enterSearch('pending');
  vi.advanceTimersByTime(300);
  document.querySelector('[aria-label="Close search"]').click();
  await nextTick();
  pendingSearch.resolve({ tracks: [{ _id: 'late', title: 'Late result', artists: [] }], artists: [], albums: [] });
  await nextTick();

  expect(document.body.textContent).not.toContain('Late result');
});
