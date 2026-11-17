import busboy from 'busboy';
import { HttpError, fail } from '../../core/errors.js';

function readMultipart(req, onFile) {
  return new Promise((resolve, reject) => {
    const fields = {};
    const pending = [];
    const parser = busboy({ headers: req.headers, defParamCharset: 'utf8' });
    parser.on('field', (name, value) => (fields[name] = value));
    parser.on('file', (_field, stream, info) => {
      const task = onFile(stream, info.filename, fields);
      task.catch(() => stream.resume());
      pending.push(task);
    });
    parser.on('error', () => reject(new HttpError(400, 'bad_form', 'El formulario llegó incompleto.')));
    parser.on('close', () => Promise.all(pending).then(resolve, reject));
    req.pipe(parser);
  });
}

export function registerUploadRoutes(router, { intake, replies: { begin, reply } }) {
  async function putRaw({ req, res, url, params }) {
    const identity = begin(req);
    const slug = url.searchParams.get('slug') || undefined;
    const ttlSeconds = await intake.prepare({
      slug,
      expires: url.searchParams.get('expires') || undefined,
      declaredBytes: Number(req.headers['content-length']) || 0,
    });
    const file = await intake.store({ stream: req, filename: params.filename, slug, ttlSeconds, owner: identity.owner });
    reply(req, res, identity, [file]);
  }

  async function postMultipart({ req, res }) {
    if (!/^multipart\/form-data/i.test(req.headers['content-type'] || '')) {
      fail(415, 'bad_content_type', 'Usa multipart/form-data con un campo "file", o PUT con el archivo en el cuerpo.');
    }
    const identity = begin(req);
    const stored = [];
    await readMultipart(req, async (stream, filename, fields) => {
      if (fields.slug && stored.length) fail(400, 'slug_needs_single_file', 'Un nombre personalizado solo vale para un archivo.');
      const ttlSeconds = await intake.prepare({ slug: fields.slug, expires: fields.expires });
      stored.push(await intake.store({ stream, filename, slug: fields.slug, ttlSeconds, owner: identity.owner }));
    });
    if (!stored.length) fail(400, 'no_file', 'Falta el campo "file".');
    reply(req, res, identity, stored);
  }

  router.on('POST', '/api/files', postMultipart);
  router.on('POST', '/', postMultipart);
  router.on('PUT', '/api/files/:filename', putRaw);
  router.on('PUT', '/:filename', putRaw);
}
