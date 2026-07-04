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
  });

  assert.equal(response.themeColor, 'none');
  assert.equal(response.fontSize, 'medium');
  assert.deepEqual(response.tracksSort, { field: 'artist', dir: 'asc' });
  assert.equal(response.vizMode, 'pills');
  assert.equal(response.homeAlbumsMode, 'recent');
});

test('buildSettingsResponse preserves valid tracksSort and preset values', () => {
  const response = buildSettingsResponse({
    accentColor: 'sky',
    volume: 0.5,
    tracksSort: { field: 'lastPlayed', dir: 'desc' },
    homeAlbumsMode: 'random',
    butterchurnPresetMode: 'single',
    butterchurnPreset: 'Custom Preset',
  });

  assert.deepEqual(response.tracksSort, { field: 'lastPlayed', dir: 'desc' });
  assert.equal(response.homeAlbumsMode, 'random');
  assert.equal(response.butterchurnPresetMode, 'single');
  assert.equal(response.butterchurnPreset, 'Custom Preset');
});

test('normalizeVizMode maps legacy visualizer values', () => {
  assert.equal(normalizeVizMode('nebula'), 'pills');
  assert.equal(normalizeVizMode('spiral'), 'nucleus');
  assert.equal(normalizeVizMode('orb'), 'nucleus');
  assert.equal(normalizeVizMode('nucleus'), 'nucleus');
});

test('buildSettingsUpdate validates and normalizes a mixed patch payload', () => {
  const result = buildSettingsUpdate({
    accentColor: 'amber',
    volume: 0.4,
    fontSize: 'large',
    tracksSort: { field: 'title', dir: 'desc' },
    homeAlbumsMode: 'random',
    vizMode: 'nebula',
    butterchurnPresetMode: 'random',
    wideLayout: 1,
    reduceMotion: 0,
  });

  assert.deepEqual(result, {
    update: {
      accentColor: 'amber',
      volume: 0.4,
      fontSize: 'large',
      tracksSort: { field: 'title', dir: 'desc' },
      homeAlbumsMode: 'random',
      vizMode: 'pills',
      butterchurnPresetMode: 'random',
      wideLayout: true,
      reduceMotion: false,
    },
  });
});

test('buildSettingsUpdate rejects invalid payloads and empty updates', () => {
  assert.deepEqual(buildSettingsUpdate({ accentColor: 'pink' }), { error: 'Invalid color' });
  assert.deepEqual(buildSettingsUpdate({ volume: 2 }), { error: 'Invalid volume' });
  assert.deepEqual(buildSettingsUpdate({ tracksSort: { field: 'nope', dir: 'asc' } }), { error: 'Invalid tracksSort' });
  assert.deepEqual(buildSettingsUpdate({ homeAlbumsMode: 'latest' }), { error: 'Invalid homeAlbumsMode' });
  assert.deepEqual(buildSettingsUpdate({ butterchurnPreset: '   ' }), { error: 'Invalid butterchurnPreset' });
  assert.deepEqual(buildSettingsUpdate({}), { error: 'No valid fields' });
});
