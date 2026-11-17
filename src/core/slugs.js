import { randomInt } from 'node:crypto';
import { fail } from './errors.js';

const PATTERN = /^[a-z0-9][a-z0-9_-]{1,47}$/i;
const RESERVED = new Set(['api', 'assets', 'favicon', 'robots', 'index', 'admin', 'static']);
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

export function assertSlug(slug) {
  if (!PATTERN.test(slug)) {
    fail(400, 'bad_slug', 'El nombre admite de 2 a 48 letras, numeros, guiones y guiones bajos.');
  }
  if (RESERVED.has(slug.toLowerCase())) fail(409, 'slug_taken', 'Ese nombre esta reservado.');
  return slug;
}

export function randomSlug(length = 6) {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
}

export function splitName(name) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? { stem: name.slice(0, dot), ext: name.slice(dot + 1) } : { stem: name, ext: '' };
}
