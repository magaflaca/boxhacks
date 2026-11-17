import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { setTimeout as sleep } from 'node:timers/promises';
import { createContainer } from '../src/container.js';

export function memoryDrive() {
  const objects = new Map();
  return {
    objects,
    async upload(name, stream) {
      const id = randomBytes(8).toString('hex');
      objects.set(id, { name, data: await buffer(stream), createdTime: new Date().toISOString() });
      return id;
    },
    async download(id, from, to) {
      return Readable.from([objects.get(id).data.subarray(from, to + 1)]);
    },
    async remove(id) {
      objects.delete(id);
    },
    async list() {
      return [...objects].map(([id, { name, createdTime }]) => ({ id, name, createdTime }));
    },
  };
}

export async function startBox({ drive, ...overrides } = {}) {
  const dataDir = mkdtempSync(join(tmpdir(), 'boxhacks-'));
  const config = {
    publicUrl: 'http://box.test',
    dataDir,
    webDir: resolve(import.meta.dirname, '../web'),
    maxFileBytes: 64 * 1024 * 1024,
    cacheBytes: 1024 ** 3,
    minFreeBytes: 0,
    uploadsPerHour: 1000,
    drive: drive ? {} : null,
    ...overrides,
  };
  const quiet = { warn() {}, error() {} };
  const container = createContainer({ config, createDrive: () => drive, log: quiet });
  await container.start();

  const server = createServer(container.app);
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const origin = `http://127.0.0.1:${server.address().port}`;

  async function close() {
    server.closeAllConnections();
    await new Promise((done) => server.close(done));
    container.stop();
    rmSync(dataDir, { recursive: true, force: true });
  }

  async function settled() {
    while (container.files.unsynced().length || !container.sync.idle()) await sleep(10);
  }

  return { ...container, origin, close, settled, request: (path, init) => fetch(origin + path, init) };
}

export const json = { accept: 'application/json' };
