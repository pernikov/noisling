import { VALID_SORT_FIELDS, buildSearchRegex, buildSort, buildTrackFilter } from './libraryHelpers.js';

export function createLibraryRouteHandlers({ Track }) {
  async function searchLibrary(req, res) {
    const q = req.query.q?.trim();
    if (!q) return res.json({ tracks: [], artists: [], albums: [] });

    const limit = Math.min(8, parseInt(req.query.limit, 10) || 5);
    const regex = buildSearchRegex(q);

    const [tracks, artists, albums] = await Promise.all([
      Track.find({ $or: [{ title: regex }, { artists: regex }, { album: regex }] })
        .sort({ title: 1 })
        .limit(limit)
        .select('title artists album cover duration')
        .lean(),

      Track.aggregate([
        { $project: { pairs: { $zip: { inputs: ['$artists', '$artistsNorm'] } }, album: 1, cover: 1 } },
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
            covers: { $filter: { input: '$covers', cond: { $ne: ['$$this', ''] } } },
          },
        },
        { $match: { name: regex } },
        { $sort: { name: 1 } },
        { $limit: limit },
      ]),

      Track.aggregate([
        { $match: { album: regex } },
        {
          $group: {
            _id: { album: '$album', artistNorm: { $arrayElemAt: ['$artistsNorm', 0] } },
            artists: { $first: '$artists' },
            artistsNorm: { $first: '$artistsNorm' },
            year: { $first: '$year' },
            trackCount: { $sum: 1 },
            cover: { $first: '$cover' },
          },
        },
        {
          $project: {
            _id: 0,
            name: '$_id.album',
            artists: 1,
            artistsNorm: 1,
            year: 1,
            trackCount: 1,
            cover: 1,
          },
        },
        { $sort: { name: 1 } },
        { $limit: limit },
      ]),
    ]);

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

    res.json(tracks);
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

    res.json({ tracks, total, page, limit });
  }

  return {
    searchLibrary,
    listAllTracks,
    listTracks,
  };
}
