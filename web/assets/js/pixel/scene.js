import { pixelSvg } from './render.js';

const CLOUD = [
  '......####........',
  '....##++++##......',
  '...#++++++++###...',
  '.##+++++++++++##..',
  '#++++++++++++++++#',
  '#++++++++++++++++#',
  '.################.',
];

const STAR = [
  '..#..',
  '..#..',
  '##+##',
  '..#..',
  '..#..',
];

const SPECK = ['#'];

const SPROUT = [
  '.#...#.',
  '.##.##.',
  '..###..',
  '...#...',
  '...#...',
];

const FLOWER = [
  '..+..',
  '.+#+.',
  '..+..',
  '..o..',
  '.oo..',
  '..o..',
];

const CLOUDS = [
  { top: '9%', scale: 5, seconds: 190, delay: -40 },
  { top: '26%', scale: 3, seconds: 260, delay: -170 },
  { top: '64%', scale: 4, seconds: 220, delay: -95 },
];

const STARS = [
  [6, 12, STAR], [18, 34, SPECK], [29, 8, SPECK], [41, 22, STAR], [57, 6, SPECK], [68, 30, SPECK],
  [79, 14, STAR], [91, 26, SPECK], [12, 62, SPECK], [88, 58, STAR], [8, 84, SPECK], [94, 80, SPECK],
  [35, 48, SPECK], [63, 52, SPECK], [50, 90, SPECK], [24, 76, STAR],
];

const MEADOW = [
  [4, SPROUT, 'var(--leaf-deep)'], [11, FLOWER, 'var(--rose)'], [19, SPROUT, 'var(--leaf)'],
  [33, SPROUT, 'var(--leaf-deep)'], [46, FLOWER, 'var(--gold)'], [58, SPROUT, 'var(--leaf)'],
  [71, SPROUT, 'var(--leaf-deep)'], [80, FLOWER, 'var(--violet)'], [89, SPROUT, 'var(--leaf)'],
  [96, SPROUT, 'var(--leaf-deep)'],
];

function place(svg, className, styles) {
  svg.classList.add(className);
  Object.assign(svg.style, styles);
  return svg;
}

function clouds() {
  return CLOUDS.map(({ top, scale, seconds, delay }) =>
    place(pixelSvg(CLOUD, { '#': 'var(--cloud-edge)', '+': 'var(--cloud)' }, { scale }), 'scene-cloud', {
      top,
      animationDuration: `${seconds}s`,
      animationDelay: `${delay}s`,
    }));
}

function stars() {
  return STARS.map(([left, top, shape], index) =>
    place(pixelSvg(shape, { '#': 'var(--star)', '+': 'var(--star-core)' }, { scale: 3 }), 'scene-star', {
      left: `${left}%`,
      top: `${top}%`,
      animationDelay: `${(index * 0.7) % 5}s`,
    }));
}

function meadow() {
  return MEADOW.map(([left, shape, color]) =>
    place(pixelSvg(shape, { '#': color, '+': color, o: 'var(--leaf-deep)' }, { scale: 3 }), 'scene-plant', {
      left: `${left}%`,
    }));
}

export function mountScene(sky, ground) {
  sky.append(...clouds(), ...stars());
  ground.append(...meadow());
}
