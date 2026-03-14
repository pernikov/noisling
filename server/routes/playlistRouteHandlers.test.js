import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaylistRouteHandlers } from './playlistRouteHandlers.js';

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

test('listPlaylists returns playlist summaries with ordered unique covers', async () => {
  const playlists = [
    { _id: 'p1', name: 'Morning', trackIds: ['3', '1', '2'] },
  ];
  const Playlist = {
    find() {
      return {
        sort() {
          return {
            lean: async () => playlists,
          };
        },
      };
    },
  };
  const Track = {
    find() {
      return {
        lean: async () => [
          { _id: '1', cover: 'alpha.jpg' },
          { _id: '2', cover: null },
          { _id: '3', cover: 'beta.jpg' },
        ],
      };
    },
  };

  const { listPlaylists } = createPlaylistRouteHandlers({
    Playlist,
    Track,
    isValidObjectId: () => true,
  });

  const res = createRes();
  await listPlaylists({}, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, [
    {
      _id: 'p1',
      name: 'Morning',
      trackCount: 3,
      covers: ['beta.jpg', 'alpha.jpg'],
    },
  ]);
});

test('createPlaylist trims the name and returns 201', async () => {
  const Playlist = {
    create: async (payload) => payload,
  };
  const { createPlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track: {},
    isValidObjectId: () => true,
  });

  const req = { body: { name: '  Commute Mix  ' } };
  const res = createRes();
  await createPlaylist(req, res);

  assert.equal(res.statusCode, 201);
  assert.deepEqual(res.body, {
    name: 'Commute Mix',
    type: 'manual',
    trackIds: [],
  });
});

test('createPlaylist rejects missing names', async () => {
  const { createPlaylist } = createPlaylistRouteHandlers({
    Playlist: {},
    Track: {},
    isValidObjectId: () => true,
  });

  const res = createRes();
  await createPlaylist({ body: { name: '   ' } }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Name is required' });
});

test('getPlaylist returns 404 for invalid ids', async () => {
  const { getPlaylist } = createPlaylistRouteHandlers({
    Playlist: {},
    Track: {},
    isValidObjectId: () => false,
  });

  const res = createRes();
  await getPlaylist({ params: { id: 'bad-id' } }, res);

  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: 'Not found' });
});

test('getPlaylist preserves playlist track order and drops missing tracks', async () => {
  const Playlist = {
    findOne() {
      return {
        lean: async () => ({
          _id: 'p2',
          name: 'Night',
          trackIds: ['3', '1', 'missing', '2'],
        }),
      };
    },
  };
  const Track = {
    find() {
      return {
        lean: async () => [
          { _id: '1', title: 'One' },
          { _id: '2', title: 'Two' },
          { _id: '3', title: 'Three' },
        ],
      };
    },
  };

  const { getPlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track,
    isValidObjectId: () => true,
  });

  const res = createRes();
  await getPlaylist({ params: { id: '507f1f77bcf86cd799439011' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(
    res.body.tracks.map((track) => track.title),
    ['Three', 'One', 'Two'],
  );
});

test('updatePlaylist validates the id and trims the updated name', async () => {
  const playlist = {
    name: 'Old Name',
    trackIds: ['1'],
    save: async function () { return this; },
  };
  const Playlist = {
    findOne: async () => playlist,
  };

  const { updatePlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track: {},
    isValidObjectId: () => true,
  });

  const res = createRes();
  await updatePlaylist({
    params: { id: '507f1f77bcf86cd799439011' },
    body: { name: '  New Name  ', trackIds: ['2', '3'] },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(playlist.name, 'New Name');
  assert.deepEqual(playlist.trackIds, ['2', '3']);
});

test('updatePlaylist rejects invalid names and invalid trackIds payloads', async () => {
  const playlist = {
    save: async function () { return this; },
  };
  const Playlist = {
    findOne: async () => playlist,
  };

  const { updatePlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track: {},
    isValidObjectId: () => true,
  });

  let res = createRes();
  await updatePlaylist({
    params: { id: '507f1f77bcf86cd799439011' },
    body: { name: '   ' },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid name' });

  res = createRes();
  await updatePlaylist({
    params: { id: '507f1f77bcf86cd799439011' },
    body: { trackIds: 'nope' },
  }, res);
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'Invalid trackIds' });
});

test('deletePlaylist returns ok when a playlist is deleted', async () => {
  const Playlist = {
    findOneAndDelete: async () => ({ _id: 'p1' }),
  };

  const { deletePlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track: {},
    isValidObjectId: () => true,
  });

  const res = createRes();
  await deletePlaylist({ params: { id: '507f1f77bcf86cd799439011' } }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { ok: true });
});

test('addTracksToPlaylist dedupes entries and ignores invalid ids', async () => {
  const playlist = {
    trackIds: ['1', '2'],
    save: async function () { return this; },
  };
  const Playlist = {
    findOne: async () => playlist,
  };

  const { addTracksToPlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track: {},
    isValidObjectId: (id) => ['507f1f77bcf86cd799439011', '1', '2', '3'].includes(id),
  });

  const res = createRes();
  await addTracksToPlaylist({
    params: { id: '507f1f77bcf86cd799439011' },
    body: { trackIds: ['2', '3', 'bad-id'] },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(playlist.trackIds, ['1', '2', '3']);
});

test('addTracksToPlaylist rejects empty payloads', async () => {
  const { addTracksToPlaylist } = createPlaylistRouteHandlers({
    Playlist: { findOne: async () => ({}) },
    Track: {},
    isValidObjectId: () => true,
  });

  const res = createRes();
  await addTracksToPlaylist({
    params: { id: '507f1f77bcf86cd799439011' },
    body: { trackIds: [] },
  }, res);

  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: 'trackIds required' });
});

test('removeTrackFromPlaylist removes matching track ids and saves', async () => {
  const playlist = {
    trackIds: ['1', '2', '3'],
    save: async function () { return this; },
  };
  const Playlist = {
    findOne: async () => playlist,
  };

  const { removeTrackFromPlaylist } = createPlaylistRouteHandlers({
    Playlist,
    Track: {},
    isValidObjectId: () => true,
  });

  const res = createRes();
  await removeTrackFromPlaylist({
    params: { id: '507f1f77bcf86cd799439011', trackId: '2' },
  }, res);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(playlist.trackIds, ['1', '3']);
});
