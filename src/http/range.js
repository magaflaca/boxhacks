import { fail } from '../core/errors.js';

export function parseRange(header, size) {
  const match = /^bytes=(\d*)-(\d*)$/.exec((header || '').trim());
  if (!match || (!match[1] && !match[2])) return null;

  const [first, last] = [match[1], match[2]];
  const start = first ? Number(first) : Math.max(0, size - Number(last));
  const end = first && last ? Math.min(Number(last), size - 1) : size - 1;
  if (start > end || start >= size) fail(416, 'bad_range', 'Rango fuera del archivo.');
  return { start, end };
}
