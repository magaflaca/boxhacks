const JSON_HEADERS = { accept: 'application/json' };

async function request(path, init = {}) {
  const response = await fetch(path, { ...init, headers: JSON_HEADERS });
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(body?.message || 'Algo falló.');
  return body;
}

export const api = {
  config: () => request('/api/config'),
  myFiles: async () => (await request('/api/files')).files,
  remove: (slug) => request(`/api/files/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
  checkSlug: (slug) => request(`/api/slugs/${encodeURIComponent(slug)}`),

  upload(file, { slug, expires, onProgress }) {
    const query = new URLSearchParams({ expires, ...(slug && { slug }) });
    const xhr = new XMLHttpRequest();
    const done = new Promise((resolve, reject) => {
      xhr.open('PUT', `/api/files/${encodeURIComponent(file.name)}?${query}`);
      xhr.setRequestHeader('accept', JSON_HEADERS.accept);
      xhr.responseType = 'json';
      xhr.upload.onprogress = (event) => onProgress(event.loaded / event.total);
      xhr.onload = () => (xhr.status === 201 ? resolve(xhr.response) : reject(new Error(xhr.response?.message || 'La subida falló.')));
      xhr.onerror = () => reject(new Error('Se cortó la conexión.'));
      xhr.onabort = () => reject(new Error('Cancelado.'));
      xhr.send(file);
    });
    return { done, cancel: () => xhr.abort() };
  },
};
