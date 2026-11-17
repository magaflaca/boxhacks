import { pipeline } from 'node:stream/promises';
import { fail } from '../../core/errors.js';
import { servedType } from '../../core/mime.js';
import { parseRange } from '../range.js';

const MAX_CACHE_SECONDS = 3600;
const SANDBOX = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; media-src 'self'";

const acceptsHtml = (req) => (req.headers.accept || '').includes('text/html');

function disposition(file, inline) {
  const fallback = file.name.replace(/[^\x20-\x7e]/g, '_');
  return `${inline ? 'inline' : 'attachment'}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`;
}

export function registerDownloadRoutes(router, { library, reader, serveStatic }) {
  async function download({ req, res, url, params }) {
    const file = library.find(params.name);
    if (!file) {
      if (acceptsHtml(req)) return serveStatic(req, res, '404.html', 404);
      fail(404, 'not_found', 'Ese archivo no existe o ya caducó.');
    }

    const etag = `"${file.storage_id}"`;
    const { type, inline } = servedType(file.mime);
    const secondsLeft = Math.floor((file.expires_at - Date.now()) / 1000);
    const headers = {
      etag,
      'content-type': type,
      'content-disposition': disposition(file, inline && !url.searchParams.has('dl')),
      'accept-ranges': 'bytes',
      'cache-control': `public, max-age=${Math.min(secondsLeft, MAX_CACHE_SECONDS)}`,
      'access-control-allow-origin': '*',
      'x-content-type-options': 'nosniff',
      'content-security-policy': SANDBOX,
    };
    if (req.headers['if-none-match'] === etag) return void res.writeHead(304, headers).end();

    const range = parseRange(req.headers.range, file.size);
    const { start, end } = range || { start: 0, end: file.size - 1 };
    headers['content-length'] = end - start + 1;
    if (range) headers['content-range'] = `bytes ${start}-${end}/${file.size}`;

    library.touch(file);
    if (req.method === 'HEAD') return void res.writeHead(range ? 206 : 200, headers).end();

    const body = await reader.open(file, start, end);
    res.writeHead(range ? 206 : 200, headers);
    await pipeline(body, res);
  }

  router.on('GET', '/:name', download);
}
