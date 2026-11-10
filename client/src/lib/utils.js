// Date helpers. Dates are always local "YYYY-MM-DD" strings.
const pad = (n) => String(n).padStart(2, '0');

export const toDateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayStr = () => toDateStr(new Date());
export const parseDate = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s, n) => {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
};
export const diffDays = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 864e5);

export function weekStartOf(s, weekStartsOn = 1) {
  const d = parseDate(s);
  const delta = (d.getDay() - weekStartsOn + 7) % 7;
  d.setDate(d.getDate() - delta);
  return toDateStr(d);
}
export const weekDays = (start) => Array.from({ length: 7 }, (_, i) => addDays(start, i));

export const fmtDate = (s, opts = { weekday: 'long', day: 'numeric', month: 'long' }) =>
  parseDate(s).toLocaleDateString('en-GB', opts);
export const fmtShort = (s) => parseDate(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const lastNDays = (n, end = todayStr()) => Array.from({ length: n }, (_, i) => addDays(end, i - n + 1));

export const minutesOf = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

// Current date/time as seen in a given IANA timezone.
export function nowInTz(tz) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    seconds: Number(get('hour')) * 3600 + Number(get('minute')) * 60 + Number(get('second')),
  };
}

export const fmtCountdown = (secs) => {
  secs = Math.max(0, Math.round(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${h}h ${pad(m)}m` : `${pad(m)}:${pad(s)}`;
};
export const fmtTimer = (secs) => {
  secs = Math.max(0, Math.round(secs));
  return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`;
};

export const greeting = () => {
  const h = new Date().getHours();
  if (h < 5) return 'Peaceful night';
  if (h < 12) return 'Sabah al-khayr';
  if (h < 18) return 'Good afternoon';
  return 'Masa al-khayr';
};

export const cx = (...c) => c.filter(Boolean).join(' ');

// Pull #tags out of free text.
export const extractTags = (text) => [...new Set((text.match(/#[\p{L}\d_-]+/gu) || []).map((t) => t.slice(1).toLowerCase()))];

// ---- tasks ----
// A task can span days (weekly windows): visible from `date` through `until`.
export const endDate = (t) => t.until || t.date;
export const onDay = (t, d) => (t.until ? t.date <= d && d <= t.until : t.date === d);
export const nextStep = (t) => (t.steps || []).find((s) => !s.done && s.text)?.text || (t.steps?.length ? '' : t.firstAction || '');
export const pointsOf = (t) => t.points ?? (t.main ? 20 : 10);
// The day a completion counts for: always inside the task's own day/window, so
// verifying yesterday's task today (in Review) credits yesterday, not today.
export function doneOn(t) {
  const d = t.doneAt ? toDateStr(new Date(t.doneAt)) : endDate(t);
  return d < t.date ? t.date : d > endDate(t) ? endDate(t) : d;
}
// When ticking: re-use the first completion time, so an accidental untick +
// re-tick doesn't move a weekly to today.
export const doneStamp = (t) => t.doneAt || new Date().toISOString();

// Which salah block a clock time falls into.
export function blockAt(mins, timings) {
  const order = [['isha', 'Isha'], ['maghrib', 'Maghrib'], ['asr', 'Asr'], ['dhuhr', 'Dhuhr'], ['fajr', 'Fajr']];
  for (const [k, p] of order) if (timings?.[p] && mins >= minutesOf(timings[p])) return k;
  return 'isha'; // after midnight, before Fajr
}
// Which block a task is listed under on day `d`.
export function blockOf(t, d, timings) {
  if (t.until && d !== t.date) return 'fajr'; // a window continuing from a previous day
  if (t.anchor && t.anchor !== 'any') return t.anchor;
  if (t.time && timings) return blockAt(minutesOf(t.time), timings);
  return 'any';
}

// Consecutive completed occurrences of a routine (an open one doesn't break it).
export function routineStreak(tasks, routineId, today) {
  const list = tasks.filter((t) => t.routineId === routineId).sort((a, b) => b.date.localeCompare(a.date));
  let n = 0;
  for (const t of list) {
    if (t.status === 'done') n++;
    else if (t.status === 'todo' && endDate(t) >= today) continue;
    else break;
  }
  return n;
}

export const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
export const daySeed = (s = todayStr()) => Number(s.replaceAll('-', ''));
