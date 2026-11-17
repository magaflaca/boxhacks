import { pixelText, pixelWord } from '../pixel/font.js';
import { mascotFace } from '../pixel/mascot.js';
import { mountScene } from '../pixel/scene.js';
import { $ } from '../lib/dom.js';
import { mountTheme } from './theme.js';

function setFavicon() {
  const svg = mascotFace();
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const computed = getComputedStyle(document.documentElement);
  const markup = svg.outerHTML.replace(/var\((--[\w-]+)\)/g, (_, name) => computed.getPropertyValue(name).trim());
  const link = Object.assign(document.createElement('link'), {
    rel: 'icon',
    href: `data:image/svg+xml,${encodeURIComponent(markup)}`,
  });
  document.head.append(link);
}

export function mountChrome() {
  $('#logo').append(pixelWord([['box', 'var(--leaf-deep)'], ['hacks', 'var(--ink)']], { scale: 5 }));
  for (const heading of document.querySelectorAll('[data-pixel]')) {
    heading.append(pixelText(heading.dataset.pixel, { scale: 2 }));
  }
  mountTheme($('#theme-toggle'));
  mountScene($('#sky'), $('#ground'));
  setFavicon();
}
