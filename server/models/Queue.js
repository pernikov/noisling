import mongoose from 'mongoose';

// Single-user app: exactly one queue document at any time.
// Overwritten on each new playback session.
const queueSchema = new mongoose.Schema({
  trackIds:     { type: [String], default: [] },
  currentIndex: { type: Number, default: 0 },
  currentTime:  { type: Number, default: 0 },
  updatedAt:    { type: Date, default: Date.now },
});

export default mongoose.model('Queue', queueSchema);
