import mongoose from 'mongoose';

const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];

const settingsSchema = new mongoose.Schema({
  accentColor:    { type: String, enum: VALID_COLORS, default: 'violet' },
  volume:     { type: Number, default: 1, min: 0, max: 1 },
  shuffle:    { type: Boolean, default: false },
  repeatMode: { type: String, enum: ['off', 'all', 'one'], default: 'off' },
}, { collection: 'settings' });

export default mongoose.model('Settings', settingsSchema);
