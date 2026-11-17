export function createFilesRepo(db) {
  const sql = (text) => db.prepare(text);
  const q = {
    insert: sql(`INSERT INTO files (slug, storage_id, name, ext, mime, size, owner, created_at, expires_at, accessed_at)
                 VALUES (:slug, :storage_id, :name, :ext, :mime, :size, :owner, :now, :expires_at, :now)
                 ON CONFLICT (slug) DO NOTHING`),
    bySlug: sql('SELECT * FROM files WHERE slug = ?'),
    byOwner: sql('SELECT * FROM files WHERE owner = ? AND expires_at > ? ORDER BY created_at DESC'),
    expired: sql('SELECT * FROM files WHERE expires_at <= ?'),
    unsynced: sql('SELECT * FROM files WHERE drive_id IS NULL AND is_local = 1 ORDER BY created_at LIMIT 50'),
    evictable: sql('SELECT * FROM files WHERE drive_id IS NOT NULL AND is_local = 1 ORDER BY accessed_at'),
    localBytes: sql('SELECT COALESCE(SUM(size), 0) AS bytes FROM files WHERE is_local = 1'),
    storageIds: sql('SELECT storage_id FROM files'),
    touch: sql('UPDATE files SET accessed_at = ? WHERE slug = ?'),
    synced: sql('UPDATE files SET drive_id = ?, wrapped_key = ? WHERE storage_id = ?'),
    evicted: sql('UPDATE files SET is_local = 0 WHERE storage_id = ?'),
    remove: sql('DELETE FROM files WHERE storage_id = ?'),
  };

  return {
    insert: (row) => q.insert.run(row).changes === 1,
    bySlug: (slug) => q.bySlug.get(slug),
    byOwner: (owner, now) => q.byOwner.all(owner, now),
    expired: (now) => q.expired.all(now),
    unsynced: () => q.unsynced.all(),
    evictable: () => q.evictable.all(),
    localBytes: () => q.localBytes.get().bytes,
    storageIds: () => q.storageIds.all().map((row) => row.storage_id),
    touch: (slug, now) => void q.touch.run(now, slug),
    markSynced: (storageId, driveId, wrappedKey) => q.synced.run(driveId, wrappedKey, storageId).changes === 1,
    markEvicted: (storageId) => void q.evicted.run(storageId),
    remove: (storageId) => q.remove.run(storageId).changes === 1,
  };
}
