import { el } from '../lib/dom.js';
import { fileKind, icon } from '../pixel/icons.js';

const COPIED_MS = 1400;

export function fileRow({ mime, title, meta, actions = [] }) {
  const metaLine = el('span', { class: 'row-meta' }, meta);
  const node = el('li', { class: 'row' },
    el('span', { class: 'row-icon' }, icon(fileKind(mime), { scale: 2 })),
    el('span', { class: 'row-main' }, el('span', { class: 'row-title' }, title), metaLine),
    el('span', { class: 'row-actions' }, ...actions));
  return { node, setMeta: (text) => (metaLine.textContent = text) };
}

export function iconButton(name, label, onClick) {
  return el('button', { class: 'icon-button', type: 'button', 'aria-label': label, title: label, onclick: onClick }, icon(name));
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function copyButton(text) {
  const button = iconButton('copy', 'Copiar enlace', async () => {
    if (!(await copyText(text))) return;
    flashCopied(button);
  });
  return button;
}

export function flashCopied(button) {
  button.replaceChildren(icon('check'));
  button.classList.add('is-done');
  setTimeout(() => {
    button.replaceChildren(icon('copy'));
    button.classList.remove('is-done');
  }, COPIED_MS);
}
