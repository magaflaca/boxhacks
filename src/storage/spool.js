import { randomBytes } from 'node:crypto';
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { readdir, rm, statfs } from 'node:fs/promises';
import { join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { HttpError, fail } from '../core/errors.js';

function byteLimit(maxBytes, counter) {
  return new Transform({
    transform(data, _encoding, done) {
      counter.bytes += data.length;
      if (counter.bytes > maxBytes) return done(tooLarge(maxBytes));
      done(null, data);
    },
  });
}

function tooLarge(maxBytes) {
  return new HttpError(413, 'too_large', `El archivo supera el límite de ${Math.round(maxBytes / 1024 ** 3)} GB.`);
}

export function createSpool(dataDir, { maxBytes, minFreeBytes }) {
  const dir = join(dataDir, 'spool');
  mkdirSync(dir, { recursive: true });
  const pathOf = (storageId) => join(dir, storageId);

  async function assertRoom(incomingBytes = 0) {
    if (incomingBytes > maxBytes) throw tooLarge(maxBytes);
    const { bavail, bsize } = await statfs(dir);
    if (bavail * bsize - incomingBytes < minFreeBytes) {
      fail(507, 'storage_full', 'No queda espacio para recibir archivos ahora mismo.');
    }
  }

  async function receive(stream) {
    const storageId = randomBytes(16).toString('hex');
    const counter = { bytes: 0 };
    try {
      await pipeline(stream, byteLimit(maxBytes, counter), createWriteStream(pathOf(storageId)));
      if (counter.bytes === 0) fail(400, 'empty_file', 'El archivo está vacío.');
    } catch (error) {
      await remove(storageId);
      throw error;
    }
    return { storageId, size: counter.bytes };
  }

  const read = (storageId, range) => createReadStream(pathOf(storageId), range);
  const remove = (storageId) => rm(pathOf(storageId), { force: true });

  async function removeOrphans(knownIds) {
    const known = new Set(knownIds);
    const stray = (await readdir(dir)).filter((name) => !known.has(name));
    await Promise.all(stray.map(remove));
  }

  return { assertRoom, receive, read, remove, removeOrphans };
}
