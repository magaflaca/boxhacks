import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KEY_BYTES } from './crypto.js';

function decode(hex, origin) {
  const key = Buffer.from(hex.trim(), 'hex');
  if (key.length !== KEY_BYTES) throw new Error(`${origin} debe contener ${KEY_BYTES * 2} caracteres hex`);
  return key;
}

export function loadMasterKey(fromEnv, dataDir) {
  if (fromEnv) return decode(fromEnv, 'BOX_MASTER_KEY');
  const path = join(dataDir, 'master.key');
  if (!existsSync(path)) writeFileSync(path, randomBytes(KEY_BYTES).toString('hex'), { mode: 0o600 });
  return decode(readFileSync(path, 'utf8'), path);
}
