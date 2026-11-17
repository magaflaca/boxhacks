import { pipeline } from 'node:stream';
import { encryptStream, newKey, sealedSize, wrapKey } from '../storage/crypto.js';

const CONCURRENCY = 2;
const POLL_MS = 15_000;
const MAX_BACKOFF_MS = 10 * 60_000;

export function createSync({ files, spool, drive, masterKey, log }) {
  const inFlight = new Set();
  const backoff = new Map();
  let timer;

  async function push(file) {
    const key = newKey();
    const sealed = pipeline(spool.read(file.storage_id), encryptStream(key), () => {});
    const driveId = await drive.upload(file.storage_id, sealed, sealedSize(file.size));
    if (!files.markSynced(file.storage_id, driveId, wrapKey(masterKey, key))) await drive.remove(driveId);
  }

  async function run(file) {
    const id = file.storage_id;
    inFlight.add(id);
    try {
      await push(file);
      backoff.delete(id);
    } catch (error) {
      const attempts = (backoff.get(id)?.attempts ?? 0) + 1;
      const wait = Math.min(MAX_BACKOFF_MS, 5000 * 2 ** attempts);
      backoff.set(id, { attempts, until: Date.now() + wait });
      log.warn(`sync ${file.slug} fallo (intento ${attempts})`, error.message);
    } finally {
      inFlight.delete(id);
      kick();
    }
  }

  function kick() {
    if (!drive) return;
    const ready = files.unsynced().filter(
      (file) => !inFlight.has(file.storage_id) && (backoff.get(file.storage_id)?.until ?? 0) <= Date.now(),
    );
    for (const file of ready.slice(0, CONCURRENCY - inFlight.size)) run(file);
  }

  function start() {
    timer = setInterval(kick, POLL_MS);
    timer.unref();
    kick();
  }

  const idle = () => inFlight.size === 0;

  return { start, kick, idle, stop: () => clearInterval(timer) };
}
