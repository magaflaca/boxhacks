import { icon } from '../pixel/icons.js';

const NEXT = { light: 'dark', dark: 'light' };
const ICON = { light: 'moon', dark: 'sun' };
const LABEL = { light: 'Cambiar a modo oscuro', dark: 'Cambiar a modo claro' };

export function mountTheme(button) {
  const root = document.documentElement;

  function render() {
    const theme = root.dataset.theme;
    button.replaceChildren(icon(ICON[theme], { tint: 'var(--gold)' }));
    button.setAttribute('aria-label', LABEL[theme]);
  }

  button.addEventListener('click', () => {
    root.dataset.theme = NEXT[root.dataset.theme];
    try {
      localStorage.setItem('box-theme', root.dataset.theme);
    } catch {}
    render();
  });
  render();
}
