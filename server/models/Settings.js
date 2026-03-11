import mongoose from 'mongoose';

const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];

const settingsSchema = new mongoose.Schema({
  accentColor:        { type: String, enum: VALID_COLORS, default: 'violet' },
  themeColor:         { type: String, enum: VALID_THEME_COLORS, default: 'none' },
  volume:             { type: Number, default: 1, min: 0, max: 1 },
  shuffle:            { type: Boolean, default: false },
  repeatMode:         { type: String, enum: ['off', 'all', 'one'], default: 'off' },
  density:            { type: String, enum: ['comfortable', 'compact'], default: 'comfortable' },
  showCoverArt:       { type: Boolean, default: true },
  fontSize:           { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
  tracksColumns:       { type: mongoose.Schema.Types.Mixed, default: { artist: true, album: true, plays: true, lastPlayed: true } },
  tracksSort:          { type: mongoose.Schema.Types.Mixed, default: { field: 'artist', dir: 'asc' } },
  lovedAccent:        { type: Boolean, default: false },
  showArtistsNav:     { type: Boolean, default: true },
  wideLayout:         { type: Boolean, default: false },
  homeShowQuickPlay:  { type: Boolean, default: true },
  homeShowRecent:     { type: Boolean, default: true },
  homeShowAlbums:     { type: Boolean, default: true },
  vizMode:            { type: String, enum: ['spiral', 'wave', 'particles', 'polar', 'spectrum', 'bubbles'], default: 'spiral' },
  showBubbles:        { type: Boolean, default: true },
  randomizeOnNewTrack: { type: Boolean, default: false },
  showPlaylists:      { type: Boolean, default: true },
  sharpCorners:       { type: Boolean, default: false },
  reduceMotion:       { type: Boolean, default: false },
}, { collection: 'settings' });

export default mongoose.model('Settings', settingsSchema);
