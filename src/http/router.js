import { fail } from '../core/errors.js';

const segments = (path) => path.split('/').filter(Boolean);

function decode(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    fail(400, 'bad_path', 'Ruta mal codificada.');
  }
}

function capture(pattern, path) {
  const params = {};
  for (let i = 0; i < pattern.length; i++) {
    const part = pattern[i];
    if (part === '*') {
      params.rest = path.slice(i).map(decode).join('/');
      return params;
    }
    if (i >= path.length) return null;
    if (part.startsWith(':')) params[part.slice(1)] = decode(path[i]);
    else if (part !== path[i]) return null;
  }
  return pattern.length === path.length ? params : null;
}

export function createRouter() {
  const routes = [];

  function on(method, pattern, handler) {
    routes.push({ method, pattern: segments(pattern), handler });
  }

  function resolve(method, pathname) {
    const path = segments(pathname);
    const wanted = method === 'HEAD' ? 'GET' : method;
    let pathExists = false;
    for (const route of routes) {
      const params = capture(route.pattern, path);
      if (!params) continue;
      if (route.method === wanted) return { handler: route.handler, params };
      pathExists = true;
    }
    if (pathExists) fail(405, 'method_not_allowed', 'Metodo no permitido en esta ruta.');
    fail(404, 'not_found', 'No existe.');
  }

  return { on, resolve };
}
