import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { json, startBox } from './helpers.js';

describe('subida troceada', () => {
  let box;
  before(async () => (box = await startBox()));
  after(() => box.close());

  async function open(body, headers = {}) {
    const response = await box.request('/api/uploads', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', ...json, ...headers },
    });
    return { status: response.status, body: await response.json() };
  }

  const chunkOf = (data, size, index) => data.subarray(index * size, (index + 1) * size);
  const putChunk = (id, index, body) => box.request(`/api/uploads/${id}/chunks/${index}`, { method: 'PUT', body });
  const auth = (token) => ({ authorization: `Bearer ${token}` });

  test('reensambla partes llegadas en cualquier orden', async () => {
    const data = randomBytes(4321);
    const { status, body: session } = await open({ name: 'clip.mp4', size: data.length, slug: 'troceado', expires: '1d' });
    assert.equal(status, 201);
    assert.equal(session.chunks, 5);
    assert.equal(session.chunk_bytes, 1000);
    assert.equal(session.upload_url, 'http://up.box.test');
    assert.ok(session.token);

    for (const index of [3, 0, 4, 2, 1]) {
      const response = await putChunk(session.id, index, chunkOf(data, session.chunk_bytes, index));
      assert.equal(response.status, 204);
      assert.equal(response.headers.get('access-control-allow-origin'), 'http://box.test');
    }

    const done = await box.request(`/api/uploads/${session.id}/complete`, { method: 'POST', headers: auth(session.token) });
    assert.equal((await done.text()).trim(), 'http://box.test/troceado.mp4');
    const download = await box.request('/troceado.mp4');
    assert.deepEqual(Buffer.from(await download.arrayBuffer()), data);
  });

  test('no cierra una subida a la que le faltan partes', async () => {
    const { body: session } = await open({ name: 'a.bin', size: 2500 });
    await putChunk(session.id, 0, randomBytes(1000));
    const response = await box.request(`/api/uploads/${session.id}/complete`, {
      method: 'POST', headers: { ...auth(session.token), ...json },
    });
    assert.equal(response.status, 409);
    assert.match((await response.json()).message, /2 partes/);
  });

  test('rechaza partes de tamaño o número incorrecto', async () => {
    const { body: session } = await open({ name: 'b.bin', size: 2500 });
    assert.equal((await putChunk(session.id, 0, randomBytes(999))).status, 400);
    assert.equal((await putChunk(session.id, 2, randomBytes(501))).status, 400);
    assert.equal((await putChunk(session.id, 3, randomBytes(10))).status, 400);
    assert.equal((await putChunk('no-existe', 0, randomBytes(10))).status, 404);
  });

  test('solo quien abrió la subida puede cerrarla o cancelarla', async () => {
    const { body: session } = await open({ name: 'c.bin', size: 10 });
    await putChunk(session.id, 0, randomBytes(10));
    const stranger = (await open({ name: 'otro.bin', size: 1 })).body.token;
    const finish = (headers) => box.request(`/api/uploads/${session.id}/complete`, { method: 'POST', headers });
    assert.equal((await finish(auth(stranger))).status, 403);
    assert.equal((await finish({})).status, 401);
    assert.equal((await box.request(`/api/uploads/${session.id}`, { method: 'DELETE', headers: auth(session.token) })).status, 204);
    assert.equal((await finish(auth(session.token))).status, 404);
  });

  test('valida nombre, caducidad y tamaño al abrir', async () => {
    await box.request('/x.txt?slug=pillado', { method: 'PUT', body: 'x' });
    assert.equal((await open({ name: 'd.bin', size: 10, slug: 'pillado' })).status, 409);
    assert.equal((await open({ name: 'd.bin', size: 10, expires: '90d' })).status, 400);
    assert.equal((await open({ name: 'd.bin', size: 0 })).status, 400);
    assert.equal((await open({ name: 'd.bin', size: 128 * 1024 * 1024 })).status, 413);
  });

  test('responde al preflight de CORS', async () => {
    const response = await box.request('/api/uploads/x/chunks/0', { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://box.test');
    assert.match(response.headers.get('access-control-allow-methods'), /PUT/);
  });

  test('sirve el script de subida', async () => {
    const response = await box.request('/box.py');
    assert.equal(response.status, 200);
    assert.match(await response.text(), /api\/uploads/);
  });
});
