import { buildCoverByTrack, buildPlaylistSummary, orderPlaylistTracks } from './playlistHelpers.js';

export function createPlaylistRouteHandlers({ Playlist, Track, isValidObjectId }) {
  async function listPlaylists(req, res) {
    const playlists = await Playlist.find({ type: 'manual' }).sort({ name: 1 }).lean();

    const allIds = playlists.flatMap((playlist) => playlist.trackIds.slice(0, 500));
    const tracks = allIds.length
      ? await Track.find({ _id: { $in: allIds } }, { _id: 1, cover: 1 }).lean()
      : [];
    const coverByTrack = buildCoverByTrack(tracks);

    res.json(playlists.map((playlist) => buildPlaylistSummary(playlist, coverByTrack)));
  }

  async function createPlaylist(req, res) {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const playlist = await Playlist.create({ name: name.trim(), type: 'manual', trackIds: [] });
    res.status(201).json(playlist);
  }

  async function getPlaylist(req, res) {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const playlist = await Playlist.findOne({ _id: req.params.id, type: 'manual' }).lean();
    if (!playlist) return res.status(404).json({ error: 'Not found' });

    const ordered = await Track.find({ _id: { $in: playlist.trackIds } }).lean();
    const tracks = orderPlaylistTracks(playlist.trackIds, ordered);

    res.json({ ...playlist, tracks });
  }

  async function updatePlaylist(req, res) {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const playlist = await Playlist.findOne({ _id: req.params.id, type: 'manual' });
    if (!playlist) return res.status(404).json({ error: 'Not found' });

    const { name, trackIds } = req.body;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: 'Invalid name' });
      }
      playlist.name = name.trim();
    }
    if (trackIds !== undefined) {
      if (!Array.isArray(trackIds)) {
        return res.status(400).json({ error: 'Invalid trackIds' });
      }
      playlist.trackIds = trackIds;
    }

    await playlist.save();
    res.json(playlist);
  }

  async function deletePlaylist(req, res) {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const playlist = await Playlist.findOneAndDelete({ _id: req.params.id, type: 'manual' });
    if (!playlist) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  }

  async function addTracksToPlaylist(req, res) {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const playlist = await Playlist.findOne({ _id: req.params.id, type: 'manual' });
    if (!playlist) return res.status(404).json({ error: 'Not found' });

    const { trackIds } = req.body;
    if (!Array.isArray(trackIds) || !trackIds.length) {
      return res.status(400).json({ error: 'trackIds required' });
    }

    const existing = new Set(playlist.trackIds.map(String));
    for (const id of trackIds) {
      if (isValidObjectId(id) && !existing.has(String(id))) {
        playlist.trackIds.push(id);
        existing.add(String(id));
      }
    }

    await playlist.save();
    res.json(playlist);
  }

  async function removeTrackFromPlaylist(req, res) {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: 'Not found' });
    }
    const playlist = await Playlist.findOne({ _id: req.params.id, type: 'manual' });
    if (!playlist) return res.status(404).json({ error: 'Not found' });

    playlist.trackIds = playlist.trackIds.filter((id) => String(id) !== req.params.trackId);
    await playlist.save();
    res.json(playlist);
  }

  return {
    listPlaylists,
    createPlaylist,
    getPlaylist,
    updatePlaylist,
    deletePlaylist,
    addTracksToPlaylist,
    removeTrackFromPlaylist,
  };
}
