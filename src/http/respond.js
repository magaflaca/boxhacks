export const wantsJson = (req) => (req.headers.accept || '').includes('application/json');

export function send(res, status, body = '', headers = {}) {
  res.writeHead(status, { 'content-length': Buffer.byteLength(body), ...headers });
  res.end(res.req.method === 'HEAD' ? undefined : body);
}

export function sendJson(res, status, value, headers = {}) {
  send(res, status, JSON.stringify(value), { 'content-type': 'application/json; charset=utf-8', ...headers });
}

export function sendText(res, status, text, headers = {}) {
  send(res, status, `${text}\n`, { 'content-type': 'text/plain; charset=utf-8', ...headers });
}

export function sendError(req, res, error) {
  const status = error.status || 500;
  const code = error.code || 'internal_error';
  const message = error.status ? error.message : 'Algo fallo en el servidor.';
  const headers = req.complete ? {} : { connection: 'close' };
  if (wantsJson(req)) sendJson(res, status, { error: code, message }, headers);
  else sendText(res, status, `error: ${message}`, headers);
}
