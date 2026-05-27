import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlbumSummaries } from './albumGrouping.js';

test('buildAlbumSummaries groups tracks by album artist before track artist', () => {
  const summaries = buildAlbumSummaries([
    {
      title: 'Родена такава',
      artists: ['Dara'],
      artistsNorm: ['dara'],
      albumArtist: 'Dara',
      album: 'Родена Такава',
      duration: 204,
      trackNumber: 1,
      year: 2022,
    },
    {
      title: 'SOSA MAJE',
      artists: ['V:RGO', 'Dara'],
      artistsNorm: ['v:rgo', 'dara'],
      albumArtist: 'Dara',
      album: 'Родена Такава',
      duration: 190,
      trackNumber: 9,
      year: 2022,
    },
  ]);

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].name, 'Родена Такава');
  assert.deepEqual(summaries[0].artists, ['Dara']);
  assert.deepEqual(summaries[0].artistsNorm, ['dara']);
  assert.equal(summaries[0].albumArtist, 'Dara');
  assert.equal(summaries[0].albumArtistNorm, 'dara');
  assert.equal(summaries[0].trackCount, 2);
  assert.equal(summaries[0].duration, 394);
});

test('buildAlbumSummaries falls back to first track artist when album artist is missing', () => {
  const summaries = buildAlbumSummaries([
    {
      title: 'One',
      artists: ['Artist A'],
      artistsNorm: ['artist a'],
      albumArtist: '',
      album: 'Shared Title',
    },
    {
      title: 'Two',
      artists: ['Artist B'],
      artistsNorm: ['artist b'],
      albumArtist: '',
      album: 'Shared Title',
    },
  ]);

  assert.equal(summaries.length, 2);
  assert.deepEqual(
    summaries.map((album) => album.albumArtist),
    ['', ''],
  );
  assert.deepEqual(
    summaries.map((album) => album.albumArtistNorm).sort(),
    ['artist a', 'artist b'],
  );
});
