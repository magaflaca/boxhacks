import { el } from '../lib/dom.js';
import { copyButton, iconButton } from './row.js';
import { createScriptViewer, downloadLink } from './script-viewer.js';

const EXAMPLES = (origin) => [
  ['Subir y recibir el enlace', `curl -T video.mp4 ${origin}`],
  ['Elegir nombre y caducidad', `curl -F slug=demo -F expires=1d -F file=@video.mp4 ${origin}`],
  ['Respuesta completa en JSON', `curl -H "Accept: application/json" -T foto.png ${origin}`],
  ['Desde Python', `requests.put("${origin}/foto.png", data=open("foto.png", "rb")).text`],
];

function snippet(title, command, ...actions) {
  return el('li', { class: 'snippet' },
    el('span', { class: 'snippet-title' }, title),
    el('code', {}, command),
    el('span', { class: 'row-actions' }, copyButton(command), ...actions));
}

function scriptRow(origin) {
  const viewer = createScriptViewer();
  return snippet(
    'Subida rápida en partes paralelas (script de Python)',
    `curl -O ${origin}/box.py; python box.py video.mp4`,
    iconButton('eye', 'Ver el script', viewer.open),
    downloadLink(),
  );
}

export function mountTerminal(list, origin) {
  list.append(...EXAMPLES(origin).map(([title, command]) => snippet(title, command)), scriptRow(origin));
}
