import { pixelSvg } from './render.js';

const SHAPES = {
  heart: {
    color: 'var(--rose)',
    rows: ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'],
  },
  zed: {
    color: 'var(--ink-soft)',
    rows: ['####', '...#', '..#.', '.#..', '####'],
  },
};

const SPARK_COLORS = ['var(--rose)', 'var(--gold)', 'var(--leaf)', 'var(--violet)'];
const SPARK_COUNT = 6;
const SPARK_REACH_PX = 26;

const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

function release(node) {
  node.addEventListener('animationend', () => node.remove(), { once: true });
  return node;
}

export function floatUp(host, shape) {
  if (calm) return;
  const { rows, color } = SHAPES[shape];
  const svg = pixelSvg(rows, { '#': color }, { scale: 3 });
  svg.classList.add('particle');
  svg.style.setProperty('--drift', `${Math.round(Math.random() * 24 - 12)}px`);
  host.append(release(svg));
}

function burst(x, y) {
  for (let i = 0; i < SPARK_COUNT; i++) {
    const angle = (Math.PI * 2 * i) / SPARK_COUNT + Math.random() * 0.6;
    const spark = document.createElement('span');
    spark.className = 'spark';
    Object.assign(spark.style, { left: `${x}px`, top: `${y}px`, background: SPARK_COLORS[i % SPARK_COLORS.length] });
    spark.style.setProperty('--dx', `${Math.round(Math.cos(angle) * SPARK_REACH_PX)}px`);
    spark.style.setProperty('--dy', `${Math.round(Math.sin(angle) * SPARK_REACH_PX)}px`);
    document.body.append(release(spark));
  }
}

export function mountSparkles() {
  if (calm) return;
  window.addEventListener('pointerdown', (event) => burst(event.clientX, event.clientY), { passive: true });
}
