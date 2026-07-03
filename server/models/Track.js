import { getDB, serialize } from '../db.js';
import {
  Query,
  applyUpdate,
  cloneDoc,
  createId,
  matchesFilter,
  parseJson,
  toIsoDate,
} from './sqliteModelUtils.js';

const COLUMNS = [
  'id',
  'path',
  'title',
  'artists_json',
  'artists_norm_json',
  'album_artist',
  'album',
  'release_type',
  'track_number',
  'disc',
  'duration',
  'format',
  'bitrate',
  'genre',
  'year',
  'cover',
  'has_embedded_cover',
  'file_size',
  'file_mtime',
  'play_count',
  'last_played_at',
  'is_loved',
  'scanned_at',
  'overrides_json',
];

function rowToTrack(row) {
  if (!row) return null;
  const overrides = parseJson(row.overrides_json, undefined);
  return {
    _id: row.id,
    path: row.path,
    title: row.title,
    artists: parseJson(row.artists_json, ['Unknown Artist']),
    artistsNorm: parseJson(row.artists_norm_json, ['unknown artist']),
    albumArtist: row.album_artist,
    album: row.album,
    releaseType: row.release_type,
    trackNumber: row.track_number,
    disc: row.disc,
    duration: row.duration,
    format: row.format,
    bitrate: row.bitrate,
    genre: row.genre,
    year: row.year,
    cover: row.cover,
    hasEmbeddedCover: Boolean(row.has_embedded_cover),
    fileSize: row.file_size,
    fileMtime: row.file_mtime,
    playCount: row.play_count,
    lastPlayedAt: row.last_played_at,
    isLoved: Boolean(row.is_loved),
    scannedAt: row.scanned_at,
    ...(overrides && Object.keys(overrides).length ? { overrides } : {}),
  };
}

function normalizeTrack(track = {}) {
  return {
    _id: String(track._id ?? track.id ?? createId()),
    path: track.path,
    title: track.title ?? 'Unknown Title',
    artists: Array.isArray(track.artists) && track.artists.length ? track.artists : ['Unknown Artist'],
    artistsNorm: Array.isArray(track.artistsNorm) && track.artistsNorm.length ? track.artistsNorm : ['unknown artist'],
    albumArtist: track.albumArtist ?? '',
    album: track.album ?? 'Unknown Album',
    releaseType: track.releaseType ?? '',
    trackNumber: Number(track.trackNumber ?? 0),
    disc: Number(track.disc ?? 1),
    duration: Number(track.duration ?? 0),
    format: track.format ?? '',
    bitrate: Number(track.bitrate ?? 0),
    genre: track.genre ?? '',
    year: Number(track.year ?? 0),
    cover: track.cover ?? '',
    hasEmbeddedCover: Boolean(track.hasEmbeddedCover),
    fileSize: Number(track.fileSize ?? 0),
    fileMtime: Number(track.fileMtime ?? 0),
    playCount: Number(track.playCount ?? 0),
    lastPlayedAt: toIsoDate(track.lastPlayedAt, null),
    isLoved: Boolean(track.isLoved),
    scannedAt: toIsoDate(track.scannedAt, new Date().toISOString()),
    overrides: track.overrides && Object.keys(track.overrides).length ? track.overrides : undefined,
  };
}

function trackToRow(track) {
  const normalized = normalizeTrack(track);
  return {
    id: normalized._id,
    path: normalized.path,
    title: normalized.title,
    artists_json: serialize(normalized.artists),
    artists_norm_json: serialize(normalized.artistsNorm),
    album_artist: normalized.albumArtist,
    album: normalized.album,
    release_type: normalized.releaseType,
    track_number: normalized.trackNumber,
    disc: normalized.disc,
    duration: normalized.duration,
    format: normalized.format,
    bitrate: normalized.bitrate,
    genre: normalized.genre,
    year: normalized.year,
    cover: normalized.cover,
    has_embedded_cover: normalized.hasEmbeddedCover ? 1 : 0,
    file_size: normalized.fileSize,
    file_mtime: normalized.fileMtime,
    play_count: normalized.playCount,
    last_played_at: normalized.lastPlayedAt,
    is_loved: normalized.isLoved ? 1 : 0,
    scanned_at: normalized.scannedAt,
    overrides_json: normalized.overrides ? serialize(normalized.overrides) : null,
  };
}

function allTracks() {
  return getDB().prepare('SELECT * FROM tracks').all().map(rowToTrack);
}

function saveTrack(track) {
  const row = trackToRow(track);
  const placeholders = COLUMNS.map(() => '?').join(', ');
  const updates = COLUMNS.filter((column) => column !== 'id').map((column) => `${column} = excluded.${column}`).join(', ');
  getDB().prepare(`
    INSERT INTO tracks (${COLUMNS.join(', ')})
    VALUES (${placeholders})
    ON CONFLICT(id) DO UPDATE SET ${updates}
    ON CONFLICT(path) DO UPDATE SET ${updates}
  `).run(...COLUMNS.map((column) => row[column]));
  return rowToTrack(row);
}

function hydrateTrack(doc) {
  if (!doc) return null;
  const hydrated = cloneDoc(doc);
  hydrated.save = async () => saveTrack(hydrated);
  return hydrated;
}

function findMatching(filter = {}) {
  return allTracks().filter((track) => matchesFilter(track, filter));
}

const Track = {
  find(filter = {}) {
    return new Query(() => findMatching(filter), { hydrate: hydrateTrack });
  },

  findOne(filter = {}) {
    return new Query(() => findMatching(filter)[0] ?? null, { hydrate: hydrateTrack, single: true });
  },

  findById(id) {
    return new Query(() => rowToTrack(getDB().prepare('SELECT * FROM tracks WHERE id = ?').get(String(id))), {
      hydrate: hydrateTrack,
      single: true,
    });
  },

  findByIdAndUpdate(id, update, options = {}) {
    return new Query(() => {
      const current = rowToTrack(getDB().prepare('SELECT * FROM tracks WHERE id = ?').get(String(id)));
      if (!current) return null;
      const next = applyUpdate(current, update);
      saveTrack(next);
      return options.new === false ? current : next;
    }, { hydrate: hydrateTrack, single: true });
  },

  async findOneAndDelete(filter = {}) {
    const doc = findMatching(filter)[0];
    if (!doc) return null;
    getDB().prepare('DELETE FROM tracks WHERE id = ?').run(doc._id);
    return hydrateTrack(doc);
  },

  async updateOne(filter = {}, update = {}, options = {}) {
    const current = findMatching(filter)[0];
    if (current) {
      saveTrack(applyUpdate(current, update));
      return { matchedCount: 1, modifiedCount: 1, upsertedCount: 0 };
    }
    if (options.upsert) {
      const seed = { ...filter };
      const inserted = applyUpdate(seed, update, { isInsert: true });
      saveTrack(inserted);
      return { matchedCount: 0, modifiedCount: 0, upsertedCount: 1 };
    }
    return { matchedCount: 0, modifiedCount: 0, upsertedCount: 0 };
  },

  async updateMany(filter = {}, update = {}) {
    const docs = findMatching(filter);
    for (const doc of docs) saveTrack(applyUpdate(doc, update));
    return { matchedCount: docs.length, modifiedCount: docs.length };
  },

  async deleteMany(filter = {}) {
    const docs = findMatching(filter);
    const statement = getDB().prepare('DELETE FROM tracks WHERE id = ?');
    for (const doc of docs) statement.run(doc._id);
    return { deletedCount: docs.length };
  },

  async countDocuments(filter = {}) {
    return findMatching(filter).length;
  },

  async bulkWrite(operations = []) {
    const db = getDB();
    db.exec('BEGIN');
    try {
      for (const operation of operations) {
        if (operation.updateOne) {
          await Track.updateOne(operation.updateOne.filter, operation.updateOne.update, { upsert: operation.updateOne.upsert });
        }
      }
      db.exec('COMMIT');
      return { ok: 1 };
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  },

  async distinct(field) {
    const values = new Set();
    for (const track of allTracks()) {
      const value = field.split('.').reduce((current, key) => current?.[key], track);
      if (Array.isArray(value)) value.forEach((entry) => values.add(entry));
      else if (value !== undefined && value !== null && value !== '') values.add(value);
    }
    return Array.from(values);
  },

  async exists(filter = {}) {
    return findMatching(filter).length > 0 ? { _id: findMatching(filter)[0]._id } : null;
  },

  async create(doc) {
    return hydrateTrack(saveTrack(doc));
  },
};

export default Track;
