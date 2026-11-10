// Sleep entries: { start, end, quality, note, type? } with local "YYYY-MM-DDTHH:MM"
// times; end is null while you're asleep. The type is derived from where the
// sleep starts relative to the prayer times (unless set by hand).
import { minutesOf, toDateStr } from './utils.js';

export const SLEEP_TYPES = {
  night: { label: 'Night', hint: 'After Isha, through the night', color: 'var(--cat-7)' },
  morning: { label: 'After Fajr', hint: 'Between Fajr and late morning', color: 'var(--cat-1)' },
  qaylula: { label: 'Qaylula', hint: 'Midday nap around Dhuhr — a sunnah', color: 'var(--cat-3)' },
  afternoon: { label: 'After Asr', hint: 'Late-afternoon nap', color: 'var(--cat-4)' },
  evening: { label: 'Evening', hint: 'A short nap after Maghrib', color: 'var(--cat-2)' },
};
export const SLEEP_TYPE_KEYS = Object.keys(SLEEP_TYPES);
const FALLBACK = { Fajr: '05:30', Sunrise: '07:00', Dhuhr: '12:45', Asr: '15:45', Maghrib: '18:00', Isha: '19:30' };

const pad = (n) => String(n).padStart(2, '0');
export const nowLocal = () => {
  const d = new Date();
  return `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const toLocal = (d) => `${toDateStr(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const dateOf = (dt) => dt.slice(0, 10);
export const timeOf = (dt) => dt.slice(11, 16);
export const minsOf = (dt) => minutesOf(timeOf(dt));
export const durationMin = (s, end = s.end || nowLocal()) => Math.max(0, (new Date(end) - new Date(s.start)) / 60000);
export const fmtDur = (min) => {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h${m ? ` ${pad(m)}m` : ''}` : `${m}m`;
};
// The day a sleep counts for: the day you woke up (today while still asleep).
export const wakeDay = (s) => dateOf(s.end || nowLocal());

export function classify(s, timings) {
  if (s.type) return s.type;
  const t = { ...FALLBACK, ...(timings || {}) };
  const m = minsOf(s.start);
  const long = s.end && durationMin(s) >= 240;
  // A short sleep in the early evening (even after Isha) is a nap, not the night.
  if (m >= minutesOf(t.Maghrib) && m < 22 * 60 && s.end && durationMin(s) < 120) return 'evening';
  if (m >= minutesOf(t.Isha) || m < minutesOf(t.Fajr)) return 'night';
  if (m < minutesOf(t.Dhuhr) - 60) return 'morning';
  if (m < minutesOf(t.Asr)) return 'qaylula';
  if (m < minutesOf(t.Maghrib)) return long ? 'night' : 'afternoon';
  return long ? 'night' : 'evening';
}

// Minutes of sleep `s` inside [from, to) (Date objects).
export function overlap(s, from, to) {
  const a = Math.max(new Date(s.start), from);
  const b = Math.min(new Date(s.end || nowLocal()), to);
  return Math.max(0, (b - a) / 60000);
}
