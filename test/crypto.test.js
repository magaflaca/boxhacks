import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { buffer } from 'node:stream/consumers';
import { test } from 'node:test';
import {
  CHUNK_BYTES, decryptStream, encryptStream, newKey, sealedRange, sealedSize, sliceStream, unwrapKey, wrapKey,
} from '../src/storage/crypto.js';

const pieces = (data, size) => Array.from({ length: Math.ceil(data.length / size) }, (_, i) => data.subarray(i * size, (i + 1) * size));
const seal = (key, plain) => buffer(Readable.from(pieces(plain, 70_001)).pipe(encryptStream(key)));

test('cifra y descifra archivos de varios bloques', async () => {
  const key = newKey();
  const plain = randomBytes(CHUNK_BYTES * 2 + 12345);
  const sealed = await seal(key, plain);

  assert.equal(sealed.length, sealedSize(plain.length));
  assert.equal(sealed.indexOf(plain.subarray(0, 32)), -1);
  const opened = await buffer(Readable.from(pieces(sealed, 99_991)).pipe(decryptStream(key)));
  assert.deepEqual(opened, plain);
});

test('lee rangos arbitrarios sin descifrar el archivo entero', async () => {
  const key = newKey();
  const plain = randomBytes(CHUNK_BYTES * 3 + 777);
  const sealed = await seal(key, plain);
  const last = plain.length - 1;

  for (const [start, end] of [[0, 0], [5, CHUNK_BYTES + 5], [CHUNK_BYTES, CHUNK_BYTES * 2 - 1], [CHUNK_BYTES * 3, last], [last, last], [0, last]]) {
    const range = sealedRange(start, end, plain.length);
    const part = sealed.subarray(range.from, range.to + 1);
    const opened = await buffer(
      Readable.from([part]).pipe(decryptStream(key, range.firstChunk)).pipe(sliceStream(range.skip, end - start + 1)),
    );
    assert.deepEqual(opened, plain.subarray(start, end + 1), `rango ${start}-${end}`);
  }
});

test('rechaza datos manipulados', async () => {
  const key = newKey();
  const sealed = await seal(key, randomBytes(5000));
  sealed[100] ^= 1;
  await assert.rejects(buffer(Readable.from([sealed]).pipe(decryptStream(key))));
});

test('envuelve la clave del archivo con la clave maestra', () => {
  const master = newKey();
  const key = newKey();
  assert.deepEqual(unwrapKey(master, wrapKey(master, key)), key);
  assert.throws(() => unwrapKey(newKey(), wrapKey(master, key)));
});
