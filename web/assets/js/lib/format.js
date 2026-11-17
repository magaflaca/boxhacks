const UNITS = ['B', 'KB', 'MB', 'GB'];

export function bytes(value) {
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < UNITS.length - 1) {
    amount /= 1024;
    unit++;
  }
  return `${amount < 10 && unit ? amount.toFixed(1) : Math.round(amount)} ${UNITS[unit]}`;
}

export function timeLeft(isoDate) {
  const minutes = Math.max(0, Math.round((Date.parse(isoDate) - Date.now()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ${minutes % 60} min`;
  return `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

const EXPIRY_WORDS = { m: ['minuto', 'minutos'], h: ['hora', 'horas'], d: ['día', 'días'] };

export function expiryLabel(code) {
  const amount = Number(code.slice(0, -1));
  const [one, many] = EXPIRY_WORDS[code.at(-1)];
  return `${amount} ${amount === 1 ? one : many}`;
}

export const bareUrl = (url) => url.replace(/^https?:\/\//, '');
