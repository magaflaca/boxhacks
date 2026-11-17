import { randomBytes } from 'node:crypto';
import { fail } from '../core/errors.js';

const IDLE_MS = 2 * 60 * 60_000;
const SWEEP_MS = 10 * 60_000;

export function createChunkedUploads({ spool, intake, chunkBytes }) {
  const sessions = new Map();

  function find(id) {
    return sessions.get(id) || fail(404, 'upload_not_found', 'Esa subida no existe o ya caducó.');
  }

  function owned(id, owner) {
    const session = find(id);
    if (session.owner !== owner) fail(403, 'not_owner', 'Esa subida pertenece a otra persona.');
    return session;
  }

  async function open({ name, size, slug, expires, owner }) {
    if (!Number.isSafeInteger(size) || size <= 0) fail(400, 'bad_size', 'Indica el tamaño del archivo en bytes.');
    const ttlSeconds = await intake.prepare({ slug, expires, declaredBytes: size });
    const id = randomBytes(18).toString('base64url');
    const chunks = Math.ceil(size / chunkBytes);
    sessions.set(id, {
      storageId: await spool.allocate(),
      details: { filename: name, slug, ttlSeconds, owner },
      owner, size, chunks,
      received: new Set(),
      touchedAt: Date.now(),
    });
    return { id, chunkBytes, chunks };
  }

  async function receive(id, index, stream) {
    const session = find(id);
    if (!Number.isInteger(index) || index < 0 || index >= session.chunks) fail(400, 'bad_chunk', 'Número de parte no válido.');
    const offset = index * chunkBytes;
    session.touchedAt = Date.now();
    try {
      await spool.writeAt(session.storageId, offset, stream, Math.min(chunkBytes, session.size - offset));
    } catch (error) {
      if (!sessions.has(id)) fail(404, 'upload_not_found', 'La subida se canceló.');
      throw error;
    }
    session.received.add(index);
    session.touchedAt = Date.now();
  }

  async function finish(id, owner) {
    const session = owned(id, owner);
    const missing = session.chunks - session.received.size;
    if (missing) fail(409, 'incomplete', `Faltan ${missing} partes por subir.`);
    sessions.delete(id);
    return intake.commit({ storageId: session.storageId, size: session.size }, session.details);
  }

  async function discard(id) {
    const session = sessions.get(id);
    sessions.delete(id);
    if (session) await spool.remove(session.storageId);
  }

  async function cancel(id, owner) {
    owned(id, owner);
    await discard(id);
  }

  const sweeper = setInterval(() => {
    const cutoff = Date.now() - IDLE_MS;
    for (const [id, session] of sessions) if (session.touchedAt < cutoff) discard(id);
  }, SWEEP_MS);
  sweeper.unref();

  return { open, receive, finish, cancel, stop: () => clearInterval(sweeper) };
}
