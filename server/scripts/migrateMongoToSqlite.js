import mongoose from 'mongoose';
import config from '../config.js';
import { connectDB, getDB } from '../db.js';
import Track from '../models/Track.js';
import Playlist from '../models/Playlist.js';
import Settings from '../models/Settings.js';

const replace = process.argv.includes('--replace');

function id(value) {
  return String(value?._id ?? value ?? '');
}

function plainDoc(doc) {
  return JSON.parse(JSON.stringify(doc));
}

function mapTrack(doc) {
  return {
    ...plainDoc(doc),
    _id: id(doc),
    lastPlayedAt: doc.lastPlayedAt ?? null,
    scannedAt: doc.scannedAt ?? new Date(),
  };
}

function mapPlaylist(doc) {
  return {
    ...plainDoc(doc),
    _id: id(doc),
    trackIds: Array.isArray(doc.trackIds) ? doc.trackIds.map(id).filter(Boolean) : [],
    createdAt: doc.createdAt ?? new Date(),
    updatedAt: doc.updatedAt ?? new Date(),
  };
}

function mapSettings(doc) {
  const { _id: _ignored, __v: _version, ...settings } = plainDoc(doc ?? {});
  return settings;
}

async function main() {
  console.log(`[migrate] MongoDB: ${config.mongoUri}`);
  console.log(`[migrate] SQLite: ${config.databasePath}`);

  await connectDB();
  const db = getDB();
  const existingTrackCount = db.prepare('SELECT COUNT(*) AS count FROM tracks').get().count;
  const existingPlaylistCount = db.prepare('SELECT COUNT(*) AS count FROM playlists').get().count;

  if (!replace && (existingTrackCount > 0 || existingPlaylistCount > 0)) {
    throw new Error('SQLite database already contains data. Re-run with --replace to clear and migrate again.');
  }

  if (replace) {
    db.exec('DELETE FROM playlists; DELETE FROM tracks; DELETE FROM settings;');
  }

  await mongoose.connect(config.mongoUri);
  const mongo = mongoose.connection.db;

  const [tracks, playlists, settings] = await Promise.all([
    mongo.collection('tracks').find({}).toArray(),
    mongo.collection('playlists').find({}).toArray(),
    mongo.collection('settings').findOne({}),
  ]);

  db.exec('BEGIN');
  try {
    for (const track of tracks) await Track.create(mapTrack(track));
    for (const playlist of playlists) await Playlist.create(mapPlaylist(playlist));
    if (settings) await Settings.findOneAndUpdate({}, mapSettings(settings), { upsert: true, new: true }).lean();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    await mongoose.disconnect();
  }

  console.log(`[migrate] Migrated ${tracks.length} tracks`);
  console.log(`[migrate] Migrated ${playlists.length} playlists`);
  console.log(`[migrate] Migrated ${settings ? 1 : 0} settings document`);
}

main().catch((err) => {
  console.error(`[migrate] ${err.message}`);
  process.exit(1);
});
