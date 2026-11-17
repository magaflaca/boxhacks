import { parseExpiry } from '../core/expiry.js';

export function createIntake({ spool, library, sync }) {
  async function prepare({ slug, expires, declaredBytes }) {
    const ttlSeconds = parseExpiry(expires);
    if (slug) await library.assertAvailable(slug);
    await spool.assertRoom(declaredBytes);
    return ttlSeconds;
  }

  async function commit(stored, { filename, slug, ttlSeconds, owner }) {
    try {
      const file = await library.register({ ...stored, filename, slug, ttlSeconds, owner });
      sync.kick();
      return file;
    } catch (error) {
      await spool.remove(stored.storageId);
      throw error;
    }
  }

  async function store({ stream, ...details }) {
    return commit(await spool.receive(stream), details);
  }

  return { prepare, commit, store };
}
