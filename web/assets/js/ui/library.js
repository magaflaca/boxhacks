import { api } from '../lib/api.js';
import { el } from '../lib/dom.js';
import { bareUrl, bytes, timeLeft } from '../lib/format.js';
import { copyButton, fileRow, iconButton } from './row.js';

const CONFIRM_MS = 2600;
const REFRESH_MS = 60_000;

export function mountLibrary({ section, list }) {
  let files = [];

  const describe = (file) => `${bytes(file.size)} · caduca en ${timeLeft(file.expires_at)}`;

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

  function render(freshSlug) {
    section.hidden = files.length === 0;
    list.replaceChildren(...files.map((file) => {
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
    }));
  }

  async function refresh(freshSlug) {
    files = await api.myFiles().catch(() => files);
    render(freshSlug);
  }

  setInterval(() => document.hidden || refresh(), REFRESH_MS);
  refresh();
  return { refresh };
}
