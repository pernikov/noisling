import mongoose from 'mongoose';

const VALID_COLORS = ['rose', 'amber', 'yellow', 'emerald', 'teal', 'sky', 'indigo', 'violet', 'slate'];
const VALID_THEME_COLORS = [...VALID_COLORS, 'none'];

const settingsSchema = new mongoose.Schema({
  accentColor:        { type: String, enum: VALID_COLORS, default: 'violet' },
  themeColor:         { type: String, enum: VALID_THEME_COLORS, default: 'none' },
  volume:             { type: Number, default: 1, min: 0, max: 1 },
  fontSize:           { type: String, enum: ['small', 'medium', 'large'], default: 'medium' },
  tracksSort:          { type: mongoose.Schema.Types.Mixed, default: { field: 'artist', dir: 'asc' } },
  wideLayout:         { type: Boolean, default: false },
  homeAlbumsMode:     { type: String, enum: ['recent', 'random', 'top'], default: 'recent' },
  vizMode:            { type: String, enum: ['pills', 'nucleus', 'butterchurn'], default: 'pills' },
  randomizeOnNewTrack: { type: Boolean, default: false },
  butterchurnPresetMode: { type: String, enum: ['single', 'random'], default: 'random' },
  butterchurnPreset:  { type: String, default: 'Flexi, martin + geiss - dedicated to the sherwin maxawow' },
  reduceMotion:       { type: Boolean, default: false },
}, { collection: 'settings' });

export default mongoose.model('Settings', settingsSchema);
