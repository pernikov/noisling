import { Router } from 'express';
import Track from '../models/Track.js';

const router = Router();

// GET /api/artists — list artists with counts (paginated, searchable)
router.get('/artists', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 60);
  const skip = (page - 1) * limit;
  const search = req.query.search?.trim();

  const pipeline = [
    {
      $project: {
        _id: 0,
        artist: { $arrayElemAt: ['$artists', 0] },
        artistNorm: { $arrayElemAt: ['$artistsNorm', 0] },
        pairs: {
          $zip: { inputs: ['$artists', '$artistsNorm'] },
        },
        album: 1,
        cover: 1,
      },
    },
    { $unwind: '$pairs' },
    {
      $group: {
        _id: { $arrayElemAt: ['$pairs', 1] },
        name: { $first: { $arrayElemAt: ['$pairs', 0] } },
        albumCount: { $addToSet: '$album' },
        trackCount: { $sum: 1 },
        covers: { $addToSet: '$cover' },
      },
    },
    {
      $project: {
        _id: 0,
        name: 1,
        albumCount: { $size: '$albumCount' },
        trackCount: 1,
        covers: {
          $filter: { input: '$covers', cond: { $ne: ['$$this', ''] } },
        },
      },
    },
  ];

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    pipeline.push({ $match: { name: regex } });
  }

  pipeline.push(
    { $sort: { name: 1 } },
    {
      $facet: {
        artists: [{ $skip: skip }, { $limit: limit }],
        count: [{ $count: 'total' }],
      },
    },
  );

  const [result] = await Track.aggregate(pipeline);

  const artists = result.artists;
  const total = result.count[0]?.total || 0;
  res.json({ artists, total, page, limit });
});

// GET /api/artists/random — random sample of artists
router.get('/artists/random', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);

  const pipeline = [
    {
      $project: {
        _id: 0,
        pairs: { $zip: { inputs: ['$artists', '$artistsNorm'] } },
        album: 1,
        cover: 1,
      },
    },
    { $unwind: '$pairs' },
    {
      $group: {
        _id: { $arrayElemAt: ['$pairs', 1] },
        name: { $first: { $arrayElemAt: ['$pairs', 0] } },
        albumCount: { $addToSet: '$album' },
        trackCount: { $sum: 1 },
        covers: { $addToSet: '$cover' },
      },
    },
    {
      $project: {
        _id: 0,
        name: 1,
        albumCount: { $size: '$albumCount' },
        trackCount: 1,
        covers: {
          $filter: { input: '$covers', cond: { $ne: ['$$this', ''] } },
        },
      },
    },
    { $sample: { size: limit } },
  ];

  const artists = await Track.aggregate(pipeline);
  res.json(artists);
});

// GET /api/artists/:name — artist detail with albums
router.get('/artists/:name', async (req, res) => {
  const { name } = req.params;
  const norm = name.toLowerCase();
  const albums = await Track.aggregate([
    { $match: { artistsNorm: norm } },
    {
      $group: {
        _id: '$album',
        year: { $first: '$year' },
        trackCount: { $sum: 1 },
        cover: { $first: '$cover' },
        duration: { $sum: '$duration' },
      },
    },
    {
      $project: {
        _id: 0,
        name: '$_id',
        year: 1,
        trackCount: 1,
        cover: 1,
        duration: 1,
      },
    },
    { $sort: { year: -1, name: 1 } },
  ]);

  if (albums.length === 0) {
    return res.status(404).json({ error: 'Artist not found' });
  }

  res.json({ artist: name, albums });
});

// GET /api/artists/:name/tracks — all tracks for an artist
router.get('/artists/:name/tracks', async (req, res) => {
  const { name } = req.params;
  const norm = name.toLowerCase();
  const tracks = await Track.find({ artistsNorm: norm })
    .sort({ album: 1, disc: 1, trackNumber: 1 })
    .lean();
  res.json(tracks);
});

// GET /api/albums/recent — recently added albums, sorted by scannedAt desc
router.get('/albums/recent', async (req, res) => {
  const limit = Math.min(50, parseInt(req.query.limit, 10) || 12);
  const albums = await Track.aggregate([
    {
      $group: {
        _id: '$album',
        artists: { $first: '$artists' },
        artistsNorm: { $first: '$artistsNorm' },
        year: { $first: '$year' },
        trackCount: { $sum: 1 },
        cover: { $first: '$cover' },
        duration: { $sum: '$duration' },
        addedAt: { $max: '$scannedAt' },
      },
    },
    {
      $project: {
        _id: 0,
        name: '$_id',
        artists: 1,
        artistsNorm: 1,
        year: 1,
        trackCount: 1,
        cover: 1,
        duration: 1,
        addedAt: 1,
      },
    },
    { $sort: { addedAt: -1 } },
    { $limit: limit },
  ]);
  res.json(albums);
});

// GET /api/albums — all albums
router.get('/albums', async (req, res) => {
  const albums = await Track.aggregate([
    {
      $group: {
        _id: '$album',
        artists: { $first: '$artists' },
        year: { $first: '$year' },
        trackCount: { $sum: 1 },
        cover: { $first: '$cover' },
        duration: { $sum: '$duration' },
      },
    },
    {
      $project: {
        _id: 0,
        name: '$_id',
        artists: 1,
        year: 1,
        trackCount: 1,
        cover: 1,
        duration: 1,
      },
    },
    { $sort: { name: 1 } },
  ]);
  res.json(albums);
});

// GET /api/albums/:artist/:album — tracks in an album
router.get('/albums/:artist/:album', async (req, res) => {
  const { artist, album } = req.params;
  const tracks = await Track.find({ artistsNorm: artist.toLowerCase(), album })
    .sort({ disc: 1, trackNumber: 1 })
    .lean();

  if (tracks.length === 0) {
    return res.status(404).json({ error: 'Album not found' });
  }

  const albumInfo = {
    name: album,
    artists: tracks[0].artists,
    year: tracks[0].year,
    cover: tracks[0].cover,
    trackCount: tracks.length,
    duration: tracks.reduce((sum, t) => sum + t.duration, 0),
  };

  res.json({ album: albumInfo, tracks });
});

// GET /api/tracks/all — all tracks unpaginated (for queue building, with optional search)
router.get('/tracks/all', async (req, res) => {
  const search = req.query.search?.trim();
  const filter = {};
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { title: regex },
      { artists: regex },
      { album: regex },
    ];
  }
  const tracks = await Track.find(filter)
    .sort({ artistsNorm: 1, album: 1, disc: 1, trackNumber: 1 })
    .lean();
  res.json(tracks);
});

// GET /api/tracks — all tracks (with optional pagination and search)
router.get('/tracks', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const skip = (page - 1) * limit;
  const search = req.query.search?.trim();

  const filter = {};
  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { title: regex },
      { artists: regex },
      { album: regex },
    ];
  }

  const [tracks, total] = await Promise.all([
    Track.find(filter).sort({ artistsNorm: 1, album: 1, disc: 1, trackNumber: 1 }).skip(skip).limit(limit).lean(),
    Track.countDocuments(filter),
  ]);

  res.json({ tracks, total, page, limit });
});

// GET /api/tracks/recent — recently played tracks, deduped, sorted by lastPlayedAt
router.get('/tracks/recent', async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
  const tracks = await Track.find({ lastPlayedAt: { $ne: null } })
    .sort({ lastPlayedAt: -1 })
    .limit(limit)
    .lean();
  res.json(tracks);
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
          { $project: { title: 1, artists: 1, album: 1, cover: 1, duration: 1, playCount: 1 } },
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
              _id: '$album',
              artists: { $first: '$artists' },
              cover: { $first: '$cover' },
              plays: { $sum: '$playCount' },
            },
          },
          { $sort: { plays: -1 } },
          { $limit: 10 },
          { $project: { _id: 0, name: '$_id', artists: 1, cover: 1, plays: 1 } },
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
  res.json(tracks);
});

// PATCH /api/tracks/:id/love — toggle loved status
router.patch('/tracks/:id/love', async (req, res) => {
  const track = await Track.findById(req.params.id);
  if (!track) return res.status(404).json({ error: 'Track not found' });
  track.isLoved = !track.isLoved;
  await track.save();
  res.json({ isLoved: track.isLoved });
});

// GET /api/tracks/:id — single track
router.get('/tracks/:id', async (req, res) => {
  const track = await Track.findById(req.params.id).lean();
  if (!track) return res.status(404).json({ error: 'Track not found' });
  res.json(track);
});

export default router;
