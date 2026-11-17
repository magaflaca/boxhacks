import { parseExpiry } from '../core/expiry.js';

export function createIntake({ spool, library, sync }) {
  async function prepare({ slug, expires, declaredBytes }) {
    const ttlSeconds = parseExpiry(expires);
    if (slug) await library.assertAvailable(slug);
    await spool.assertRoom(declaredBytes);
    return ttlSeconds;
  }

  async function store({ stream, filename, slug, ttlSeconds, owner }) {
    const stored = await spool.receive(stream);
    try {
      const file = await library.register({ ...stored, filename, slug, ttlSeconds, owner });
      sync.kick();
      return file;
    } catch (error) {
      await spool.remove(stored.storageId);
      throw error;
    }
  }

  return { prepare, store };
}
