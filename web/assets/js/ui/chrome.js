import { $ } from '../lib/dom.js';
import { applyCursors } from '../pixel/cursor.js';
import { pixelText, pixelWord } from '../pixel/font.js';
import { mascotIcon } from '../pixel/mascot.js';
import { mountSparkles } from '../pixel/particles.js';
import { mountScene } from '../pixel/scene.js';
import { THEME_EVENT, mountTheme } from './theme.js';

function setFavicon() {
  document.head.append(Object.assign(document.createElement('link'), { rel: 'icon', href: mascotIcon() }));
}

export function mountChrome() {
  $('#logo').append(pixelWord([['box', 'var(--leaf-deep)'], ['hacks', 'var(--ink)']], { scale: 5 }));
  for (const heading of document.querySelectorAll('[data-pixel]')) {
    heading.append(pixelText(heading.dataset.pixel, { scale: 2 }));
  }
  mountTheme($('#theme-toggle'));
  mountScene($('#sky'), $('#ground'));
  mountSparkles();
  setFavicon();
  applyCursors();
  document.addEventListener(THEME_EVENT, applyCursors);
}
