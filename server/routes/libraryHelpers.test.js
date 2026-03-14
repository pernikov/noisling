import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSearchRegex,
  buildSort,
  buildTrackFilter,
  escapeRegex,
  VALID_SORT_FIELDS,
} from './libraryHelpers.js';

test('VALID_SORT_FIELDS exposes the supported route sort keys', () => {
  assert.deepEqual(VALID_SORT_FIELDS, [
    'title',
    'artist',
    'album',
    'plays',
    'lastPlayed',
    'added',
    'duration',
  ]);
});

test('buildSort returns the expected default sort', () => {
  assert.deepEqual(buildSort('', 'asc'), {
    artistsNorm: 1,
    album: 1,
    disc: 1,
    trackNumber: 1,
  });
});

test('buildSort returns descending artist sort with stable album ordering', () => {
  assert.deepEqual(buildSort('artist', 'desc'), {
    artistsNorm: -1,
    album: 1,
    disc: 1,
    trackNumber: 1,
  });
});

test('buildSort maps play and duration sorts to the stored fields', () => {
  assert.deepEqual(buildSort('plays', 'desc'), { playCount: -1 });
  assert.deepEqual(buildSort('duration', 'asc'), { duration: 1 });
});

test('escapeRegex escapes special regex characters safely', () => {
  assert.equal(
    escapeRegex('dream.pop+(live)?[2024]'),
    'dream\\.pop\\+\\(live\\)\\?\\[2024\\]',
  );
});

test('buildSearchRegex returns null for empty input and a case-insensitive regex for values', () => {
  assert.equal(buildSearchRegex('   '), null);

  const regex = buildSearchRegex('Burial (Live)');
  assert.ok(regex instanceof RegExp);
  assert.equal(regex.flags, 'i');
  assert.equal(regex.source, 'Burial \\(Live\\)');
});

test('buildTrackFilter returns an empty filter when no search or genre is provided', () => {
  assert.deepEqual(buildTrackFilter(), {});
});

test('buildTrackFilter includes a shared regex across title, artists, and album search fields', () => {
  const filter = buildTrackFilter({ search: 'Dream Pop' });
  assert.ok(Array.isArray(filter.$or));
  assert.equal(filter.$or.length, 3);
  assert.deepEqual(
    filter.$or.map((entry) => Object.keys(entry)[0]),
    ['title', 'artists', 'album'],
  );
  assert.equal(filter.$or[0].title.source, 'Dream Pop');
  assert.equal(filter.$or[1].artists, filter.$or[0].title);
  assert.equal(filter.$or[2].album, filter.$or[0].title);
});

test('buildTrackFilter trims and includes genre alongside search', () => {
  const filter = buildTrackFilter({ search: 'ambient', genre: '  drone  ' });
  assert.equal(filter.genre, 'drone');
  assert.ok(filter.$or);
});
