const PARALLEL_CHUNKS = 3;
const RETRIES = 3;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function failure(xhr, fallback) {
  try {
    return new Error(JSON.parse(xhr.responseText).message);
  } catch {
    return new Error(fallback);
  }
}

export function chunkedUpload(file, { request, slug, expires, onProgress }) {
  const requests = new Set();
  const sent = new Map();
  let session;
  let cancelled = false;

  const report = () => onProgress([...sent.values()].reduce((sum, bytes) => sum + bytes, 0) / file.size);

  function sendOnce(url, blob, index) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      requests.add(xhr);
      xhr.open('PUT', url);
      xhr.upload.onprogress = (event) => {
        sent.set(index, event.loaded);
        report();
      };
      xhr.onloadend = () => requests.delete(xhr);
      xhr.onload = () => (xhr.status === 204 ? resolve() : reject(failure(xhr, 'La subida falló.')));
      xhr.onerror = () => reject(new Error('Se cortó la conexión.'));
      xhr.onabort = () => reject(new Error('Cancelado.'));
      xhr.send(blob);
    });
  }

  async function sendChunk(index) {
    const start = index * session.chunk_bytes;
    const blob = file.slice(start, start + session.chunk_bytes);
    const url = `${session.upload_url}/api/uploads/${session.id}/chunks/${index}`;
    for (let attempt = 0; ; attempt++) {
      try {
        await sendOnce(url, blob, index);
        sent.set(index, blob.size);
        return report();
      } catch (error) {
        sent.set(index, 0);
        if (cancelled || attempt === RETRIES) throw error;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  async function sendAll() {
    let next = 0;
    const worker = async () => {
      while (next < session.chunks) await sendChunk(next++);
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_CHUNKS, session.chunks) }, worker));
  }

  function cancel() {
    cancelled = true;
    requests.forEach((xhr) => xhr.abort());
    if (session) request(`/api/uploads/${session.id}`, { method: 'DELETE' }).catch(() => {});
  }

  const done = (async () => {
    session = await request('/api/uploads', {
      method: 'POST',
      body: JSON.stringify({ name: file.name, size: file.size, slug, expires }),
    });
    try {
      await sendAll();
    } catch (error) {
      cancel();
      throw error;
    }
    return request(`/api/uploads/${session.id}/complete`, { method: 'POST' });
  })();

  return { done, cancel };
}
