import { createHash, randomBytes } from 'node:crypto';

const COOKIE = 'box_token';
const ONE_YEAR_SECONDS = 365 * 86400;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

const hash = (token) => createHash('sha256').update(token).digest('hex');

function presentedToken(req) {
  const bearer = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  const cookie = new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`).exec(req.headers.cookie || '')?.[1];
  const token = bearer || cookie;
  return token && TOKEN_PATTERN.test(token) ? token : null;
}

export function identify(req) {
  const token = presentedToken(req);
  return token ? { token, owner: hash(token), isNew: false } : null;
}

export function identifyOrCreate(req) {
  const known = identify(req);
  if (known) return known;
  const token = randomBytes(24).toString('base64url');
  return { token, owner: hash(token), isNew: true };
}

export function identityHeaders({ token }, secure) {
  const cookie = `${COOKIE}=${token}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
  return { 'set-cookie': cookie, 'x-box-token': token };
}
