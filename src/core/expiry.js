import { fail } from './errors.js';

const UNITS = { m: 60, h: 3600, d: 86400 };

export const EXPIRY_OPTIONS = ['1h', '1d', '3d', '7d'];
export const DEFAULT_EXPIRY = '3d';

const MIN_SECONDS = 5 * UNITS.m;
const MAX_SECONDS = 7 * UNITS.d;

export function parseExpiry(value = DEFAULT_EXPIRY) {
  const match = /^(\d+)([mhd])$/.exec(String(value).trim().toLowerCase());
  if (!match) fail(400, 'bad_expiry', 'Caducidad no valida. Usa formatos como 30m, 12h o 3d.');
  const seconds = Number(match[1]) * UNITS[match[2]];
  if (seconds < MIN_SECONDS || seconds > MAX_SECONDS) {
    fail(400, 'bad_expiry', 'La caducidad debe estar entre 5 minutos y 7 dias.');
  }
  return seconds;
}
