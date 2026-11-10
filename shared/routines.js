// Recurrence rules for routines (dailies & weeklies). Shared by the server,
// which creates the task instances, and the client, which previews them.
//
// A routine looks like:
//   { id, title, steps: [string], category, points, active, startDate,
//     kind: 'daily',  days: [0..6], anchor, time }
//   { ..., kind: 'weekly', mode: 'window', window: { startDay, startAnchor, endDay, endAnchor } }
//   { ..., kind: 'weekly', mode: 'open', target }       // N times "sometime this week"

const pad = (n) => String(n).padStart(2, '0');
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (s, n) => {
  const d = parse(s);
  d.setDate(d.getDate() + n);
  return toStr(d);
};
export const weekday = (s) => parse(s).getDay();
export function weekStartOf(s, weekStartsOn = 1) {
  const d = parse(s);
  d.setDate(d.getDate() - ((d.getDay() - weekStartsOn + 7) % 7));
  return toStr(d);
}

export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

// The instance a routine produces *starting* on date `d`, or null.
export function instanceStartingOn(r, d, weekStartsOn = 1) {
  const key = `${r.id}:${d}`;
  if (r.kind === 'daily') {
    const days = r.days?.length ? r.days : ALL_DAYS;
    if (!days.includes(weekday(d))) return null;
    return { key, date: d, anchor: r.anchor || 'any', time: r.time || '' };
  }
  if (r.mode === 'window') {
    const w = r.window || {};
    if (weekday(d) !== Number(w.startDay)) return null;
    const span = (Number(w.endDay) - Number(w.startDay) + 7) % 7;
    return {
      key, date: d,
      until: span ? addDays(d, span) : undefined,
      anchor: w.startAnchor || 'any',
      untilAnchor: w.endAnchor || 'any',
      time: r.time || '',
    };
  }
  // "Anytime this week", optionally several times.
  if (d !== weekStartOf(d, weekStartsOn)) return null;
  return { key, date: d, until: addDays(d, 6), anchor: 'any', scope: 'week', target: Math.max(1, Number(r.target) || 1) };
}

// The instance whose date range covers `d` (looks back up to 6 days).
export function instanceCovering(r, d, weekStartsOn = 1) {
  for (let k = 0; k < 7; k++) {
    const inst = instanceStartingOn(r, addDays(d, -k), weekStartsOn);
    if (inst && (inst.until || inst.date) >= d) return inst;
  }
  return null;
}
