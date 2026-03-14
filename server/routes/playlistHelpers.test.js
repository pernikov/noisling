import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCoverByTrack,
  buildPlaylistSummary,
  collectPlaylistCovers,
  orderPlaylistTracks,
} from './playlistHelpers.js';

test('buildCoverByTrack maps track ids to covers and normalizes missing covers to null', () => {
  assert.deepEqual(
    buildCoverByTrack([
      { _id: '1', cover: 'a.jpg' },
      { _id: '2', cover: '' },
      { _id: '3' },
    ]),
    {
      '1': 'a.jpg',
      '2': null,
      '3': null,
    },
  );
});

test('collectPlaylistCovers preserves playlist order and removes duplicates', () => {
  const covers = collectPlaylistCovers(
    ['2', '1', '3', '4', '1'],
    {
      '1': 'alpha.jpg',
      '2': 'beta.jpg',
      '3': 'alpha.jpg',
      '4': null,
    },
    10,
  );

  assert.deepEqual(covers, ['beta.jpg', 'alpha.jpg']);
});

test('collectPlaylistCovers respects the maximum cover limit', () => {
  const covers = collectPlaylistCovers(
    ['1', '2', '3'],
    {
      '1': 'one.jpg',
      '2': 'two.jpg',
      '3': 'three.jpg',
    },
    2,
  );

  assert.deepEqual(covers, ['one.jpg', 'two.jpg']);
});

test('buildPlaylistSummary returns the list response shape', () => {
  const summary = buildPlaylistSummary(
    {
      _id: 'playlist-1',
      name: 'Night Bus',
      trackIds: ['3', '1', '2'],
    },
    {
      '1': 'alpha.jpg',
      '2': null,
      '3': 'beta.jpg',
    },
  );

  assert.deepEqual(summary, {
    _id: 'playlist-1',
    name: 'Night Bus',
    trackCount: 3,
    covers: ['beta.jpg', 'alpha.jpg'],
  });
});

test('orderPlaylistTracks restores playlist order and drops missing tracks', () => {
  const tracks = orderPlaylistTracks(
    ['3', '1', 'missing', '2'],
    [
      { _id: '1', title: 'First' },
      { _id: '2', title: 'Second' },
      { _id: '3', title: 'Third' },
    ],
  );

  assert.deepEqual(
    tracks.map((track) => track.title),
    ['Third', 'First', 'Second'],
  );
});
