import { getDB, serialize } from '../db.js';
import { Query, applyUpdate, parseJson } from './sqliteModelUtils.js';

const DEFAULT_SETTINGS = {
  accentColor: 'violet',
  themeColor: 'none',
  volume: 1,
  fontSize: 'medium',
  tracksSort: { field: 'artist', dir: 'asc' },
  wideLayout: false,
  homeAlbumsMode: 'recent',
  vizMode: 'pills',
  nucleusStyleMode: 'random',
  nucleusStyle: 'filled',
  randomizeOnNewTrack: false,
  butterchurnPresetMode: 'random',
  butterchurnPreset: 'Flexi, martin + geiss - dedicated to the sherwin maxawow',
  reduceMotion: false,
};

function rowToSettings(row) {
  if (!row) return null;
  return {
    _id: 'settings',
    accentColor: row.accent_color,
    themeColor: row.theme_color,
    volume: row.volume,
    fontSize: row.font_size,
    tracksSort: parseJson(row.tracks_sort_json, DEFAULT_SETTINGS.tracksSort),
    wideLayout: Boolean(row.wide_layout),
    homeAlbumsMode: row.home_albums_mode,
    vizMode: row.viz_mode,
    nucleusStyleMode: row.nucleus_style_mode,
    nucleusStyle: row.nucleus_style,
    randomizeOnNewTrack: Boolean(row.randomize_on_new_track),
    butterchurnPresetMode: row.butterchurn_preset_mode,
    butterchurnPreset: row.butterchurn_preset,
    reduceMotion: Boolean(row.reduce_motion),
  };
}

function saveSettings(settings = {}) {
  const doc = { ...DEFAULT_SETTINGS, ...settings };
  getDB().prepare(`
    INSERT INTO settings (
      id,
      accent_color,
      theme_color,
      volume,
      font_size,
      tracks_sort_json,
      wide_layout,
      home_albums_mode,
      viz_mode,
      nucleus_style_mode,
      nucleus_style,
      randomize_on_new_track,
      butterchurn_preset_mode,
      butterchurn_preset,
      reduce_motion
    ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      accent_color = excluded.accent_color,
      theme_color = excluded.theme_color,
      volume = excluded.volume,
      font_size = excluded.font_size,
      tracks_sort_json = excluded.tracks_sort_json,
      wide_layout = excluded.wide_layout,
      home_albums_mode = excluded.home_albums_mode,
      viz_mode = excluded.viz_mode,
      nucleus_style_mode = excluded.nucleus_style_mode,
      nucleus_style = excluded.nucleus_style,
      randomize_on_new_track = excluded.randomize_on_new_track,
      butterchurn_preset_mode = excluded.butterchurn_preset_mode,
      butterchurn_preset = excluded.butterchurn_preset,
      reduce_motion = excluded.reduce_motion
  `).run(
    doc.accentColor,
    doc.themeColor,
    doc.volume,
    doc.fontSize,
    serialize(doc.tracksSort),
    doc.wideLayout ? 1 : 0,
    doc.homeAlbumsMode,
    doc.vizMode,
    doc.nucleusStyleMode,
    doc.nucleusStyle,
    doc.randomizeOnNewTrack ? 1 : 0,
    doc.butterchurnPresetMode,
    doc.butterchurnPreset,
    doc.reduceMotion ? 1 : 0,
  );
  return doc;
}

function getSettings() {
  return rowToSettings(getDB().prepare('SELECT * FROM settings WHERE id = 1').get());
}

const Settings = {
  findOneAndUpdate(_filter = {}, update = {}, options = {}) {
    const current = getSettings();
    const next = applyUpdate(current ?? DEFAULT_SETTINGS, update, { isInsert: !current });
    if (!current && options.setDefaultsOnInsert) Object.assign(next, DEFAULT_SETTINGS, next);
    const saved = saveSettings(next);
    return new Query(() => saved, { single: true }).lean();
  },
};

export default Settings;
