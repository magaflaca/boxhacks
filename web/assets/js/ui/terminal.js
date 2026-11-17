import { el } from '../lib/dom.js';
import { copyButton } from './row.js';

const EXAMPLES = (origin) => [
  ['Subir y recibir el enlace', `curl -T video.mp4 ${origin}`],
  ['Elegir nombre y caducidad', `curl -F slug=demo -F expires=1d -F file=@video.mp4 ${origin}`],
  ['Respuesta completa en JSON', `curl -H "Accept: application/json" -T foto.png ${origin}`],
  ['Desde Python', `requests.put("${origin}/foto.png", data=open("foto.png", "rb")).text`],
];

export function mountTerminal(list, origin) {
  list.append(...EXAMPLES(origin).map(([title, command]) =>
    el('li', { class: 'snippet' },
      el('span', { class: 'snippet-title' }, title),
      el('code', {}, command),
      copyButton(command))));
}
