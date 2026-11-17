import { pipeline } from 'node:stream';
import { decryptStream, sealedRange, sliceStream, unwrapKey } from './crypto.js';

export function createReader({ spool, drive, masterKey }) {
  async function open(file, start, end) {
    if (file.is_local) return spool.read(file.storage_id, { start, end });
    if (!drive || !file.drive_id) throw new Error(`Sin copia disponible de ${file.slug}`);

    const range = sealedRange(start, end, file.size);
    const key = unwrapKey(masterKey, file.wrapped_key);
    const sealed = await drive.download(file.drive_id, range.from, range.to);
    return pipeline(sealed, decryptStream(key, range.firstChunk), sliceStream(range.skip, end - start + 1), () => {});
  }

  return { open };
}
