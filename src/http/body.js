import { fail } from '../core/errors.js';

const MAX_JSON_BYTES = 8 * 1024;

export async function readJson(req) {
  let text = '';
  for await (const data of req) {
    text += data;
    if (text.length > MAX_JSON_BYTES) fail(413, 'too_large', 'Petición demasiado grande.');
  }
  try {
    return JSON.parse(text || '{}');
  } catch {
    fail(400, 'bad_json', 'El cuerpo debe ser JSON.');
  }
}
