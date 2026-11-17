import { api } from '../lib/api.js';
import { el } from '../lib/dom.js';
import { pixelText } from '../pixel/font.js';
import { icon } from '../pixel/icons.js';
import { copyText, flashCopied, iconButton } from './row.js';

const SCRIPT_PATH = '/box.py';

export function downloadLink(label = 'Descargar box.py') {
  return el('a', { class: 'icon-button', href: SCRIPT_PATH, download: 'box.py', 'aria-label': label, title: label }, icon('download'));
}

export function createScriptViewer() {
  const code = el('code', {}, 'Cargando...');
  const copy = el('button', { class: 'box text-button', type: 'button' }, el('span', {}, icon('copy')), 'Copiar');
  const dialog = el('dialog', { class: 'box sheet', 'aria-label': 'Script box.py' },
    el('header', { class: 'sheet-head' },
      el('h2', { class: 'section-title' }, pixelText('box.py', { scale: 2 })),
      iconButton('cross', 'Cerrar', () => dialog.close())),
    el('pre', { class: 'sheet-code' }, code),
    el('footer', { class: 'sheet-foot' },
      copy,
      el('a', { class: 'box text-button', href: SCRIPT_PATH, download: 'box.py' }, el('span', {}, icon('download')), 'Descargar')));

  let loaded;

  copy.addEventListener('click', async () => {
    if (await copyText(await loaded)) flashCopied(copy.firstChild);
  });
  dialog.addEventListener('click', (event) => event.target === dialog && dialog.close());
  document.body.append(dialog);

  return {
    open() {
      loaded ??= api.script().then((text) => (code.textContent = text));
      dialog.showModal();
    },
  };
}
