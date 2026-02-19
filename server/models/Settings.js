import mongoose from 'mongoose';

const VALID_COLORS = ['violet', 'sky', 'rose', 'amber', 'emerald', 'indigo'];

const settingsSchema = new mongoose.Schema({
  accentColor: {
    type: String,
    enum: VALID_COLORS,
    default: 'violet',
  },
}, { collection: 'settings' });

export default mongoose.model('Settings', settingsSchema);
