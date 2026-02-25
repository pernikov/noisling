import mongoose from 'mongoose';

const schema = new mongoose.Schema({
  trackId: { type: mongoose.Schema.Types.ObjectId, index: true },
  playedAt: { type: Date, default: Date.now },
  // Snapshot of track fields at play time — preserved even if track is deleted
  title: String,
  artists: [String],
  album: String,
  cover: String,
  duration: Number,
  format: String,
  path: String,
});

schema.index({ playedAt: -1 });

export default mongoose.model('PlayHistory', schema);
