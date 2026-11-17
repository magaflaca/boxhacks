import { floatUp } from './particles.js';
import { patchRows, pixelDataUrl, pixelPaths, pixelSvg } from './render.js';

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
  asleep: { frames: [frame('blink')], every: 900 },
};

const BLINK_MS = 140;
const STEP_PX = 4;
const STEP_MS = 150;
const REST_MS = [5000, 12000];
const SLEEP_AFTER_MS = 45_000;
const FOLLOW_REACH_PX = 170;
const GAZE = { '-1': 'lookLeft', 1: 'lookRight' };
const STRIDE = [frame('step'), frame()];

const between = ([min, max]) => min + Math.random() * (max - min);
const snap = (value) => Math.round(value / STEP_PX) * STEP_PX;

export const mascotIcon = () => pixelDataUrl(BODY, PALETTE, 2);

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
  let lastStir = performance.now();
  let revert;

  const walking = () => mood === 'idle' && position !== target;

  function rest() {
    restUntil = performance.now() + between(REST_MS);
  }

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
    if (position === target) {
      if (performance.now() < restUntil) return;
      target = snap(Math.random() * Math.max(roam(), 0));
      if (position === target) return rest();
    }
    position += Math.sign(target - position) * STEP_PX;
    host.style.transform = `translateX(${-position}px)`;
    if (position === target) rest();
  }

  function live() {
    if (mood === 'asleep' && tick % 3 === 0) floatUp(host, 'zed');
    if (mood !== 'idle') return;
    stroll();
    if (Math.random() < 0.12) blinkUntil = performance.now() + BLINK_MS;
    if (!walking() && performance.now() - lastStir > SLEEP_AFTER_MS) setMood('asleep');
  }

  function loop() {
    tick++;
    live();
    draw();
    setTimeout(loop, walking() ? STEP_MS : MOODS[mood].every);
  }

  function setMood(next) {
    if (next === mood) return;
    mood = next;
    host.dataset.mood = next;
    lastStir = performance.now();
    clearTimeout(revert);
    if (MOODS[next].lasts) revert = setTimeout(() => setMood('idle'), MOODS[next].lasts);
    draw();
  }

  function cheer() {
    if (mood === 'idle' || mood === 'asleep') setMood('happy');
  }

  function follow(event) {
    const box = host.getBoundingClientRect();
    const offset = event.clientX - (box.left + box.width / 2);
    gaze = Math.abs(offset) < box.width ? 0 : Math.sign(offset);
    const near = Math.abs(event.clientY - box.bottom) < FOLLOW_REACH_PX;
    if (mood !== 'idle' || !near || Math.abs(offset) < box.width / 2) return;
    target = Math.min(Math.max(snap(position - offset), 0), snap(Math.max(roam(), 0)));
  }

  window.addEventListener('pointermove', (event) => {
    if (mood === 'asleep') setMood('happy');
    lastStir = performance.now();
    follow(event);
  }, { passive: true });

  host.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    floatUp(host, 'heart');
    cheer();
  });

  host.dataset.mood = mood;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) draw();
  else loop();
  return { setMood, cheer };
}
