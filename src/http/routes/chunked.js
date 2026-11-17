import { fail } from '../../core/errors.js';
import { readJson } from '../body.js';
import { identify } from '../identity.js';
import { send } from '../respond.js';

const PREFLIGHT_SECONDS = 86400;

export function registerChunkedRoutes(router, { chunked, config, replies: { begin, reply, replyJson } }) {
  const cors = {
    'access-control-allow-origin': config.publicUrl,
    'access-control-allow-methods': 'PUT, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': String(PREFLIGHT_SECONDS),
  };

  const identityOf = (req) => identify(req) ?? fail(401, 'no_token', 'Falta el token de la subida.');

  router.on('POST', '/api/uploads', async ({ req, res }) => {
    const identity = begin(req);
    const { name, size, slug, expires } = await readJson(req);
    const session = await chunked.open({ name, size, slug: slug || undefined, expires, owner: identity.owner });
    replyJson(res, identity, {
      id: session.id,
      chunk_bytes: session.chunkBytes,
      chunks: session.chunks,
      upload_url: config.uploadUrl,
    });
  });

  router.on('OPTIONS', '/api/uploads/:id/chunks/:index', ({ res }) => send(res, 204, '', cors));

  router.on('PUT', '/api/uploads/:id/chunks/:index', async ({ req, res, params }) => {
    try {
      await chunked.receive(params.id, Number(params.index), req);
    } catch (error) {
      error.headers = cors;
      throw error;
    }
    send(res, 204, '', cors);
  });

  router.on('POST', '/api/uploads/:id/complete', async ({ req, res, params }) => {
    const identity = identityOf(req);
    reply(req, res, identity, [await chunked.finish(params.id, identity.owner)]);
  });

  router.on('DELETE', '/api/uploads/:id', async ({ req, res, params }) => {
    await chunked.cancel(params.id, identityOf(req).owner);
    send(res, 204);
  });
}
