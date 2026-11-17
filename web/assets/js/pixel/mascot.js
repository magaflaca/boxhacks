import { patchRows, pixelPaths, pixelSvg } from './render.js';

const PALETTE = {
  o: 'var(--bug-outline)',
  g: 'var(--bug-body)',
  l: 'var(--bug-light)',
  d: 'var(--bug-shade)',
  y: 'var(--bug-tip)',
  e: 'var(--bug-eye)',
  w: 'var(--bug-glint)',
  p: 'var(--bug-cheek)',
  m: 'var(--bug-eye)',
  t: 'var(--bug-cheek)',
};

const BODY = [
  '..y..........y..',
  '...o........o...',
  '....o......o....',
  '.....oooooo.....',
  '...oollggggoo...',
  '..olgggggggggo..',
  '.oggweggggweggo.',
  '.oggeeggggeeggo.',
  '.oggeeggggeeggo.',
  '.ogppggmmggppgo.',
  '.oggggggggggggo.',
  '.odggggggggggdo.',
  '..oddggggggddo..',
  '...oddddddddo...',
  '....oooooooo....',
  '....oo....oo....',
];

const PARTS = {
  wiggle: { 0: '.y............y.', 1: '..oo........oo..' },
  step: { 15: '.....oo..oo.....' },
  blink: { 6: '.oggggggggggggo.', 7: '.oggeeggggeeggo.', 8: '.oggggggggggggo.' },
  lookLeft: { 6: '.ogweggggwegggo.', 7: '.ogeeggggeegggo.', 8: '.ogeeggggeegggo.' },
  lookRight: { 6: '.ogggweggggwego.', 7: '.ogggeeggggeego.', 8: '.ogggeeggggeego.' },
  smile: { 9: '.ogppgmggmgppgo.', 10: '.ogggggmmgggggo.' },
  open: { 9: '.ogppgmmmmgppgo.', 10: '.oggggmttmggggo.', 11: '.odggggmmggggdo.' },
  frown: { 10: '.oggggmggmggggo.' },
  droop: { 6: '.oggggggggggggo.', 7: '.oggweggggweggo.' },
};

const frame = (...names) => patchRows(BODY, Object.assign({}, ...names.map((name) => PARTS[name])));

const MOODS = {
  idle: { frames: [frame(), frame(), frame(), frame('wiggle')], every: 420 },
  hungry: { frames: [frame('open'), frame('open', 'wiggle')], every: 180 },
  eating: { frames: [frame('open'), frame(), frame('open', 'step'), frame('wiggle')], every: 200 },
  happy: { frames: [frame('smile'), frame('smile', 'wiggle', 'step')], every: 220, lasts: 2600 },
  sad: { frames: [frame('frown', 'droop')], every: 600, lasts: 3200 },
};

const BLINK_MS = 140;
const STEP_PX = 4;
const STEP_MS = 150;
const REST_MS = [5000, 12000];
const GAZE = { '-1': 'lookLeft', 1: 'lookRight' };
const STRIDE = [frame('step'), frame()];

const between = ([min, max]) => min + Math.random() * (max - min);

export const mascotFace = () => pixelSvg(BODY, PALETTE, { scale: 2 });

export function createMascot(host, { scale = 4, roam = () => 0 } = {}) {
  const svg = pixelSvg(BODY, PALETTE, { scale });
  host.append(svg);

  let mood = 'idle';
  let tick = 0;
  let gaze = 0;
  let blinkUntil = 0;
  let position = 0;
  let target = 0;
  let restUntil = performance.now() + between(REST_MS);
  let revert;

  const walking = () => mood === 'idle' && position !== target;

  function currentRows() {
    if (walking()) return patchRows(STRIDE[tick % 2], PARTS[GAZE[Math.sign(position - target)]]);
    const { frames } = MOODS[mood];
    let rows = frames[tick % frames.length];
    if (mood !== 'idle') return rows;
    if (GAZE[gaze]) rows = patchRows(rows, PARTS[GAZE[gaze]]);
    return performance.now() < blinkUntil ? patchRows(rows, PARTS.blink) : rows;
  }

  const draw = () => svg.replaceChildren(...pixelPaths(currentRows(), PALETTE));

  function stroll() {
    if (mood !== 'idle') return;
    if (position === target) {
      if (performance.now() < restUntil) return;
      target = Math.round((Math.random() * roam()) / STEP_PX) * STEP_PX;
      restUntil = Infinity;
    }
    if (position === target) return void (restUntil = performance.now() + between(REST_MS));
    position += Math.sign(target - position) * STEP_PX;
    host.style.transform = `translateX(${-position}px)`;
    if (position === target) restUntil = performance.now() + between(REST_MS);
  }

  function loop() {
    tick++;
    stroll();
    if (mood === 'idle' && Math.random() < 0.12) blinkUntil = performance.now() + BLINK_MS;
    draw();
    setTimeout(loop, walking() ? STEP_MS : MOODS[mood].every);
  }

  function setMood(next) {
    if (next === mood) return;
    mood = next;
    host.dataset.mood = next;
    clearTimeout(revert);
    if (MOODS[next].lasts) revert = setTimeout(() => setMood('idle'), MOODS[next].lasts);
    draw();
  }

  window.addEventListener('pointermove', (event) => {
    const box = host.getBoundingClientRect();
    const offset = event.clientX - (box.left + box.width / 2);
    gaze = Math.abs(offset) < box.width ? 0 : Math.sign(offset);
  }, { passive: true });

  host.dataset.mood = mood;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) draw();
  else loop();
  return { setMood };
}
