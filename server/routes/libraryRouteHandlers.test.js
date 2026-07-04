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

test('searchLibrary returns capped search sections from resolved tracks', async () => {
  let trackFindFilter;
  let trackFindSort;
  let trackFindLimit;
  let findCalled = 0;

  const Track = {
    find(filter) {
      findCalled += 1;
      trackFindFilter = filter;
      return {
        lean: async () => [
          { _id: 'track-1', title: 'Track 1', artists: ['Artist'], album: 'Album', cover: 'cover.jpg', duration: 10, artistsNorm: ['artist'] },
        ],
      };
    },
  };

  const { searchLibrary } = createLibraryRouteHandlers({ Track });
  const res = createRes();
  await searchLibrary({ query: { q: 'Burial', limit: '99' } }, res);

  assert.equal(findCalled, 1);
  assert.equal(trackFindFilter.constructor, Object);
  assert.deepEqual(res.body, {
    tracks: [],
    artists: [],
    albums: [],
  });
});

test('searchLibrary matches overridden track, artist, and album values', async () => {
  const Track = {
    find() {
      return {
        lean: async () => [{
          _id: 'track-2',
          title: 'Scanned Title',
          artists: ['Unknown Artist'],
          artistsNorm: ['unknown artist'],
          album: 'Unknown Album',
          cover: 'cover.png',
          duration: 123,
          year: 2024,
          overrides: {
            title: 'Override Title',
            artists: ['Comma, Artist'],
            artistsNorm: ['comma, artist'],
            album: 'Override Album',
            releaseType: 'EP',
          },
        }],
      };
    },
  };

  const { searchLibrary } = createLibraryRouteHandlers({ Track });

  const tracksRes = createRes();
  await searchLibrary({ query: { q: 'Override', limit: '10' } }, tracksRes);
  assert.equal(tracksRes.body.tracks[0].title, 'Override Title');
  assert.equal(tracksRes.body.albums[0].name, 'Override Album');
  assert.equal(tracksRes.body.albums[0].releaseType, 'EP');

  const artistsRes = createRes();
  await searchLibrary({ query: { q: 'Comma, Artist', limit: '10' } }, artistsRes);
  assert.equal(artistsRes.body.artists[0].name, 'Comma, Artist');
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
    query: { search: 'ambient', genre: ' drone ', sort: 'lastPlayed', order: 'desc' },
  }, res);

  assert.equal(capturedFilter.genre, 'drone');
  assert.equal(capturedFilter.$or[0].title.source, 'ambient');
  assert.deepEqual(capturedSort, { lastPlayedAt: -1 });
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
                      releaseType: 'Album',
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
    releaseType: 'Album',
    trackNumber: 2,
    cover: undefined,
    year: 0,
    overrides: {
      title: 'New Title',
      artists: ['Burial'],
      artistsNorm: ['burial'],
      album: 'Untrue',
      releaseType: 'Album',
      trackNumber: 2,
    },
    hasOverrides: true,
    overrideFields: ['title', 'artists', 'artistsNorm', 'album', 'releaseType', 'trackNumber'],
  });
});
