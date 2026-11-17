import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Transform } from 'node:stream';

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

export const KEY_BYTES = 32;
export const CHUNK_BYTES = 1024 * 1024;
const FRAME_BYTES = CHUNK_BYTES + TAG_BYTES;

export const sealedSize = (size) => size + Math.ceil(size / CHUNK_BYTES) * TAG_BYTES;

function chunkNonce(index) {
  const nonce = Buffer.alloc(NONCE_BYTES);
  nonce.writeBigUInt64BE(BigInt(index), NONCE_BYTES - 8);
  return nonce;
}

function sealChunk(key, plain, index) {
  const cipher = createCipheriv(ALGORITHM, key, chunkNonce(index));
  return Buffer.concat([cipher.update(plain), cipher.final(), cipher.getAuthTag()]);
}

function openChunk(key, frame, index) {
  const split = frame.length - TAG_BYTES;
  const decipher = createDecipheriv(ALGORITHM, key, chunkNonce(index));
  decipher.setAuthTag(frame.subarray(split));
  return Buffer.concat([decipher.update(frame.subarray(0, split)), decipher.final()]);
}

function blockwise(blockBytes, firstIndex, convert) {
  let pending = Buffer.alloc(0);
  let index = firstIndex;
  return new Transform({
    transform(data, _encoding, done) {
      pending = pending.length ? Buffer.concat([pending, data]) : data;
      try {
        while (pending.length >= blockBytes) {
          this.push(convert(pending.subarray(0, blockBytes), index++));
          pending = pending.subarray(blockBytes);
        }
        done();
      } catch (error) {
        done(error);
      }
    },
    flush(done) {
      try {
        if (pending.length) this.push(convert(pending, index));
        done();
      } catch (error) {
        done(error);
      }
    },
  });
}

export const encryptStream = (key) => blockwise(CHUNK_BYTES, 0, (plain, i) => sealChunk(key, plain, i));

export const decryptStream = (key, firstChunk = 0) =>
  blockwise(FRAME_BYTES, firstChunk, (frame, i) => openChunk(key, frame, i));

export function sealedRange(start, end, size) {
  const firstChunk = Math.floor(start / CHUNK_BYTES);
  const lastChunk = Math.floor(end / CHUNK_BYTES);
  return {
    firstChunk,
    from: firstChunk * FRAME_BYTES,
    to: Math.min((lastChunk + 1) * FRAME_BYTES, sealedSize(size)) - 1,
    skip: start - firstChunk * CHUNK_BYTES,
  };
}

export function sliceStream(skip, length) {
  let toSkip = skip;
  let remaining = length;
  return new Transform({
    transform(data, _encoding, done) {
      const piece = data.subarray(Math.min(toSkip, data.length), Math.min(data.length, toSkip + remaining));
      toSkip -= Math.min(toSkip, data.length);
      remaining -= piece.length;
      done(null, piece.length ? piece : undefined);
    },
  });
}

export const newKey = () => randomBytes(KEY_BYTES);

export function wrapKey(masterKey, key) {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, masterKey, nonce);
  return Buffer.concat([nonce, cipher.update(key), cipher.final(), cipher.getAuthTag()]);
}

export function unwrapKey(masterKey, wrapped) {
  const sealed = Buffer.from(wrapped);
  const decipher = createDecipheriv(ALGORITHM, masterKey, sealed.subarray(0, NONCE_BYTES));
  decipher.setAuthTag(sealed.subarray(sealed.length - TAG_BYTES));
  return Buffer.concat([decipher.update(sealed.subarray(NONCE_BYTES, sealed.length - TAG_BYTES)), decipher.final()]);
}
