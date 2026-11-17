import { chunkedUpload } from './chunked-upload.js';

const JSON_HEADERS = { accept: 'application/json', 'content-type': 'application/json' };

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
  script: async () => (await fetch('/box.py')).text(),
  upload: (file, options) => chunkedUpload(file, { ...options, request }),
};
