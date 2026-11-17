import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { after, before, describe, test } from 'node:test';
import { json, memoryDrive, startBox } from './helpers.js';

describe('api con disco local', () => {
  let box;
  before(async () => (box = await startBox()));
  after(() => box.close());

  const put = (path, body, headers = {}) => box.request(path, { method: 'PUT', body, headers });

  test('curl -T devuelve la url en texto plano', async () => {
    const response = await put('/hola.txt', 'hola mundo');
    assert.equal(response.status, 201);
    const url = (await response.text()).trim();
    assert.match(url, /^http:\/\/box\.test\/[a-z0-9]{6}\.txt$/);
    assert.ok(response.headers.get('x-box-token'));

    const download = await box.request(new URL(url).pathname);
    assert.equal(await download.text(), 'hola mundo');
    assert.match(download.headers.get('content-type'), /^text\/plain/);
  });

  test('nombre personalizado, con y sin extension', async () => {
    const response = await put('/api/files/clip.mp4?slug=mi-video&expires=1h', randomBytes(2048), json);
    const file = await response.json();
    assert.equal(file.url, 'http://box.test/mi-video.mp4');
    assert.ok(file.token);
    assert.ok(Date.parse(file.expires_at) - Date.now() <= 3600_000);

    for (const path of ['/mi-video', '/mi-video.mp4', '/MI-VIDEO.mp4']) {
      const download = await box.request(path, { method: 'HEAD' });
      assert.equal(download.status, 200, path);
      assert.equal(download.headers.get('content-type'), 'video/mp4');
      assert.equal(download.headers.get('content-length'), '2048');
    }
    assert.equal((await box.request('/mi-video.png')).status, 404);
  });

  test('rechaza nombres ocupados, reservados o invalidos', async () => {
    await put('/a.txt?slug=ocupado', 'x');
    assert.equal((await put('/b.txt?slug=ocupado', 'x', json)).status, 409);
    assert.equal((await put('/b.txt?slug=api', 'x', json)).status, 409);
    assert.equal((await put('/b.txt?slug=con.punto', 'x', json)).status, 400);
    assert.equal((await put('/b.txt?expires=90d', 'x', json)).status, 400);

    const check = await (await box.request('/api/slugs/ocupado')).json();
    assert.equal(check.available, false);
    assert.equal((await (await box.request('/api/slugs/libre-seguro')).json()).available, true);
  });

  test('multipart con curl -F', async () => {
    const form = new FormData();
    form.append('slug', 'formulario');
    form.append('file', new Blob(['datos']), 'notas.md');
    const response = await box.request('/api/files', { method: 'POST', body: form });
    assert.equal((await response.text()).trim(), 'http://box.test/formulario.md');
  });

  test('sirve rangos de bytes', async () => {
    const data = randomBytes(10_000);
    await put('/r.bin?slug=rangos', data);
    const partial = await box.request('/rangos', { headers: { range: 'bytes=100-199' } });
    assert.equal(partial.status, 206);
    assert.equal(partial.headers.get('content-range'), 'bytes 100-199/10000');
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), data.subarray(100, 200));

    const tail = await box.request('/rangos', { headers: { range: 'bytes=-50' } });
    assert.deepEqual(Buffer.from(await tail.arrayBuffer()), data.subarray(9950));
    assert.equal((await box.request('/rangos', { headers: { range: 'bytes=20000-' } })).status, 416);
  });

  test('el token recuerda los archivos y permite borrarlos', async () => {
    const first = await (await put('/uno.txt', '1', json)).json();
    const auth = { authorization: `Bearer ${first.token}`, ...json };
    const second = await (await put('/dos.txt', '2', auth)).json();
    assert.equal(second.token, undefined);

    const mine = await (await box.request('/api/files', { headers: auth })).json();
    assert.deepEqual(mine.files.map((file) => file.slug).sort(), [first.slug, second.slug].sort());

    const cookie = { cookie: `box_token=${first.token}` };
    assert.equal((await (await box.request('/api/files', { headers: cookie })).json()).files.length, 2);

    assert.equal((await box.request(`/api/files/${first.slug}`, { method: 'DELETE' })).status, 403);
    assert.equal((await box.request(`/api/files/${first.slug}`, { method: 'DELETE', headers: auth })).status, 204);
    assert.equal((await box.request(`/${first.slug}`)).status, 404);
  });

  test('no ejecuta html subido por usuarios', async () => {
    await put('/pagina.html?slug=pagina', '<script>alert(1)</script>');
    const response = await box.request('/pagina.html');
    assert.match(response.headers.get('content-type'), /^text\/plain/);
    assert.match(response.headers.get('content-security-policy'), /sandbox/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  });

  test('rechaza archivos vacios y demasiado grandes', async () => {
    assert.equal((await put('/vacio.txt', '', json)).status, 400);
    const small = await startBox({ maxFileBytes: 1000 });
    const response = await small.request('/grande.bin', { method: 'PUT', body: randomBytes(5000), headers: json });
    assert.equal(response.status, 413);
    await small.close();
  });

  test('los archivos caducados desaparecen', async () => {
    const file = await (await put('/breve.txt?slug=breve', 'x', json)).json();
    box.files.touch(file.slug, Date.now());
    const row = box.files.bySlug('breve');
    box.files.remove(row.storage_id);
    box.files.insert({ ...pick(row), slug: 'breve', now: Date.now() - 10_000, expires_at: Date.now() - 1 });
    assert.equal((await box.request('/breve')).status, 404);
    await box.reaper.tick();
    assert.equal(box.files.bySlug('breve'), undefined);
    assert.equal((await put('/otro.txt?slug=breve', 'y', json)).status, 201);
  });
});

const pick = ({ storage_id, name, ext, mime, size, owner }) => ({ storage_id, name, ext, mime, size, owner });

describe('api con drive', () => {
  test('sube cifrado, desaloja la cache local y sirve desde drive', async () => {
    const drive = memoryDrive();
    const box = await startBox({ drive, cacheBytes: 0 });
    const data = randomBytes(3 * 1024 * 1024 + 4321);

    const response = await box.request('/video.mp4?slug=remoto', { method: 'PUT', body: data, headers: json });
    const file = await response.json();
    await box.settled();

    const [stored] = [...drive.objects.values()];
    assert.equal(drive.objects.size, 1);
    assert.notEqual(stored.name, 'video.mp4');
    assert.equal(stored.data.indexOf(data.subarray(0, 64)), -1);
    assert.ok(stored.data.length > data.length);

    await box.reaper.tick();
    assert.equal(box.files.bySlug('remoto').is_local, 0);

    const full = await box.request('/remoto.mp4');
    assert.deepEqual(Buffer.from(await full.arrayBuffer()), data);

    const start = 1024 * 1024 - 10;
    const partial = await box.request('/remoto.mp4', { headers: { range: `bytes=${start}-${start + 99}` } });
    assert.equal(partial.status, 206);
    assert.deepEqual(Buffer.from(await partial.arrayBuffer()), data.subarray(start, start + 100));

    const auth = { authorization: `Bearer ${file.token}` };
    assert.equal((await box.request('/api/files/remoto', { method: 'DELETE', headers: auth })).status, 204);
    assert.equal(drive.objects.size, 0);
    await box.close();
  });
});
