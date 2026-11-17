import { resolve } from 'node:path';

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const env = process.env;
const number = (name, fallback) => (env[name] ? Number(env[name]) : fallback);
const trimSlash = (url) => url.replace(/\/+$/, '');
const publicUrl = trimSlash(env.BOX_PUBLIC_URL || 'http://localhost:8795');

const drive = {
  clientId: env.GDRIVE_CLIENT_ID,
  clientSecret: env.GDRIVE_CLIENT_SECRET,
  refreshToken: env.GDRIVE_REFRESH_TOKEN,
  folderName: env.GDRIVE_FOLDER || 'boxhacks',
};

export const config = Object.freeze({
  host: env.BOX_HOST || '127.0.0.1',
  port: number('BOX_PORT', 8795),
  publicUrl,
  uploadUrl: trimSlash(env.BOX_UPLOAD_URL || publicUrl),
  dataDir: resolve(env.BOX_DATA_DIR || './data'),
  webDir: resolve(import.meta.dirname, '../../web'),
  masterKey: env.BOX_MASTER_KEY,
  maxFileBytes: number('BOX_MAX_FILE_GB', 5) * GiB,
  chunkBytes: number('BOX_CHUNK_MB', 16) * MiB,
  cacheBytes: number('BOX_CACHE_GB', 40) * GiB,
  minFreeBytes: number('BOX_MIN_FREE_GB', 5) * GiB,
  uploadsPerHour: number('BOX_UPLOADS_PER_HOUR', 120),
  drive: drive.clientId && drive.clientSecret && drive.refreshToken ? drive : null,
});
