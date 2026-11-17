import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createApp } from './http/app.js';
import { createChunkedUploads } from './services/chunked.js';
import { createIntake } from './services/intake.js';
import { createLibrary } from './services/library.js';
import { createReaper } from './services/reaper.js';
import { createSync } from './services/sync.js';
import { loadMasterKey } from './storage/master-key.js';
import { createReader } from './storage/reader.js';
import { createSpool } from './storage/spool.js';
import { createMeta, openDatabase } from './store/database.js';
import { createFilesRepo } from './store/files.js';

export function createContainer({ config, createDrive, log = console }) {
  mkdirSync(config.dataDir, { recursive: true });
  const db = openDatabase(join(config.dataDir, 'box.db'));
  const files = createFilesRepo(db);
  const masterKey = loadMasterKey(config.masterKey, config.dataDir);
  const drive = config.drive ? createDrive(config.drive, createMeta(db)) : null;
  const spool = createSpool(config.dataDir, { maxBytes: config.maxFileBytes, minFreeBytes: config.minFreeBytes });

  const library = createLibrary({ files, spool, drive, publicUrl: config.publicUrl, log });
  const sync = createSync({ files, spool, drive, masterKey, log });
  const reaper = createReaper({ files, spool, drive, library, cacheBytes: config.cacheBytes, log });
  const intake = createIntake({ spool, library, sync });
  const chunked = createChunkedUploads({ spool, intake, chunkBytes: config.chunkBytes });
  const reader = createReader({ spool, drive, masterKey });
  const app = createApp({ config, library, intake, chunked, reader, log });

  async function start() {
    await spool.removeOrphans(files.storageIds());
    sync.start();
    reaper.start();
  }

  function stop() {
    sync.stop();
    reaper.stop();
    chunked.stop();
    db.close();
  }

  return { app, files, sync, reaper, start, stop };
}
