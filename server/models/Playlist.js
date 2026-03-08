import mongoose from 'mongoose';

const playlistSchema = new mongoose.Schema({
  name:     { type: String, required: true },
  type:     { type: String, enum: ['manual', 'smart'], required: true },
  trackIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Track' }],
  rule:     { type: String, enum: ['most-played', 'never-played', 'loved', 'recently-added'], default: null },
  limit:    { type: Number, default: 50, min: 1, max: 500 },
}, { collection: 'playlists', timestamps: true });

playlistSchema.index({ type: 1 });

export default mongoose.model('Playlist', playlistSchema);
