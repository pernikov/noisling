import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSettingsResponse,
  buildSettingsUpdate,
  normalizeVizMode,
} from './settingsHelpers.js';

test('buildSettingsResponse fills defaults for missing optional settings', () => {
  const response = buildSettingsResponse({
    accentColor: 'violet',
    volume: 1,
    shuffle: false,
    repeatMode: 'off',
  });

  assert.equal(response.themeColor, 'none');
  assert.equal(response.density, 'comfortable');
  assert.deepEqual(response.tracksSort, { field: 'artist', dir: 'asc' });
  assert.equal(response.vizMode, 'spiral');
  assert.equal(response.showPlaylists, true);
});

test('buildSettingsResponse preserves valid tracksSort and preset values', () => {
  const response = buildSettingsResponse({
    accentColor: 'sky',
    volume: 0.5,
    shuffle: true,
    repeatMode: 'all',
    tracksSort: { field: 'plays', dir: 'desc' },
    butterchurnPresetMode: 'single',
    butterchurnPreset: 'Custom Preset',
  });

  assert.deepEqual(response.tracksSort, { field: 'plays', dir: 'desc' });
  assert.equal(response.butterchurnPresetMode, 'single');
  assert.equal(response.butterchurnPreset, 'Custom Preset');
});

test('normalizeVizMode maps nebula to pills', () => {
  assert.equal(normalizeVizMode('nebula'), 'pills');
  assert.equal(normalizeVizMode('spiral'), 'spiral');
});

test('buildSettingsUpdate validates and normalizes a mixed patch payload', () => {
  const result = buildSettingsUpdate({
    accentColor: 'amber',
    volume: 0.4,
    tracksColumns: { artist: 0, album: 1, plays: true, ignored: true },
    tracksSort: { field: 'title', dir: 'desc' },
    vizMode: 'nebula',
    butterchurnPresetMode: 'random',
    showPlaylists: 1,
    reduceMotion: 0,
  });

  assert.deepEqual(result, {
    update: {
      accentColor: 'amber',
      volume: 0.4,
      tracksColumns: { artist: false, album: true, plays: true },
      tracksSort: { field: 'title', dir: 'desc' },
      vizMode: 'pills',
      butterchurnPresetMode: 'random',
      showPlaylists: true,
      reduceMotion: false,
    },
  });
});

test('buildSettingsUpdate rejects invalid payloads and empty updates', () => {
  assert.deepEqual(buildSettingsUpdate({ accentColor: 'pink' }), { error: 'Invalid color' });
  assert.deepEqual(buildSettingsUpdate({ volume: 2 }), { error: 'Invalid volume' });
  assert.deepEqual(buildSettingsUpdate({ tracksSort: { field: 'nope', dir: 'asc' } }), { error: 'Invalid tracksSort' });
  assert.deepEqual(buildSettingsUpdate({ butterchurnPreset: '   ' }), { error: 'Invalid butterchurnPreset' });
  assert.deepEqual(buildSettingsUpdate({}), { error: 'No valid fields' });
});
