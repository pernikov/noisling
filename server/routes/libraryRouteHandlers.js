import { VALID_SORT_FIELDS, buildSearchRegex, buildSort, buildTrackFilter } from './libraryHelpers.js';
import { mergeTrackOverrides } from '../services/trackOverrides.js';

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
      });
    }

    const summary = albumMap.get(key);
    summary.trackCount += 1;
    if (!summary.cover && track.cover) summary.cover = track.cover;
    if (!summary.year && track.year) summary.year = track.year;
  }

  return Array.from(albumMap.values());
}

function effectiveField(field, fallback = `$${field}`) {
  return { $ifNull: [`$overrides.${field}`, fallback] };
}

async function aggregateArtistSearch(Track, regex, limit) {
  return Track.aggregate([
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
    { $match: { name: regex } },
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
    { $sort: { name: 1 } },
    { $limit: limit },
  ]);
}

async function aggregateAlbumSearch(Track, regex, limit) {
  return Track.aggregate([
    {
      $project: {
        effectiveAlbum: effectiveField('album'),
        effectiveArtists: effectiveField('artists'),
        effectiveArtistsNorm: effectiveField('artistsNorm'),
        effectiveYear: effectiveField('year'),
        effectiveCover: effectiveField('cover'),
      },
    },
    { $match: { effectiveAlbum: regex } },
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
        trackCount: { $sum: 1 },
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
            in: { $ifNull: [{ $arrayElemAt: ['$$filteredCovers', 0] }, ''] },
          },
        },
      },
    },
    { $sort: { name: 1 } },
    { $limit: limit },
  ]);
}

export function createLibraryRouteHandlers({ Track }) {
  async function searchLibrary(req, res) {
    const q = req.query.q?.trim();
    if (!q) return res.json({ tracks: [], artists: [], albums: [] });

    const limit = Math.min(8, parseInt(req.query.limit, 10) || 5);
    const regex = buildSearchRegex(q);

    if (typeof Track.aggregate === 'function') {
      const [trackDocs, artists, albums] = await Promise.all([
        Track.find({
          $or: [
            { title: regex },
            { artists: regex },
            { album: regex },
            { 'overrides.title': regex },
            { 'overrides.artists': regex },
            { 'overrides.album': regex },
          ],
        })
          .sort({ title: 1 })
          .limit(limit)
          .lean(),
        aggregateArtistSearch(Track, regex, limit),
        aggregateAlbumSearch(Track, regex, limit),
      ]);

      const tracks = trackDocs.map(mergeTrackOverrides);
      return res.json({ tracks, artists, albums });
    }

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
