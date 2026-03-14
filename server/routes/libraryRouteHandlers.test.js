import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryRouteHandlers } from './libraryRouteHandlers.js';

function createRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

test('searchLibrary returns empty sections when the query is blank', async () => {
  const { searchLibrary } = createLibraryRouteHandlers({ Track: {} });
  const res = createRes();

  await searchLibrary({ query: { q: '   ' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { tracks: [], artists: [], albums: [] });
});

test('searchLibrary runs track and aggregate queries with the capped limit', async () => {
  let trackFindFilter;
  let trackFindSort;
  let trackFindLimit;
  let trackFindSelect;
  const aggregateCalls = [];

  const Track = {
    find(filter) {
      trackFindFilter = filter;
      return {
        sort(sort) {
          trackFindSort = sort;
          return {
            limit(limit) {
              trackFindLimit = limit;
              return {
                select(select) {
                  trackFindSelect = select;
                  return {
                    lean: async () => [{ _id: 'track-1', title: 'Track 1' }],
                  };
                },
              };
            },
          };
        },
      };
    },
    aggregate(pipeline) {
      aggregateCalls.push(pipeline);
      return Promise.resolve(aggregateCalls.length === 1 ? [{ name: 'Artist' }] : [{ name: 'Album' }]);
    },
  };

  const { searchLibrary } = createLibraryRouteHandlers({ Track });
  const res = createRes();
  await searchLibrary({ query: { q: 'Burial', limit: '99' } }, res);

  assert.equal(trackFindLimit, 8);
  assert.deepEqual(trackFindSort, { title: 1 });
  assert.equal(trackFindSelect, 'title artists album cover duration');
  assert.ok(trackFindFilter.$or);
  assert.equal(trackFindFilter.$or[0].title.source, 'Burial');
  assert.equal(aggregateCalls.length, 2);
  assert.deepEqual(res.body, {
    tracks: [{ _id: 'track-1', title: 'Track 1', hasOverrides: false, overrideFields: [] }],
    artists: [{ name: 'Artist' }],
    albums: [{ name: 'Album' }],
  });
});

test('listAllTracks builds the expected filter and sort for search and genre', async () => {
  let capturedFilter;
  let capturedSort;

  const Track = {
    find(filter) {
      capturedFilter = filter;
      return {
        sort(sort) {
          capturedSort = sort;
          return {
            lean: async () => [{ _id: '1', title: 'First' }],
          };
        },
      };
    },
  };

  const { listAllTracks } = createLibraryRouteHandlers({ Track });
  const res = createRes();
  await listAllTracks({
    query: { search: 'ambient', genre: ' drone ', sort: 'plays', order: 'desc' },
  }, res);

  assert.equal(capturedFilter.genre, 'drone');
  assert.equal(capturedFilter.$or[0].title.source, 'ambient');
  assert.deepEqual(capturedSort, { playCount: -1 });
  assert.deepEqual(res.body, [{ _id: '1', title: 'First', hasOverrides: false, overrideFields: [] }]);
});

test('listTracks applies pagination defaults and returns page metadata', async () => {
  let capturedFilter;
  let capturedSort;
  let capturedSkip;
  let capturedLimit;
  let countFilter;

  const Track = {
    find(filter) {
      capturedFilter = filter;
      return {
        sort(sort) {
          capturedSort = sort;
          return {
            skip(skip) {
              capturedSkip = skip;
              return {
                limit(limit) {
                  capturedLimit = limit;
                  return {
                    lean: async () => [{ _id: 'track-1', title: 'Track 1' }],
                  };
                },
              };
            },
          };
        },
      };
    },
    countDocuments(filter) {
      countFilter = filter;
      return Promise.resolve(42);
    },
  };

  const { listTracks } = createLibraryRouteHandlers({ Track });
  const res = createRes();
  await listTracks({
    query: { page: '3', limit: '10', search: 'garage', sort: 'artist', order: 'asc' },
  }, res);

  assert.equal(capturedFilter.$or[0].title.source, 'garage');
  assert.deepEqual(capturedSort, { artistsNorm: 1, album: 1, disc: 1, trackNumber: 1 });
  assert.equal(capturedSkip, 20);
  assert.equal(capturedLimit, 10);
  assert.deepEqual(countFilter, capturedFilter);
  assert.deepEqual(res.body, {
    tracks: [{ _id: 'track-1', title: 'Track 1', hasOverrides: false, overrideFields: [] }],
    total: 42,
    page: 3,
    limit: 10,
  });
});

test('listTracks resolves override fields before responding', async () => {
  const Track = {
    find() {
      return {
        sort() {
          return {
            skip() {
              return {
                limit() {
                  return {
                    lean: async () => [{
                      _id: 'track-2',
                      title: 'Old Title',
                      artists: ['Unknown Artist'],
                      artistsNorm: ['unknown artist'],
                      album: 'Unknown Album',
                      trackNumber: 0,
                      year: 0,
                      overrides: {
                        title: 'New Title',
                        artists: ['Burial'],
                        artistsNorm: ['burial'],
                        album: 'Untrue',
                        trackNumber: 2,
                      },
                    }],
                  };
                },
              };
            },
          };
        },
      };
    },
    countDocuments() {
      return Promise.resolve(1);
    },
  };

  const { listTracks } = createLibraryRouteHandlers({ Track });
  const res = createRes();
  await listTracks({ query: {} }, res);

  assert.deepEqual(res.body.tracks[0], {
    _id: 'track-2',
    title: 'New Title',
    artists: ['Burial'],
    artistsNorm: ['burial'],
    album: 'Untrue',
    albumArtist: undefined,
    trackNumber: 2,
    cover: undefined,
    year: 0,
    overrides: {
      title: 'New Title',
      artists: ['Burial'],
      artistsNorm: ['burial'],
      album: 'Untrue',
      trackNumber: 2,
    },
    hasOverrides: true,
    overrideFields: ['title', 'artists', 'artistsNorm', 'album', 'trackNumber'],
  });
});
