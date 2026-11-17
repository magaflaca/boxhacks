import { pixelDataUrl } from './render.js';

const SCALE = 2;
const PALETTE = { '#': 'var(--cursor-edge)', '+': 'var(--cursor-fill)', l: 'var(--cursor-light)' };

const CURSORS = {
  default: {
    fallback: 'auto',
    hotspot: [0, 0],
    rows: [
      '#.......',
      '##......',
      '#l#.....',
      '#l+#....',
      '#l++#...',
      '#l+++#..',
      '#l++++#.',
      '#+++####',
      '#+#+#...',
      '##.#+#..',
      '....##..',
    ],
  },
  pointer: {
    fallback: 'pointer',
    hotspot: [2, 0],
    rows: [
      '..##.....',
      '.#l+#....',
      '.#l+#....',
      '.#l+###..',
      '.#l+#+###',
      '##l+++#+#',
      '#+++++++#',
      '#+++++++#',
      '.#+++++#.',
      '.#+++++#.',
      '..#####..',
    ],
  },
  text: {
    fallback: 'text',
    hotspot: [2, 5],
    rows: ['##.##', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..', '##.##'],
  },
};

export function applyCursors() {
  for (const [name, { rows, hotspot, fallback }] of Object.entries(CURSORS)) {
    const [x, y] = hotspot.map((cell) => cell * SCALE);
    const value = `url("${pixelDataUrl(rows, PALETTE, SCALE)}") ${x} ${y}, ${fallback}`;
    document.documentElement.style.setProperty(`--cursor-${name}`, value);
  }
}
