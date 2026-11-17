const TYPES = {
  html: 'text/html', css: 'text/css', js: 'text/javascript', mjs: 'text/javascript',
  json: 'application/json', xml: 'application/xml', txt: 'text/plain', md: 'text/markdown',
  csv: 'text/csv', log: 'text/plain', ini: 'text/plain', yml: 'text/yaml', yaml: 'text/yaml',
  py: 'text/x-python', sh: 'text/x-shellscript', c: 'text/x-c', h: 'text/x-c', cpp: 'text/x-c',
  cs: 'text/x-csharp', java: 'text/x-java', rs: 'text/x-rust', go: 'text/x-go', ts: 'text/x-typescript',
  lua: 'text/x-lua', sql: 'text/x-sql', toml: 'text/x-toml',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
  avif: 'image/avif', svg: 'image/svg+xml', bmp: 'image/bmp', ico: 'image/x-icon',
  mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mkv: 'video/x-matroska',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav',
  flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac',
  pdf: 'application/pdf', zip: 'application/zip', '7z': 'application/x-7z-compressed',
  rar: 'application/vnd.rar', gz: 'application/gzip', tar: 'application/x-tar',
  woff2: 'font/woff2',
};

const BINARY = 'application/octet-stream';
const TEXTUAL = /^(text\/|application\/(json|xml)$)/;
const INLINE = /^(image|video|audio)\/|^application\/pdf$/;

export function mimeOf(ext) {
  return TYPES[ext.toLowerCase()] || BINARY;
}

export function assetType(ext) {
  const type = mimeOf(ext);
  return TEXTUAL.test(type) || type === 'image/svg+xml' ? `${type}; charset=utf-8` : type;
}

export function servedType(mime) {
  if (INLINE.test(mime)) return { type: mime, inline: true };
  if (TEXTUAL.test(mime)) return { type: 'text/plain; charset=utf-8', inline: true };
  return { type: BINARY, inline: false };
}
