import { createRateLimit } from './rate-limit.js';
import { sendError } from './respond.js';
import { createRouter } from './router.js';
import { registerChunkedRoutes } from './routes/chunked.js';
import { registerDownloadRoutes } from './routes/downloads.js';
import { registerLibraryRoutes } from './routes/library.js';
import { registerUploadRoutes } from './routes/uploads.js';
import { createStatic } from './static.js';
import { createUploadReplies } from './upload-replies.js';

const ABORTED = new Set(['ERR_STREAM_PREMATURE_CLOSE', 'ECONNRESET', 'ABORT_ERR']);

export function createApp({ config, library, intake, chunked, reader, log }) {
  const router = createRouter();
  const serveStatic = createStatic(config.webDir);
  const replies = createUploadReplies({
    library,
    limit: createRateLimit(config.uploadsPerHour),
    secureCookies: config.publicUrl.startsWith('https://'),
  });
  const deps = { config, library, intake, chunked, reader, replies, serveStatic };

  router.on('GET', '/', ({ req, res }) => serveStatic(req, res, 'index.html'));
  router.on('GET', '/assets/*', ({ req, res, params }) => serveStatic(req, res, `assets/${params.rest}`));
  router.on('GET', '/box.py', ({ req, res }) => serveStatic(req, res, 'box.py'));
  registerLibraryRoutes(router, deps);
  registerChunkedRoutes(router, deps);
  registerUploadRoutes(router, deps);
  registerDownloadRoutes(router, deps);

  return async function handle(req, res) {
    try {
      const url = new URL(req.url, 'http://box');
      const { handler, params } = router.resolve(req.method, url.pathname);
      await handler({ req, res, url, params });
    } catch (error) {
      if (!error.status && !ABORTED.has(error.code)) log.error(req.method, req.url, error);
      if (res.headersSent) return void res.destroy();
      sendError(req, res, error);
      if (!req.complete) res.once('finish', () => req.destroy());
    }
  };
}
