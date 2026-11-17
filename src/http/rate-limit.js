import { fail } from '../core/errors.js';

const WINDOW_MS = 60 * 60_000;

export function createRateLimit(maxPerHour) {
  const hits = new Map();

  const sweeper = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const [key, times] of hits) {
      if (times.at(-1) < cutoff) hits.delete(key);
    }
  }, WINDOW_MS);
  sweeper.unref();

  return function consume(key) {
    const cutoff = Date.now() - WINDOW_MS;
    const recent = (hits.get(key) || []).filter((time) => time > cutoff);
    if (recent.length >= maxPerHour) fail(429, 'rate_limited', 'Demasiadas subidas. Espera un rato.');
    recent.push(Date.now());
    hits.set(key, recent);
  };
}

export const clientIp = (req) => req.headers['x-real-ip'] || req.socket.remoteAddress;
