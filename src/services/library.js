import { basename } from 'node:path';
import { fail } from '../core/errors.js';
import { mimeOf } from '../core/mime.js';
import { assertSlug, randomSlug, splitName } from '../core/slugs.js';

const TOUCH_INTERVAL_MS = 60_000;
const AUTO_SLUG_ATTEMPTS = 6;

const now = () => Date.now();

function cleanName(raw) {
  const name = basename(String(raw || '').replace(/\\/g, '/')).replace(/[\x00-\x1f"]/g, '').trim();
  return name.slice(-200) || 'archivo';
}

function cleanExt(name) {
  const ext = splitName(name).ext.toLowerCase();
  return /^[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}

export function createLibrary({ files, spool, drive, publicUrl, log }) {
  const isAlive = (file) => file && file.expires_at > now();

  async function destroy(file) {
    files.remove(file.storage_id);
    await spool.remove(file.storage_id);
    if (file.drive_id) await drive?.remove(file.drive_id).catch((error) => log.warn('drive remove', error.message));
  }

  async function release(slug) {
    const current = files.bySlug(slug);
    if (current && !isAlive(current)) await destroy(current);
    return !current || !isAlive(current);
  }

  async function assertAvailable(slug) {
    assertSlug(slug);
    if (!(await release(slug))) fail(409, 'slug_taken', `El nombre "${slug}" ya está en uso.`);
  }

  async function register({ storageId, size, filename, slug, ttlSeconds, owner }) {
    const name = cleanName(filename);
    const ext = cleanExt(name);
    const row = {
      storage_id: storageId, name, ext, size, owner,
      mime: mimeOf(ext),
      now: now(),
      expires_at: now() + ttlSeconds * 1000,
    };

    if (slug) {
      await assertAvailable(slug);
      if (!files.insert({ ...row, slug })) fail(409, 'slug_taken', `El nombre "${slug}" ya está en uso.`);
      return files.bySlug(slug);
    }
    for (let attempt = 0; attempt < AUTO_SLUG_ATTEMPTS; attempt++) {
      const candidate = randomSlug(6 + attempt);
      if (files.insert({ ...row, slug: candidate })) return files.bySlug(candidate);
    }
    fail(503, 'slug_exhausted', 'No se pudo generar un nombre libre. Inténtalo de nuevo.');
  }

  function find(requested) {
    const exact = files.bySlug(requested);
    if (isAlive(exact)) return exact;
    const { stem, ext } = splitName(requested);
    const file = ext ? files.bySlug(stem) : null;
    return isAlive(file) && file.ext === ext.toLowerCase() ? file : null;
  }

  function touch(file) {
    if (now() - file.accessed_at > TOUCH_INTERVAL_MS) files.touch(file.slug, now());
  }

  const ownedBy = (owner) => files.byOwner(owner, now());

  function present(file) {
    return {
      slug: file.slug,
      url: `${publicUrl}/${file.slug}${file.ext && `.${file.ext}`}`,
      name: file.name,
      size: file.size,
      mime: file.mime,
      created_at: new Date(file.created_at).toISOString(),
      expires_at: new Date(file.expires_at).toISOString(),
    };
  }

  return { register, assertAvailable, find, touch, ownedBy, destroy, present };
}
