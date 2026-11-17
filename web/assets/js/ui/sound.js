import { isMuted, play, toggleMuted } from '../lib/sound.js';
import { icon } from '../pixel/icons.js';
import { COPIED_EVENT } from './row.js';
import { THEME_EVENT } from './theme.js';

const PRESSABLE = 'button, a, label';

export function mountSound(button, mascot) {
  function render() {
    button.replaceChildren(icon(isMuted() ? 'mute' : 'sound', { tint: 'var(--tint-pink)' }));
    button.setAttribute('aria-label', isMuted() ? 'Activar sonidos' : 'Silenciar sonidos');
    button.setAttribute('aria-pressed', String(!isMuted()));
  }

  button.addEventListener('click', () => {
    toggleMuted();
    render();
    play('copy');
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target.closest?.(PRESSABLE) && !event.target.closest('.mascot')) play('tap');
  }, { passive: true });
  document.addEventListener(COPIED_EVENT, () => play('copy'));
  document.addEventListener(THEME_EVENT, () => play(document.documentElement.dataset.theme === 'dark' ? 'night' : 'day'));
  mascot?.addEventListener('click', () => play('poke'));

  render();
}
