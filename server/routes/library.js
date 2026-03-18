import { Router } from 'express';
import Track from '../models/Track.js';
import { createLibraryRouteHandlers } from './libraryRouteHandlers.js';
import { buildTrackOverrides, mergeTrackOverrides } from '../services/trackOverrides.js';
import { buildSearchRegex } from './libraryHelpers.js';
import { removeCoverIfUnused, saveCoverDataUrl } from '../services/coverStorage.js';

const router = Router();
const { searchLibrary, listAllTracks, listTracks } = createLibraryRouteHandlers({ Track });

async function loadResolvedTracks(filter = {}) {
  const tracks = await Track.find(filter).lean();
  return tracks.map(mergeTrackOverrides);
}

function effectiveField(field, fallback = `$${field}`) {
  return { $ifNull: [`$overrides.${field}`, fallback] };
}

function buildResolvedArtistMatch(norm) {
  return {
    $or: [
      { artistsNorm: norm },
      { 'overrides.artistsNorm': norm },
    ],
  };
}

function buildResolvedAlbumMatch(artistNorm, album) {
  return {
    $and: [
      buildResolvedArtistMatch(artistNorm),
      {
        $or: [
          { album },
          { 'overrides.album': album },
        ],
      },
    ],
  };
}

async function aggregateArtistSummaries({ search, page = 1, limit = 60, random = false } = {}) {
  const regex = buildSearchRegex(search);
  const paginationStages = random
    ? [{ $sample: { size: limit } }]
    : [{ $skip: (page - 1) * limit }, { $limit: limit }];

  const [result] = await Track.aggregate([
    {
      $project: {
        effectiveArtists: effectiveField('artists'),
        effectiveArtistsNorm: effectiveField('artistsNorm'),
        effectiveAlbum: effectiveField('album'),
        effectiveCover: effectiveField('cover'),
      },
    },
    {
      $unwind: {
        path: '$effectiveArtists',
        includeArrayIndex: 'artistIndex',
        preserveNullAndEmptyArrays: false,
      },
    },
    {
      $project: {
        name: '$effectiveArtists',
        artistNorm: {
          $ifNull: [
            { $arrayElemAt: ['$effectiveArtistsNorm', '$artistIndex'] },
            { $toLower: '$effectiveArtists' },
          ],
        },
        effectiveAlbum: 1,
        effectiveCover: 1,
      },
    },
    ...(regex ? [{ $match: { name: regex } }] : []),
    {
      $group: {
        _id: '$artistNorm',
        name: { $first: '$name' },
        albumSet: { $addToSet: '$effectiveAlbum' },
        trackCount: { $sum: 1 },
        coverSet: { $addToSet: '$effectiveCover' },
      },
    },
    {
      $project: {
        _id: 0,
        artistNorm: '$_id',
        name: 1,
        albumCount: {
          $size: {
            $filter: {
              input: '$albumSet',
              as: 'album',
              cond: { $and: [{ $ne: ['$$album', null] }, { $ne: ['$$album', ''] }] },
            },
          },
        },
        trackCount: 1,
        covers: {
          $filter: {
            input: '$coverSet',
            as: 'cover',
            cond: { $and: [{ $ne: ['$$cover', null] }, { $ne: ['$$cover', ''] }] },
          },
        },
      },
    },
    ...(random ? [] : [{ $sort: { name: 1 } }]),
    {
      $facet: {
        items: paginationStages,
        total: [{ $count: 'count' }],
      },
    },
  ]);

  return {
    items: result?.items ?? [],
    total: result?.total?.[0]?.count ?? 0,
  };
}

async function aggregateAlbumSummaries({ search, limit = null, sort = { name: 1 }, random = false } = {}) {
  const regex = buildSearchRegex(search);

  const albums = await Track.aggregate([
    {
      $project: {
        effectiveAlbum: effectiveField('album'),
        effectiveArtists: effectiveField('artists'),
        effectiveArtistsNorm: effectiveField('artistsNorm'),
        effectiveYear: effectiveField('year'),
        effectiveCover: effectiveField('cover'),
        scannedAt: 1,
        duration: { $ifNull: ['$duration', 0] },
        hasCustomCover: { $cond: [{ $ne: ['$overrides.cover', null] }, 1, 0] },
      },
    },
    ...(regex ? [{ $match: { effectiveAlbum: regex } }] : []),
    {
      $group: {
        _id: {
          artistNorm: { $arrayElemAt: ['$effectiveArtistsNorm', 0] },
          album: '$effectiveAlbum',
        },
        name: { $first: '$effectiveAlbum' },
        artists: { $first: '$effectiveArtists' },
        artistsNorm: { $first: '$effectiveArtistsNorm' },
        years: { $addToSet: '$effectiveYear' },
        covers: { $addToSet: '$effectiveCover' },
        hasCustomCover: { $max: '$hasCustomCover' },
        duration: { $sum: '$duration' },
        trackCount: { $sum: 1 },
        addedAt: { $max: '$scannedAt' },
      },
    },
    {
      $project: {
        _id: 0,
        name: 1,
        artists: 1,
        artistsNorm: 1,
        year: {
          $let: {
            vars: {
              filteredYears: {
                $filter: {
                  input: '$years',
                  as: 'year',
                  cond: { $gt: ['$$year', 0] },
                },
              },
            },
            in: { $ifNull: [{ $arrayElemAt: ['$$filteredYears', 0] }, 0] },
          },
        },
        trackCount: 1,
        cover: {
          $let: {
            vars: {
              filteredCovers: {
                $filter: {
                  input: '$covers',
                  as: 'cover',
                  cond: { $and: [{ $ne: ['$$cover', null] }, { $ne: ['$$cover', ''] }] },
                },
              },
            },
            in: { $ifNull: [{ $arrayElemAt: ['$$filteredCovers', 0] }, '' ] },
          },
        },
        hasCustomCover: { $toBool: '$hasCustomCover' },
        duration: 1,
        addedAt: 1,
      },
    },
    ...(random
      ? [{ $sample: { size: limit ?? 12 } }]
      : [{ $sort: sort }, ...(limit != null ? [{ $limit: limit }] : [])]),
  ]);

  return albums;
}

async function aggregateTopAlbumSummaries({ limit = 12 } = {}) {
  return Track.aggregate([
    {
      $project: {
        effectiveAlbum: effectiveField('album'),
        effectiveArtists: effectiveField('artists'),
        effectiveArtistsNorm: effectiveField('artistsNorm'),
        effectiveCover: effectiveField('cover'),
        scannedAt: 1,
        playCount: { $ifNull: ['$playCount', 0] },
      },
    },
    { $match: { playCount: { $gt: 0 } } },
    {
      $group: {
        _id: {
          artistNorm: { $arrayElemAt: ['$effectiveArtistsNorm', 0] },
          album: '$effectiveAlbum',
        },
        name: { $first: '$effectiveAlbum' },
        artists: { $first: '$effectiveArtists' },
        artistsNorm: { $first: '$effectiveArtistsNorm' },
        covers: { $addToSet: '$effectiveCover' },
        plays: { $sum: '$playCount' },
        addedAt: { $max: '$scannedAt' },
      },
    },
    {
      $project: {
        _id: 0,
        name: 1,
        artists: 1,
        artistsNorm: 1,
        cover: {
          $let: {
            vars: {
              filteredCovers: {
                $filter: {
                  input: '$covers',
                  as: 'cover',
                  cond: { $and: [{ $ne: ['$$cover', null] }, { $ne: ['$$cover', ''] }] },
                },
              },
            },
            in: { $ifNull: [{ $arrayElemAt: ['$$filteredCovers', 0] }, ''] },
          },
        },
        plays: 1,
        addedAt: 1,
      },
    },
    { $sort: { plays: -1, addedAt: -1, name: 1 } },
    { $limit: limit },
  ]);
}

function buildArtistSummaries(tracks) {
  const artistMap = new Map();

  for (const track of tracks) {
    const artists = Array.isArray(track.artists) ? track.artists : [];
    const artistsNorm = Array.isArray(track.artistsNorm) ? track.artistsNorm : [];

    artists.forEach((artist, index) => {
      const artistNorm = artistsNorm[index] ?? artist.toLowerCase();
      if (!artistMap.has(artistNorm)) {
        artistMap.set(artistNorm, {
          name: artist,
          albumSet: new Set(),
          trackCount: 0,
          coverSet: new Set(),
        });
      }

      const summary = artistMap.get(artistNorm);
      summary.albumSet.add(track.album);
      summary.trackCount += 1;
      if (track.cover) summary.coverSet.add(track.cover);
    });
  }

  return Array.from(artistMap.entries()).map(([artistNorm, summary]) => ({
    artistNorm,
    name: summary.name,
    albumCount: summary.albumSet.size,
    trackCount: summary.trackCount,
    covers: Array.from(summary.coverSet),
  }));
}

function buildAlbumSummaries(tracks) {
  const albumMap = new Map();

  for (const track of tracks) {
    const artistNorm = track.artistsNorm?.[0] ?? '';
    const key = `${artistNorm}__${track.album}`;

    if (!albumMap.has(key)) {
      albumMap.set(key, {
        name: track.album,
        artists: track.artists,
        artistsNorm: track.artistsNorm,
        year: track.year,
        trackCount: 0,
        cover: track.cover,
        hasCustomCover: false,
        duration: 0,
        addedAt: track.scannedAt,
      });
    }

    const summary = albumMap.get(key);
    summary.trackCount += 1;
    summary.duration += track.duration || 0;
    if (!summary.cover && track.cover) summary.cover = track.cover;
    if (!summary.year && track.year) summary.year = track.year;
    if (track.overrides?.cover) summary.hasCustomCover = true;
    if (!summary.addedAt || new Date(track.scannedAt) > new Date(summary.addedAt)) {
      summary.addedAt = track.scannedAt;
    }
  }

  return Array.from(albumMap.values());
}

function paginate(items, page, limit) {
  const skip = (page - 1) * limit;
  return items.slice(skip, skip + limit);
}

function sampleItems(items, limit) {
  const pool = items.slice();
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, limit);
}

// GET /api/search — global search across tracks, artists, and albums
router.get('/search', searchLibrary);

// GET /api/artists — list artists with counts (paginated, searchable)
router.get('/artists', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 60);
  const search = req.query.search?.trim();
  const { items, total } = await aggregateArtistSummaries({ search, page, limit });
  const artists = items.map(({ artistNorm: _artistNorm, ...artist }) => artist);
  res.json({ artists, total, page, limit });
});

// GET /api/artists/random — random sample of artists
router.get('/artists/random', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const { items } = await aggregateArtistSummaries({ limit, random: true });
  const artists = items.map(({ artistNorm: _artistNorm, ...artist }) => artist);
  res.json(artists);
});

// GET /api/artists/:name — artist detail with albums (paginated)
router.get('/artists/:name', async (req, res) => {
  const { name } = req.params;
  const norm  = name.toLowerCase();
  const page  = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const tracks = await loadResolvedTracks(buildResolvedArtistMatch(norm));
  const albums = buildAlbumSummaries(tracks)
    .sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name));
  const totalCount = albums.length;

  if (totalCount === 0) {
    return res.status(404).json({ error: 'Artist not found' });
  }

  res.json({ artist: name, albums: paginate(albums, page, limit), total: totalCount, page, limit });
});

// GET /api/artists/:name/tracks — all tracks for an artist
router.get('/artists/:name/tracks', async (req, res) => {
  const { name } = req.params;
  const norm = name.toLowerCase();
  const tracks = (await loadResolvedTracks(buildResolvedArtistMatch(norm)))
    .sort((a, b) => a.album.localeCompare(b.album) || (a.disc || 0) - (b.disc || 0) || (a.trackNumber || 0) - (b.trackNumber || 0));
  res.json(tracks);
});

// GET /api/albums/recent — recently added albums, sorted by scannedAt desc
router.get('/albums/recent', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const albums = await aggregateAlbumSummaries({ limit, sort: { addedAt: -1 } });
  res.json(albums);
});

// GET /api/albums/random — random sample of albums
router.get('/albums/random', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const albums = await aggregateAlbumSummaries({ limit, random: true });
  res.json(albums);
});

// GET /api/albums/top — most played albums
router.get('/albums/top', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const albums = await aggregateTopAlbumSummaries({ limit });
  res.json(albums);
});

// GET /api/albums — all albums
router.get('/albums', async (req, res) => {
  const albums = await aggregateAlbumSummaries({ sort: { name: 1 } });
  res.json(albums);
});

// GET /api/albums/:artist/:album — tracks in an album
router.get('/albums/:artist/:album', async (req, res) => {
  const { artist, album } = req.params;
  const norm = artist.toLowerCase();
  const resolvedTracks = (await loadResolvedTracks(buildResolvedAlbumMatch(norm, album)))
    .sort((a, b) => (a.disc || 0) - (b.disc || 0) || (a.trackNumber || 0) - (b.trackNumber || 0));

  if (resolvedTracks.length === 0) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const albumInfo = {
    name: resolvedTracks[0].album,
    artists: resolvedTracks[0].artists,
    year: resolvedTracks[0].year,
    cover: resolvedTracks[0].cover,
    hasCustomCover: resolvedTracks.some((track) => !!track.overrides?.cover),
    trackCount: resolvedTracks.length,
    duration: resolvedTracks.reduce((sum, t) => sum + t.duration, 0),
  };

  res.json({ album: albumInfo, tracks: resolvedTracks });
});

// GET /api/genres — distinct genres with track counts
router.get('/genres', async (req, res) => {
  const genres = await Track.aggregate([
    { $match: { genre: { $nin: [null, ''] } } },
    { $group: { _id: '$genre', trackCount: { $sum: 1 } } },
    // Trim whitespace and filter out whitespace-only values
    { $addFields: { trimmed: { $trim: { input: '$_id' } } } },
    { $match: { trimmed: { $ne: '' } } },
    { $project: { _id: 0, name: '$trimmed', raw: '$_id', trackCount: 1 } },
    { $sort: { name: 1 } },
  ]);
  res.json(genres);
});

// GET /api/tracks/all — all tracks unpaginated (for queue building, with optional search/genre)
router.get('/tracks/all', listAllTracks);

// GET /api/tracks — all tracks (with optional pagination, search and sort)
router.get('/tracks', listTracks);

// GET /api/tracks/recent — recently played tracks, deduped, sorted by lastPlayedAt
router.get('/tracks/recent', async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const tracks = await Track.find({ lastPlayedAt: { $ne: null } })
    .sort({ lastPlayedAt: -1 })
    .limit(limit)
    .lean();
  res.json(tracks.map(mergeTrackOverrides));
});

// GET /api/stats — library and listening statistics
router.get('/stats', async (req, res) => {
  const [result] = await Track.aggregate([
    {
      $facet: {
        overview: [
          {
            $group: {
              _id: null,
              totalTracks: { $sum: 1 },
              totalDuration: { $sum: '$duration' },
              totalPlays: { $sum: '$playCount' },
              totalFileSize: { $sum: '$fileSize' },
              totalLoved: { $sum: { $cond: ['$isLoved', 1, 0] } },
              artists: { $addToSet: { $arrayElemAt: ['$artistsNorm', 0] } },
              albums: { $addToSet: '$album' },
            },
          },
          {
            $project: {
              _id: 0,
              totalTracks: 1,
              totalDuration: 1,
              totalPlays: 1,
              totalFileSize: 1,
              totalLoved: 1,
              totalArtists: { $size: '$artists' },
              totalAlbums: { $size: '$albums' },
            },
          },
        ],
        formats: [
          { $group: { _id: '$format', count: { $sum: 1 } } },
          { $project: { _id: 0, format: '$_id', count: 1 } },
          { $sort: { count: -1 } },
        ],
        topTracks: [
          { $match: { playCount: { $gt: 0 } } },
          { $sort: { playCount: -1 } },
          { $limit: 10 },
          { $project: { title: 1, artists: 1, album: 1, cover: 1, duration: 1, playCount: 1, isLoved: 1 } },
        ],
        topArtists: [
          { $match: { playCount: { $gt: 0 } } },
          { $unwind: '$artists' },
          {
            $group: {
              _id: '$artists',
              plays: { $sum: '$playCount' },
              trackCount: { $sum: 1 },
            },
          },
          { $sort: { plays: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, name: '$_id', plays: 1, trackCount: 1 } },
        ],
        topAlbums: [
          { $match: { playCount: { $gt: 0 } } },
          {
            $group: {
              _id: {
                name: '$album',
                artistNorm: { $arrayElemAt: ['$artistsNorm', 0] },
              },
              artists: { $first: '$artists' },
              cover: { $first: '$cover' },
              plays: { $sum: '$playCount' },
            },
          },
          { $sort: { plays: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, name: '$_id.name', artists: 1, cover: 1, plays: 1 } },
        ],
      },
    },
  ]);

  const overview = result.overview[0] || {
    totalTracks: 0, totalArtists: 0, totalAlbums: 0,
    totalDuration: 0, totalPlays: 0, totalFileSize: 0, totalLoved: 0,
  };

  res.json({
    ...overview,
    formats: result.formats,
    topTracks: result.topTracks,
    topArtists: result.topArtists,
    topAlbums: result.topAlbums,
  });
});

// GET /api/tracks/loved — all loved tracks
router.get('/tracks/loved', async (req, res) => {
  const tracks = await Track.find({ isLoved: true })
    .sort({ artistsNorm: 1, album: 1, disc: 1, trackNumber: 1 })
    .lean();
  res.json(tracks.map(mergeTrackOverrides));
});

// PATCH /api/tracks/:id/love — toggle loved status
router.patch('/tracks/:id/love', async (req, res) => {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  track.isLoved = !track.isLoved;
  await track.save();
  res.json({ isLoved: track.isLoved });
});

// PATCH /api/albums/:artist/:album/cover — save a custom local cover override
router.patch('/albums/:artist/:album/cover', async (req, res) => {
  const dataUrl = req.body?.dataUrl;
  if (!dataUrl) return res.status(400).json({ error: 'Image data is required.' });

  let coverFilename;
  try {
    coverFilename = await saveCoverDataUrl(dataUrl);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const norm = req.params.artist.toLowerCase();
  const album = req.params.album;
  const tracks = await loadResolvedTracks(buildResolvedAlbumMatch(norm, album));

  if (!tracks.length) {
    await removeCoverIfUnused(coverFilename);
    return res.status(404).json({ error: 'Album not found' });
  }

  const oldOverrideCovers = new Set(tracks.map((track) => track.overrides?.cover).filter(Boolean));

  await Track.updateMany(
    { _id: { $in: tracks.map((track) => track._id) } },
    { $set: { 'overrides.cover': coverFilename, 'overrides.updatedAt': new Date() } },
  );

  for (const oldCover of oldOverrideCovers) {
    if (oldCover === coverFilename) continue;
    await removeCoverIfUnused(oldCover);
  }

  res.json({ cover: coverFilename });
});

// DELETE /api/albums/:artist/:album/cover — clear a custom local cover override
router.delete('/albums/:artist/:album/cover', async (req, res) => {
  const norm = req.params.artist.toLowerCase();
  const album = req.params.album;
  const tracks = await loadResolvedTracks(buildResolvedAlbumMatch(norm, album));

  if (!tracks.length) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const oldOverrideCovers = new Set(tracks.map((track) => track.overrides?.cover).filter(Boolean));

  await Track.updateMany(
    { _id: { $in: tracks.map((track) => track._id) } },
    { $unset: { 'overrides.cover': 1 } },
  );

  for (const oldCover of oldOverrideCovers) {
    await removeCoverIfUnused(oldCover);
  }

  res.json({ ok: true });
});

// PATCH /api/tracks/:id/overrides — save local metadata overrides
router.patch('/tracks/:id/overrides', async (req, res) => {
  let overrides;
  try {
    overrides = buildTrackOverrides(req.body ?? {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  if (!Object.keys(overrides).length) {
    return res.status(400).json({ error: 'No override fields provided.' });
  }

  const update = Object.fromEntries(
    Object.entries(overrides).map(([field, value]) => [`overrides.${field}`, value]),
  );
  update['overrides.updatedAt'] = new Date();

  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { $set: update },
    { new: true },
  ).lean();

  if (!track) return res.status(404).json({ error: 'Track not found' });
  res.json(mergeTrackOverrides(track));
});

// DELETE /api/tracks/:id/overrides/metadata — clear local metadata overrides but preserve artwork overrides
router.delete('/tracks/:id/overrides/metadata', async (req, res) => {
  const update = {
    $unset: {
      'overrides.title': 1,
      'overrides.artists': 1,
      'overrides.artistsNorm': 1,
      'overrides.albumArtist': 1,
      'overrides.album': 1,
      'overrides.trackNumber': 1,
      'overrides.year': 1,
    },
  };

  const track = await Track.findByIdAndUpdate(req.params.id, update, { new: true }).lean();

  if (!track) return res.status(404).json({ error: 'Track not found' });
  res.json(mergeTrackOverrides(track));
});

// DELETE /api/tracks/:id/overrides — clear all local metadata overrides
router.delete('/tracks/:id/overrides', async (req, res) => {
  const track = await Track.findByIdAndUpdate(
    req.params.id,
    { $unset: { overrides: 1 } },
    { new: true },
  ).lean();

  if (!track) return res.status(404).json({ error: 'Track not found' });
  res.json(mergeTrackOverrides(track));
});

// GET /api/tracks/:id — single track
router.get('/tracks/:id', async (req, res) => {
  const track = await Track.findById(req.params.id).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });
  res.json(mergeTrackOverrides(track));
});

// POST /api/tracks/batch — fetch multiple tracks by ID, preserving order
router.post('/tracks/batch', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || !ids.length) return res.json([]);
  const tracks = await Track.find({ _id: { $in: ids } }).lean();
  const order  = Object.fromEntries(ids.map((id, i) => [id, i]));
  tracks.sort((a, b) => order[a._id.toString()] - order[b._id.toString()]);
  res.json(tracks.map(mergeTrackOverrides));
});

export default router;
