import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { DatabaseSync } from 'node:sqlite';
import config from './config.js';
import { createLogger } from './logger.js';

const log = createLogger('db', 'blue');

let db;

function serialize(value) {
  return JSON.stringify(value ?? null);
}

function initializeSchema(database) {
  database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL DEFAULT 'Unknown Title',
      artists_json TEXT NOT NULL DEFAULT '["Unknown Artist"]',
      artists_norm_json TEXT NOT NULL DEFAULT '["unknown artist"]',
      album_artist TEXT NOT NULL DEFAULT '',
      album TEXT NOT NULL DEFAULT 'Unknown Album',
      release_type TEXT NOT NULL DEFAULT '',
      track_number INTEGER NOT NULL DEFAULT 0,
      disc INTEGER NOT NULL DEFAULT 1,
      duration REAL NOT NULL DEFAULT 0,
      format TEXT NOT NULL DEFAULT '',
      bitrate INTEGER NOT NULL DEFAULT 0,
      genre TEXT NOT NULL DEFAULT '',
      year INTEGER NOT NULL DEFAULT 0,
      cover TEXT NOT NULL DEFAULT '',
      has_embedded_cover INTEGER NOT NULL DEFAULT 0,
      file_size INTEGER NOT NULL DEFAULT 0,
      file_mtime REAL NOT NULL DEFAULT 0,
      play_count INTEGER NOT NULL DEFAULT 0,
      last_played_at TEXT,
      is_loved INTEGER NOT NULL DEFAULT 0,
      scanned_at TEXT NOT NULL,
      overrides_json TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tracks_path ON tracks(path);
    CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album, disc, track_number);
    CREATE INDEX IF NOT EXISTS idx_tracks_loved ON tracks(is_loved);
    CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count DESC);
    CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_tracks_scanned ON tracks(scanned_at DESC);

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('manual', 'smart')),
      track_ids_json TEXT NOT NULL DEFAULT '[]',
      rule TEXT,
      limit_count INTEGER NOT NULL DEFAULT 50,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_playlists_type ON playlists(type);

    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      accent_color TEXT NOT NULL DEFAULT 'violet',
      theme_color TEXT NOT NULL DEFAULT 'none',
      volume REAL NOT NULL DEFAULT 1,
      font_size TEXT NOT NULL DEFAULT 'medium',
      tracks_sort_json TEXT NOT NULL DEFAULT '{"field":"artist","dir":"asc"}',
      wide_layout INTEGER NOT NULL DEFAULT 0,
      home_albums_mode TEXT NOT NULL DEFAULT 'recent',
      viz_mode TEXT NOT NULL DEFAULT 'pills',
      randomize_on_new_track INTEGER NOT NULL DEFAULT 0,
      butterchurn_preset_mode TEXT NOT NULL DEFAULT 'random',
      butterchurn_preset TEXT NOT NULL DEFAULT 'Flexi, martin + geiss - dedicated to the sherwin maxawow',
      reduce_motion INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export async function connectDB() {
  mkdirSync(dirname(config.databasePath), { recursive: true });
  db = new DatabaseSync(config.databasePath);
  initializeSchema(db);
  log.success(`Connected to SQLite: ${config.databasePath}`);
}

export function getDB() {
  if (!db) {
    mkdirSync(dirname(config.databasePath), { recursive: true });
    db = new DatabaseSync(config.databasePath);
    initializeSchema(db);
  }
  return db;
}

export function resetDBForTests(database) {
  db = database;
}

export { serialize };
