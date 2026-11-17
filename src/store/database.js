import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS files (
    slug        TEXT PRIMARY KEY COLLATE NOCASE,
    storage_id  TEXT NOT NULL UNIQUE,
    name        TEXT NOT NULL,
    ext         TEXT NOT NULL,
    mime        TEXT NOT NULL,
    size        INTEGER NOT NULL,
    owner       TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    expires_at  INTEGER NOT NULL,
    accessed_at INTEGER NOT NULL,
    is_local    INTEGER NOT NULL DEFAULT 1,
    drive_id    TEXT,
    wrapped_key BLOB
  );
  CREATE INDEX IF NOT EXISTS files_owner ON files (owner, created_at);
  CREATE INDEX IF NOT EXISTS files_expiry ON files (expires_at);
  CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

export function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
  db.exec(SCHEMA);
  return db;
}

export function createMeta(db) {
  const read = db.prepare('SELECT value FROM meta WHERE key = ?');
  const write = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');
  const erase = db.prepare('DELETE FROM meta WHERE key = ?');
  return {
    get: (key) => read.get(key)?.value,
    set: (key, value) => void write.run(key, value),
    delete: (key) => void erase.run(key),
  };
}
