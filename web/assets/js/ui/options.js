import { api } from '../lib/api.js';
import { debounce, el } from '../lib/dom.js';
import { expiryLabel } from '../lib/format.js';
import { icon } from '../pixel/icons.js';

export function mountOptions({ slugInput, slugStatus, expiryGroup }, { expiry_options, default_expiry }) {
  let checked = 0;

  expiryGroup.append(...expiry_options.map((code) =>
    el('label', { class: 'segment' },
      el('input', { type: 'radio', name: 'expires', value: code, checked: code === default_expiry }),
      el('span', {}, expiryLabel(code)))));

  function showStatus(state, message = '') {
    slugStatus.dataset.state = state;
    const mark = { ok: 'check', bad: 'cross' }[state];
    slugStatus.replaceChildren(...(mark ? [icon(mark, { scale: 1 })] : []), message);
  }

  const verify = debounce(async (slug) => {
    const turn = ++checked;
    const result = await api.checkSlug(slug).catch(() => null);
    if (turn !== checked || slugInput.value.trim() !== slug || !result) return;
    if (result.available) showStatus('ok', 'libre');
    else showStatus('bad', result.message);
  }, 250);

  slugInput.addEventListener('input', () => {
    const slug = slugInput.value.trim();
    checked++;
    showStatus('idle');
    if (slug) verify(slug);
  });

  return {
    read: () => ({
      slug: slugInput.value.trim(),
      expires: expiryGroup.querySelector('input:checked').value,
    }),
    clearSlug() {
      slugInput.value = '';
      showStatus('idle');
    },
  };
}
