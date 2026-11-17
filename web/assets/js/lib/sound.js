const STORAGE_KEY = 'box-sound';
const MASTER_VOLUME = 0.13;
const ATTACK_SECONDS = 0.008;
const SILENCE = 0.0001;

const TUNES = {
  tap: { gap: 0, notes: [[19, 0.05, 0.3]] },
  poke: { gap: 0.06, notes: [[19, 0.07], [24, 0.14]] },
  copy: { gap: 0.07, notes: [[15, 0.07], [22, 0.16]] },
  drop: { gap: 0.07, notes: [[10, 0.07], [15, 0.14]] },
  done: { gap: 0.08, notes: [[15, 0.09], [19, 0.09], [22, 0.09], [27, 0.26]] },
  error: { gap: 0.14, notes: [[7, 0.16], [3, 0.28]] },
  remove: { gap: 0.07, notes: [[3, 0.08], [-2, 0.16]] },
  day: { gap: 0.06, notes: [[15, 0.07], [19, 0.07], [22, 0.16]] },
  night: { gap: 0.06, notes: [[22, 0.07], [19, 0.07], [15, 0.16]] },
};

const pitch = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12);

let context;
let muted = readMuted();

function readMuted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

function audio() {
  context ??= new AudioContext();
  if (context.state === 'suspended') context.resume();
  return context;
}

function tone(output, startAt, [semitone, duration, volume = 1]) {
  const oscillator = output.createOscillator();
  const envelope = output.createGain();
  oscillator.type = 'triangle';
  oscillator.frequency.value = pitch(semitone);
  envelope.gain.setValueAtTime(SILENCE, startAt);
  envelope.gain.exponentialRampToValueAtTime(MASTER_VOLUME * volume, startAt + ATTACK_SECONDS);
  envelope.gain.exponentialRampToValueAtTime(SILENCE, startAt + duration);
  oscillator.connect(envelope).connect(output.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration + 0.02);
}

export function play(name) {
  if (muted) return;
  try {
    const output = audio();
    const { gap, notes } = TUNES[name];
    notes.forEach((note, index) => tone(output, output.currentTime + index * gap, note));
  } catch {}
}

export const isMuted = () => muted;

export function toggleMuted() {
  muted = !muted;
  try {
    localStorage.setItem(STORAGE_KEY, muted ? 'off' : 'on');
  } catch {}
  return muted;
}
