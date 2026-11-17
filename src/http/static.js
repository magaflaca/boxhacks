import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { fail } from '../core/errors.js';
import { assetType } from '../core/mime.js';

export function createStatic(rootDir) {
  return async function serve(req, res, relativePath, status = 200) {
    const path = normalize(join(rootDir, relativePath));
    if (!path.startsWith(rootDir + sep)) fail(404, 'not_found', 'No existe.');

    const info = await stat(path).catch(() => null);
    if (!info?.isFile()) fail(404, 'not_found', 'No existe.');

    const etag = `"${info.size.toString(36)}-${Math.round(info.mtimeMs).toString(36)}"`;
    const headers = { etag, 'cache-control': 'no-cache', 'content-type': assetType(extname(path).slice(1)) };
    if (status === 200 && req.headers['if-none-match'] === etag) return void res.writeHead(304, headers).end();

    res.writeHead(status, { ...headers, 'content-length': info.size });
    if (req.method === 'HEAD') return void res.end();
    await pipeline(createReadStream(path), res);
  };
}
