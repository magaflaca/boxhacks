import { identifyOrCreate, identityHeaders } from './identity.js';
import { clientIp } from './rate-limit.js';
import { sendJson, sendText, wantsJson } from './respond.js';

export function createUploadReplies({ library, limit, secureCookies }) {
  function begin(req) {
    limit(clientIp(req));
    return identifyOrCreate(req);
  }

  function withIdentity(identity, body) {
    return identity.isNew ? { ...body, token: identity.token } : body;
  }

  function reply(req, res, identity, files) {
    const headers = identityHeaders(identity, secureCookies);
    const shown = files.map(library.present);
    if (!wantsJson(req)) return sendText(res, 201, shown.map((file) => file.url).join('\n'), headers);
    sendJson(res, 201, withIdentity(identity, shown.length === 1 ? shown[0] : { files: shown }), headers);
  }

  function replyJson(res, identity, body) {
    sendJson(res, 201, withIdentity(identity, body), identityHeaders(identity, secureCookies));
  }

  return { begin, reply, replyJson };
}
