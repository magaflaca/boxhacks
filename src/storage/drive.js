import { Readable } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const FOLDER_KEY = 'drive_folder';
const BLOCK_BYTES = 32 * 1024 * 1024;
const MAX_RETRIES = 4;
const JSON_HEADERS = { 'content-type': 'application/json' };

class DriveError extends Error {
  constructor(status, body) {
    super(`Drive respondio ${status}: ${body.slice(0, 300)}`);
    this.status = status;
  }
}

const isRetryable = (error) => !error.status || error.status >= 500 || error.status === 429;

async function* blocks(stream, blockBytes) {
  let pending = [];
  let held = 0;
  for await (const data of stream) {
    pending.push(data);
    held += data.length;
    if (held < blockBytes) continue;
    const joined = Buffer.concat(pending);
    let offset = 0;
    for (; joined.length - offset >= blockBytes; offset += blockBytes) {
      yield joined.subarray(offset, offset + blockBytes);
    }
    pending = [joined.subarray(offset)];
    held = joined.length - offset;
  }
  if (held) yield Buffer.concat(pending);
}

function committedOffset(response) {
  const range = response.headers.get('range');
  return range ? Number(range.split('-')[1]) + 1 : 0;
}

export function createDrive({ clientId, clientSecret, refreshToken, folderName }, meta) {
  let access = { token: null, expiresAt: 0 };
  let folder;

  async function accessToken() {
    if (Date.now() < access.expiresAt) return access.token;
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!response.ok) throw new DriveError(response.status, await response.text());
    const data = await response.json();
    access = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
    return access.token;
  }

  async function call(url, init = {}, tolerated = []) {
    const headers = { ...init.headers, authorization: `Bearer ${await accessToken()}` };
    const response = await fetch(url, { ...init, headers, redirect: 'manual' });
    if (response.ok || tolerated.includes(response.status)) return response;
    throw new DriveError(response.status, await response.text());
  }

  const callJson = async (url, init) => (await call(url, init)).json();

  async function findOrCreateFolder() {
    const saved = meta.get(FOLDER_KEY);
    if (saved) return saved;
    const q = `name = '${folderName}' and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const found = await callJson(`${API}?${new URLSearchParams({ q, fields: 'files(id)' })}`);
    const id = found.files[0]?.id ?? (await callJson(`${API}?fields=id`, {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify({ name: folderName, mimeType: FOLDER_MIME }),
    })).id;
    meta.set(FOLDER_KEY, id);
    return id;
  }

  function folderId() {
    folder ??= findOrCreateFolder().catch((error) => {
      folder = undefined;
      throw error;
    });
    return folder;
  }

  function forgetFolder() {
    meta.delete(FOLDER_KEY);
    folder = undefined;
  }

  async function openSession(name, size) {
    try {
      const response = await call(`${UPLOAD}?uploadType=resumable&fields=id`, {
        method: 'POST',
        headers: { ...JSON_HEADERS, 'x-upload-content-length': String(size) },
        body: JSON.stringify({ name, parents: [await folderId()] }),
      });
      return response.headers.get('location');
    } catch (error) {
      if (error.status === 404) forgetFolder();
      throw error;
    }
  }

  const putRange = (session, range, body) =>
    call(session, { method: 'PUT', headers: { 'content-range': range }, body }, [308]);

  async function sendBlock(session, block, start, total) {
    const end = start + block.length;
    let committed = start;
    for (let failures = 0; committed < end;) {
      let response;
      try {
        response = await putRange(session, `bytes ${committed}-${end - 1}/${total}`, block.subarray(committed - start));
      } catch (error) {
        if (++failures > MAX_RETRIES || !isRetryable(error)) throw error;
        await sleep(1000 * 2 ** failures);
        response = await putRange(session, `bytes */${total}`);
      }
      if (response.status !== 308) return response.json();
      await response.arrayBuffer();
      committed = Math.max(committedOffset(response), start);
    }
    return null;
  }

  async function upload(name, stream, size) {
    const session = await openSession(name, size);
    let offset = 0;
    for await (const block of blocks(stream, BLOCK_BYTES)) {
      const created = await sendBlock(session, block, offset, size);
      if (created) return created.id;
      offset += block.length;
    }
    throw new Error('La subida a Drive termino antes de completarse');
  }

  async function download(id, from, to) {
    const response = await call(`${API}/${id}?alt=media`, { headers: { range: `bytes=${from}-${to}` } });
    return Readable.fromWeb(response.body);
  }

  async function remove(id) {
    await call(`${API}/${id}`, { method: 'DELETE' }, [404]);
  }

  async function list() {
    const files = [];
    let pageToken;
    do {
      const params = new URLSearchParams({
        q: `'${await folderId()}' in parents and trashed = false`,
        fields: 'nextPageToken, files(id, name, createdTime)',
        pageSize: '1000',
        ...(pageToken && { pageToken }),
      });
      const page = await callJson(`${API}?${params}`);
      files.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return files;
  }

  return { upload, download, remove, list };
}
