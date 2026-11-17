import { pixelSvg } from './render.js';

const CLOUD_SHAPES = [
  [
    '......####........',
    '....##++++##......',
    '...#++++++++###...',
    '.##+++++++++++##..',
    '#++++++++++++++++#',
    '#++++++++++++++++#',
    '.################.',
  ],
  [
    '....###.....',
    '..##+++##...',
    '.#+++++++##.',
    '#++++++++++#',
    '.##########.',
  ],
  [
    '..........####..........',
    '.....###.#++++##........',
    '...##+++#+++++++#.###...',
    '..#++++++++++++++#+++##.',
    '.#++++++++++++++++++++#.',
    '#++++++++++++++++++++++#',
    '.######################.',
  ],
];

const SUN = [
  '......##......',
  '......##......',
  '.##........##.',
  '.##..++++..##.',
  '....++++++....',
  '...++++++++...',
  '##.++++++++.##',
  '##.++++++++.##',
  '...++++++++...',
  '....++++++....',
  '.##..++++..##.',
  '.##........##.',
  '......##......',
  '......##......',
];

const MOON = [
  '....#####...',
  '..####......',
  '.####.......',
  '.###........',
  '####........',
  '####........',
  '####........',
  '#####......#',
  '.#####....##',
  '.##########.',
  '..########..',
  '....####....',
];

const STAR = ['..#..', '..#..', '##+##', '..#..', '..#..'];
const SPECK = ['#'];
const COMET = ['....++', '...+..', '..#...', '.#....', '#.....'];
const SPROUT = ['.#...#.', '.##.##.', '..###..', '...#...', '...#...'];
const FLOWER = ['..+..', '.+#+.', '..+..', '..o..', '.oo..', '..o..'];

const CLOUDS = [
  { shape: 0, top: 7, scale: 5, seconds: 190, delay: -40 },
  { shape: 1, top: 16, scale: 4, seconds: 250, delay: -200 },
  { shape: 2, top: 27, scale: 3, seconds: 320, delay: -120 },
  { shape: 1, top: 41, scale: 3, seconds: 280, delay: -20 },
  { shape: 0, top: 55, scale: 4, seconds: 230, delay: -150 },
  { shape: 2, top: 68, scale: 4, seconds: 300, delay: -260 },
  { shape: 1, top: 80, scale: 5, seconds: 210, delay: -90 },
];

const STARS = [
  [6, 12, STAR], [18, 34, SPECK], [29, 8, SPECK], [41, 22, STAR], [57, 6, SPECK], [68, 30, SPECK],
  [79, 14, STAR], [91, 26, SPECK], [12, 62, SPECK], [88, 58, STAR], [8, 84, SPECK], [94, 80, SPECK],
  [35, 48, SPECK], [63, 52, SPECK], [50, 90, SPECK], [24, 76, STAR], [3, 40, SPECK], [15, 20, SPECK],
  [46, 70, SPECK], [73, 74, STAR], [84, 40, SPECK], [97, 8, SPECK], [38, 3, SPECK], [60, 38, SPECK],
];

const FIREFLIES = [[8, 14], [22, 26], [47, 10], [66, 22], [81, 12], [93, 30]];

const MEADOW = [
  [4, SPROUT, 'var(--leaf-deep)'], [11, FLOWER, 'var(--rose)'], [19, SPROUT, 'var(--leaf)'],
  [27, FLOWER, 'var(--violet)'], [33, SPROUT, 'var(--leaf-deep)'], [46, FLOWER, 'var(--gold)'],
  [52, SPROUT, 'var(--leaf)'], [58, SPROUT, 'var(--leaf-deep)'], [65, FLOWER, 'var(--rose)'],
  [71, SPROUT, 'var(--leaf-deep)'], [80, FLOWER, 'var(--violet)'], [89, SPROUT, 'var(--leaf)'],
  [96, SPROUT, 'var(--leaf-deep)'],
];

const HILLS = [
  { color: 'var(--hill-far)', base: 15, swell: 7, wavelength: 23, phase: 0.6 },
  { color: 'var(--hill-near)', base: 7, swell: 4, wavelength: 13, phase: 2.4 },
];
const HILL_SCALE = 4;

function place(svg, className, styles = {}) {
  svg.classList.add(...className.split(' '));
  Object.assign(svg.style, styles);
  return svg;
}

function clouds() {
  return CLOUDS.map(({ shape, top, scale, seconds, delay }) =>
    place(pixelSvg(CLOUD_SHAPES[shape], { '#': 'var(--cloud-edge)', '+': 'var(--cloud)' }, { scale }), 'scene-cloud', {
      top: `${top}%`,
      animationDuration: `${seconds}s`,
      animationDelay: `${delay}s`,
    }));
}

function stars() {
  return STARS.map(([left, top, shape], index) =>
    place(pixelSvg(shape, { '#': 'var(--star)', '+': 'var(--star-core)' }, { scale: 3 }), 'scene-star only-dark', {
      left: `${left}%`,
      top: `${top}%`,
      animationDelay: `${(index * 0.7) % 5}s`,
    }));
}

function fireflies() {
  return FIREFLIES.map(([left, bottom], index) => {
    const fly = document.createElement('span');
    fly.className = 'scene-firefly only-dark';
    Object.assign(fly.style, { left: `${left}%`, bottom: `${bottom}%`, animationDelay: `${-index * 1.7}s, ${-index * 0.9}s` });
    return fly;
  });
}

function lights() {
  return [
    place(pixelSvg(SUN, { '#': 'var(--sun-ray)', '+': 'var(--sun)' }, { scale: 5 }), 'scene-orb only-light'),
    place(pixelSvg(MOON, { '#': 'var(--moon)' }, { scale: 5 }), 'scene-orb only-dark'),
    place(pixelSvg(COMET, { '#': 'var(--star-core)', '+': 'var(--star)' }, { scale: 3 }), 'scene-comet only-dark'),
  ];
}

function hillRows({ base, swell, wavelength, phase }, columns) {
  const heights = Array.from({ length: columns }, (_, x) =>
    Math.round(base + swell * Math.sin(x / wavelength + phase) + (swell / 2) * Math.sin(x / (wavelength * 0.37) + phase * 2)));
  const top = Math.max(...heights);
  return Array.from({ length: top }, (_, y) => heights.map((height) => (top - y <= height ? '#' : '.')).join(''));
}

function hills() {
  const columns = Math.ceil(Math.max(screen.width, innerWidth) / HILL_SCALE) + 8;
  return HILLS.map((hill) => place(pixelSvg(hillRows(hill, columns), { '#': hill.color }, { scale: HILL_SCALE }), 'scene-hill'));
}

function meadow() {
  return MEADOW.map(([left, shape, color]) =>
    place(pixelSvg(shape, { '#': color, '+': color, o: 'var(--leaf-deep)' }, { scale: 3 }), 'scene-plant', { left: `${left}%` }));
}

export function mountScene(sky, ground) {
  sky.append(...lights(), ...clouds(), ...stars(), ...fireflies());
  ground.append(...hills(), ...meadow());
}
