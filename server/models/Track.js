import mongoose from 'mongoose';

const trackSchema = new mongoose.Schema({
  path: { type: String, required: true, unique: true },
  title: { type: String, default: 'Unknown Title' },
  artists: { type: [String], default: ['Unknown Artist'] },
  artistsNorm: { type: [String], default: ['unknown artist'] },
  albumArtist: { type: String, default: '' },
  album: { type: String, default: 'Unknown Album' },
  trackNumber: { type: Number, default: 0 },
  disc: { type: Number, default: 1 },
  duration: { type: Number, default: 0 },
  format: { type: String, default: '' },
  bitrate: { type: Number, default: 0 },
  genre: { type: String, default: '' },
  year: { type: Number, default: 0 },
  cover: { type: String, default: '' }, // cover filename in covers dir
  hasEmbeddedCover: { type: Boolean, default: false },
  fileSize: { type: Number, default: 0 },
  fileMtime: { type: Number, default: 0 }, // file modification time in ms
  playCount: { type: Number, default: 0 },
  lastPlayedAt: { type: Date, default: null },
  isLoved: { type: Boolean, default: false },
  scannedAt: { type: Date, default: Date.now },
  overrides: {
    title: { type: String, default: undefined },
    artists: { type: [String], default: undefined },
    artistsNorm: { type: [String], default: undefined },
    albumArtist: { type: String, default: undefined },
    album: { type: String, default: undefined },
    trackNumber: { type: Number, default: undefined },
    year: { type: Number, default: undefined },
    cover: { type: String, default: undefined },
    updatedAt: { type: Date, default: null },
  },
});

trackSchema.index({ artistsNorm: 1, album: 1 });
trackSchema.index({ album: 1, disc: 1, trackNumber: 1 });
trackSchema.index({ isLoved: 1 });
trackSchema.index({ playCount: -1 });
trackSchema.index({ lastPlayedAt: -1 });
trackSchema.index({ scannedAt: -1 });

export default mongoose.model('Track', trackSchema);
