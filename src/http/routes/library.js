import { fail } from '../../core/errors.js';
import { DEFAULT_EXPIRY, EXPIRY_OPTIONS } from '../../core/expiry.js';
import { identify } from '../identity.js';
import { send, sendJson } from '../respond.js';

export function registerLibraryRoutes(router, { library, config }) {
  function requireFile(slug) {
    return library.find(slug) || fail(404, 'not_found', 'Ese archivo no existe o ya caduco.');
  }

  router.on('GET', '/api/config', ({ res }) => {
    sendJson(res, 200, {
      public_url: config.publicUrl,
      max_bytes: config.maxFileBytes,
      expiry_options: EXPIRY_OPTIONS,
      default_expiry: DEFAULT_EXPIRY,
    });
  });

  router.on('GET', '/api/files', ({ req, res }) => {
    const identity = identify(req);
    const files = identity ? library.ownedBy(identity.owner).map(library.present) : [];
    sendJson(res, 200, { files });
  });

  router.on('GET', '/api/files/:slug', ({ res, params }) => {
    sendJson(res, 200, library.present(requireFile(params.slug)));
  });

  router.on('DELETE', '/api/files/:slug', async ({ req, res, params }) => {
    const file = requireFile(params.slug);
    if (identify(req)?.owner !== file.owner) fail(403, 'not_owner', 'Solo quien subio el archivo puede borrarlo.');
    await library.destroy(file);
    send(res, 204);
  });

  router.on('GET', '/api/slugs/:slug', async ({ res, params }) => {
    try {
      await library.assertAvailable(params.slug);
      sendJson(res, 200, { available: true });
    } catch (error) {
      if (!error.status) throw error;
      sendJson(res, 200, { available: false, reason: error.code, message: error.message });
    }
  });
}
