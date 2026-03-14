import { Router } from 'express';
import mongoose from 'mongoose';
import Playlist from '../models/Playlist.js';
import Track from '../models/Track.js';
import { createPlaylistRouteHandlers } from './playlistRouteHandlers.js';

const router = Router();
const {
  listPlaylists,
  createPlaylist,
  getPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTracksToPlaylist,
  removeTrackFromPlaylist,
} = createPlaylistRouteHandlers({
  Playlist,
  Track,
  isValidObjectId: mongoose.Types.ObjectId.isValid,
});

// GET /api/playlists
router.get('/playlists', listPlaylists);

// POST /api/playlists
router.post('/playlists', createPlaylist);

// GET /api/playlists/:id
router.get('/playlists/:id', getPlaylist);

// PATCH /api/playlists/:id
router.patch('/playlists/:id', updatePlaylist);

// DELETE /api/playlists/:id
router.delete('/playlists/:id', deletePlaylist);

// POST /api/playlists/:id/tracks
router.post('/playlists/:id/tracks', addTracksToPlaylist);

// DELETE /api/playlists/:id/tracks/:trackId
router.delete('/playlists/:id/tracks/:trackId', removeTrackFromPlaylist);

export default router;
