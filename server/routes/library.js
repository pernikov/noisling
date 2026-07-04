import { Router } from 'express';
import Track from '../models/Track.js';
import { createLibraryRouteHandlers } from './libraryRouteHandlers.js';
import { buildTrackOverrides, mergeTrackOverrides } from '../services/trackOverrides.js';
import { buildSearchRegex } from './libraryHelpers.js';
import { buildAlbumSummaries, getAlbumSummaryArtists } from './albumGrouping.js';
import { removeCoverIfUnused, saveCoverDataUrl } from '../services/coverStorage.js';

const router = Router();
const { searchLibrary, listAllTracks, listTracks } = createLibraryRouteHandlers({ Track });

async function loadResolvedTracks(predicate = null) {
  const tracks = (await Track.find({}).lean()).map(mergeTrackOverrides);
  return typeof predicate === 'function' ? tracks.filter(predicate) : tracks;
}

function matchesArtist(track, norm) {
  return track.artistsNorm?.some((artistNorm) => artistNorm === norm)
    || track.albumArtist?.trim().toLowerCase() === norm;
}

function buildResolvedArtistMatch(norm) {
  return (track) => matchesArtist(track, norm);
}

function buildResolvedAlbumMatch(artistNorm, album) {
  return (track) => matchesArtist(track, artistNorm) && track.album === album;
}

async function aggregateArtistSummaries({ search, page = 1, limit = 60, random = false } = {}) {
  const regex = buildSearchRegex(search);
  let items = buildArtistSummaries(await loadResolvedTracks());
  if (regex) items = items.filter((artist) => regex.test(artist.name));
  if (random) items = sampleItems(items, limit);
  else items.sort((a, b) => a.name.localeCompare(b.name));
  const total = items.length;
  return { items: random ? items : paginate(items, page, limit), total };
}

async function aggregateAlbumSummaries({ search, limit = null, sort = { name: 1 }, random = false, minTrackCount = 0 } = {}) {
  const regex = buildSearchRegex(search);
  let albums = buildAlbumSummaries(await loadResolvedTracks());
  if (regex) albums = albums.filter((album) => regex.test(album.name));
  if (minTrackCount > 0) albums = albums.filter((album) => album.trackCount >= minTrackCount);
  if (random) return sampleItems(albums, limit ?? 12);
  albums.sort((a, b) => compareBySort(a, b, sort));
  return limit == null ? albums : albums.slice(0, limit);
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

function compareBySort(a, b, sort) {
  for (const [field, direction] of Object.entries(sort)) {
    const aValue = field === 'addedAt' ? new Date(a[field] ?? 0).getTime() : a[field];
    const bValue = field === 'addedAt' ? new Date(b[field] ?? 0).getTime() : b[field];
    if (aValue < bValue) return direction < 0 ? 1 : -1;
    if (aValue > bValue) return direction < 0 ? -1 : 1;
  }
  return 0;
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
  const minTrackCount = Math.max(0, parseInt(req.query.minTrackCount, 10) || 0);
  const albums = await aggregateAlbumSummaries({ limit, random: true, minTrackCount });
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

  const albumArtistTrack = resolvedTracks.find((track) => track.albumArtist?.trim()) ?? resolvedTracks[0];
  const albumArtists = getAlbumSummaryArtists(albumArtistTrack);

  const albumInfo = {
    name: resolvedTracks[0].album,
    artists: albumArtists.length ? albumArtists : resolvedTracks[0].artists,
    releaseType: resolvedTracks.find((track) => track.releaseType)?.releaseType || '',
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
  const genreMap = new Map();
  for (const track of await loadResolvedTracks()) {
    const raw = track.genre;
    const name = raw?.trim();
    if (!name) continue;
    const current = genreMap.get(name) ?? { name, raw, trackCount: 0 };
    current.trackCount += 1;
    genreMap.set(name, current);
  }
  const genres = Array.from(genreMap.values()).sort((a, b) => a.name.localeCompare(b.name));
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
      'overrides.releaseType': 1,
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
