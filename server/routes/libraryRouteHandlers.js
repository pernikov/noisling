import { VALID_SORT_FIELDS, buildSearchRegex, buildSort, buildTrackFilter } from './libraryHelpers.js';
import { mergeTrackOverrides } from '../services/trackOverrides.js';
import { buildAlbumSummaries } from './albumGrouping.js';

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

  return Array.from(artistMap.values()).map((summary) => ({
    name: summary.name,
    albumCount: summary.albumSet.size,
    trackCount: summary.trackCount,
    covers: Array.from(summary.coverSet),
  }));
}

export function createLibraryRouteHandlers({ Track }) {
  async function searchLibrary(req, res) {
    const q = req.query.q?.trim();
    if (!q) return res.json({ tracks: [], artists: [], albums: [] });

    const limit = Math.min(8, parseInt(req.query.limit, 10) || 5);
    const regex = buildSearchRegex(q);

    const resolvedTracks = (await Track.find({}).lean()).map(mergeTrackOverrides);
    const tracks = resolvedTracks
      .filter((track) => regex.test(track.title) || track.artists?.some((artist) => regex.test(artist)) || regex.test(track.album))
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, limit);
    const artists = buildArtistSummaries(resolvedTracks)
      .filter((artist) => regex.test(artist.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);
    const albums = buildAlbumSummaries(resolvedTracks)
      .filter((album) => regex.test(album.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limit);

    res.json({ tracks, artists, albums });
  }

  async function listAllTracks(req, res) {
    const search = req.query.search?.trim();
    const genre = req.query.genre?.trim();
    const sortField = VALID_SORT_FIELDS.includes(req.query.sort) ? req.query.sort : null;
    const sortOrder = req.query.order === 'desc' ? 'desc' : 'asc';

    const filter = buildTrackFilter({ search, genre });
    const tracks = await Track.find(filter)
      .sort(buildSort(sortField, sortOrder))
      .lean();

    res.json(tracks.map(mergeTrackOverrides));
  }

  async function listTracks(req, res) {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();
    const sortField = VALID_SORT_FIELDS.includes(req.query.sort) ? req.query.sort : null;
    const sortOrder = req.query.order === 'desc' ? 'desc' : 'asc';

    const filter = buildTrackFilter({ search });

    const [tracks, total] = await Promise.all([
      Track.find(filter).sort(buildSort(sortField, sortOrder)).skip(skip).limit(limit).lean(),
      Track.countDocuments(filter),
    ]);

    res.json({ tracks: tracks.map(mergeTrackOverrides), total, page, limit });
  }

  return {
    searchLibrary,
    listAllTracks,
    listTracks,
  };
}
