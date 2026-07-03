import { getDB, serialize } from '../db.js';
import { Query, applyUpdate, cloneDoc, createId, matchesFilter, parseJson, toIsoDate } from './sqliteModelUtils.js';

function rowToPlaylist(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    type: row.type,
    trackIds: parseJson(row.track_ids_json, []),
    rule: row.rule,
    limit: row.limit_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizePlaylist(playlist = {}) {
  const now = new Date().toISOString();
  return {
    _id: String(playlist._id ?? playlist.id ?? createId()),
    name: playlist.name,
    type: playlist.type,
    trackIds: Array.isArray(playlist.trackIds) ? playlist.trackIds.map(String) : [],
    rule: playlist.rule ?? null,
    limit: Number(playlist.limit ?? 50),
    createdAt: toIsoDate(playlist.createdAt, now),
    updatedAt: toIsoDate(playlist.updatedAt, now),
  };
}

function savePlaylist(playlist) {
  const doc = normalizePlaylist({ ...playlist, updatedAt: new Date().toISOString() });
  getDB().prepare(`
    INSERT INTO playlists (id, name, type, track_ids_json, rule, limit_count, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      type = excluded.type,
      track_ids_json = excluded.track_ids_json,
      rule = excluded.rule,
      limit_count = excluded.limit_count,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at
  `).run(doc._id, doc.name, doc.type, serialize(doc.trackIds), doc.rule, doc.limit, doc.createdAt, doc.updatedAt);
  return doc;
}

function allPlaylists() {
  return getDB().prepare('SELECT * FROM playlists').all().map(rowToPlaylist);
}

function hydratePlaylist(doc) {
  if (!doc) return null;
  const hydrated = cloneDoc(doc);
  hydrated.save = async () => savePlaylist(hydrated);
  return hydrated;
}

function findMatching(filter = {}) {
  return allPlaylists().filter((playlist) => matchesFilter(playlist, filter));
}

const Playlist = {
  find(filter = {}) {
    return new Query(() => findMatching(filter), { hydrate: hydratePlaylist });
  },

  findOne(filter = {}) {
    return new Query(() => findMatching(filter)[0] ?? null, { hydrate: hydratePlaylist, single: true });
  },

  async create(doc) {
    return hydratePlaylist(savePlaylist(doc));
  },

  async findOneAndDelete(filter = {}) {
    const doc = findMatching(filter)[0];
    if (!doc) return null;
    getDB().prepare('DELETE FROM playlists WHERE id = ?').run(doc._id);
    return hydratePlaylist(doc);
  },

  async updateMany(filter = {}, update = {}) {
    const docs = findMatching(filter);
    for (const doc of docs) savePlaylist(applyUpdate(doc, update));
    return { matchedCount: docs.length, modifiedCount: docs.length };
  },
};

export default Playlist;
