import { api } from '../lib/api.js';
import { el } from '../lib/dom.js';
import { bareUrl, bytes, timeLeft } from '../lib/format.js';
import { icon } from '../pixel/icons.js';
import { copyButton, copyText, fileRow, flashCopied, iconButton } from './row.js';

const CONFIRM_MS = 2600;
const REFRESH_MS = 60_000;
const COLLAPSED_COUNT = 12;

export function mountLibrary({ section, list, copyAll, more }) {
  let files = [];
  let expanded = false;

  const describe = (file) => `${bytes(file.size)} · ${timeLeft(file.expires_at)} · ${file.name}`;

  function deleteButton(file) {
    let armed;
    const button = iconButton('trash', 'Borrar', async () => {
      if (!armed) {
        button.classList.add('is-armed');
        button.setAttribute('aria-label', 'Pulsa otra vez para borrar');
        armed = setTimeout(() => {
          armed = null;
          button.classList.remove('is-armed');
          button.setAttribute('aria-label', 'Borrar');
        }, CONFIRM_MS);
        return;
      }
      clearTimeout(armed);
      await api.remove(file.slug).catch(() => {});
      refresh();
    });
    return button;
  }

  function rowFor(file, freshSlug) {
    const link = el('a', { href: file.url, target: '_blank', rel: 'noopener' }, bareUrl(file.url));
    const row = fileRow({
      mime: file.mime,
      title: link,
      meta: describe(file),
      actions: [copyButton(file.url), deleteButton(file)],
    });
    row.node.title = file.name;
    if (file.slug === freshSlug) row.node.classList.add('is-fresh');
    return row.node;
  }

  function render(freshSlug) {
    const hiddenCount = Math.max(0, files.length - COLLAPSED_COUNT);
    const shown = expanded ? files : files.slice(0, COLLAPSED_COUNT);

    section.hidden = files.length === 0;
    copyAll.hidden = files.length < 2;
    more.hidden = hiddenCount === 0;
    more.textContent = expanded ? 'Ver menos' : `Ver ${hiddenCount} más`;
    list.replaceChildren(...shown.map((file) => rowFor(file, freshSlug)));
  }

  async function refresh(freshSlug) {
    files = await api.myFiles().catch(() => files);
    render(freshSlug);
  }

  const copyMark = el('span', {}, icon('copy'));
  copyAll.append(copyMark, 'Copiar todos');
  copyAll.addEventListener('click', async () => {
    if (await copyText(files.map((file) => file.url).join('\n'))) flashCopied(copyMark);
  });
  more.addEventListener('click', () => {
    expanded = !expanded;
    render();
  });

  setInterval(() => document.hidden || refresh(), REFRESH_MS);
  refresh();
  return { refresh };
}
