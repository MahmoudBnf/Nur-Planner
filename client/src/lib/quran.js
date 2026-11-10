// Qur'an revision (muraja'a) model.
//
// The mushaf is 60 hizb × 8 thumun = 480 units. Each unit belongs to a tier:
//   1 = solid (recite from anywhere), 2 = medium (sometimes check the mushaf),
//   3 = read from the mushaf. "Tier 4" is memorization: it moves units 3 → 2.
// Every tier is revised in cycles; its daily portion = its size ÷ reading days
// per cycle, in thumun, so it adapts when units change tier. Each tier keeps a
// pointer (the next unit to revise). What isn't revised on a reading day becomes
// debt, added to the next days on top of their own portion (capped at one cycle).
import meta from './quran-meta.json';
import { addDays } from './utils.js';

export const UNITS = 480;
export const SURAHS = meta.surahs;

export const TIER_INFO = {
  1: { name: 'Tier 1 · Solid', short: 'Solid', hint: 'You can continue from any ayah', color: 'var(--cat-3)' },
  2: { name: 'Tier 2 · Medium', short: 'Medium', hint: 'Revised, sometimes checking the mushaf', color: 'var(--cat-1)' },
  3: { name: 'Tier 3 · Mushaf', short: 'Mushaf', hint: 'Read from the mushaf', color: 'var(--cat-4)' },
  4: { name: 'Hifz · Tier 3 → 2', short: 'Hifz', hint: 'Memorize thumun by thumun, moving them to Tier 2', color: 'var(--gold)' },
};
export const DEFAULTS = {
  cycleDays: { 1: 6, 2: 3, 3: 7 }, // reading days per cycle
  restFriday: { 1: true, 2: true, 3: false },
  hifzPerWeek: 1, // thumun
};

const FRACTIONS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
// 28 → "3½", 4 → "½", 8 → "1"
export const fmtHizb = (units) => `${Math.floor(units / 8) || (units % 8 ? '' : '0')}${FRACTIONS[units % 8]}`;
export const hizbOf = (u) => Math.floor(u / 8) + 1;
export const thumunOf = (u) => (u % 8) + 1;
export const positionLabel = (u) => (u % 8 === 0 ? `Hizb ${hizbOf(u)}` : `Hizb ${hizbOf(u)} · thumun ${thumunOf(u)}`);

export function initialLevels(t1End, t2End) {
  let s = '';
  for (let u = 0; u < UNITS; u++) s += u < t1End * 8 ? '1' : u < t2End * 8 ? '2' : '3';
  return s;
}
export const levelOf = (q, u) => Number(q?.levels?.[u] || 3);
export const unitsOf = (q, tier) => {
  const out = [];
  for (let u = 0; u < UNITS; u++) if (levelOf(q, u) === tier) out.push(u);
  return out;
};
export const setLevels = (q, units, tier) => {
  const arr = (q.levels || initialLevels(0, 0)).split('');
  units.forEach((u) => (arr[u] = String(tier)));
  return arr.join('');
};

export const cycleDaysOf = (q, tier) => Number(q?.cycleDays?.[tier]) || DEFAULTS.cycleDays[tier];
export const restsFriday = (q, tier) => q?.restFriday?.[tier] ?? DEFAULTS.restFriday[tier];

export function dailyAmount(q, tier) {
  const n = unitsOf(q, tier).length;
  return n ? Math.ceil(n / cycleDaysOf(q, tier)) : 0;
}

// The next `count` units of a tier from its pointer, wrapping into the next cycle.
export function takeUnits(q, tier, count) {
  const list = unitsOf(q, tier);
  if (!list.length) return { units: [], list, index: 0 };
  const ptr = q?.pointers?.[tier] ?? list[0];
  let i = list.findIndex((u) => u >= ptr);
  if (i < 0) i = 0;
  const n = Math.min(Math.max(0, count), list.length);
  return { units: Array.from({ length: n }, (_, j) => list[(i + j) % list.length]), list, index: i };
}

// Revising `k` units of a tier on `day`: the new state plus a log that can undo it.
export function recordPure(q, tier, k, day) {
  const { units, list, index } = takeUnits(q, tier, k);
  if (!units.length) return null;
  const end = index + units.length;
  const prev = Object.fromEntries(units.map((u) => [u, q.revisedAt?.[u] ?? null]));
  const revisedAt = { ...(q.revisedAt || {}) };
  units.forEach((u) => (revisedAt[u] = day));
  let khatm = q.khatm || { count: 0, start: day };
  const covered = Object.values(revisedAt).filter((d) => d >= khatm.start).length;
  const khatmDone = covered >= UNITS;
  if (khatmDone) khatm = { count: khatm.count + 1, start: addDays(day, 1), last: day };
  const ptrAfter = list[end % list.length];
  const wrapped = end >= list.length;
  // A rhythm changed in the setup takes effect when its tier starts a new cycle.
  const pending = wrapped && q.pendingCycleDays?.[tier];
  const rhythm = pending ? {
    cycleDays: { ...(q.cycleDays || {}), [tier]: pending },
    pendingCycleDays: Object.fromEntries(Object.entries(q.pendingCycleDays).filter(([k]) => Number(k) !== tier)),
  } : {};
  return {
    state: {
      pointers: { ...(q.pointers || {}), [tier]: ptrAfter },
      cycles: { ...(q.cycles || {}), [tier]: (q.cycles?.[tier] || 0) + Math.floor(end / list.length) },
      revisedAt, khatm, ...rhythm,
    },
    log: {
      date: day, tier, kind: 'revise', ranges: toRuns(units), units: units.length,
      undo: {
        ptr: list[index], ptrAfter, cycles: q.cycles?.[tier] || 0, prev, khatm: khatmDone ? q.khatm || null : undefined,
        ...(pending && { cycleDays: q.cycleDays || {}, pendingCycleDays: q.pendingCycleDays }),
      },
    },
  };
}
// Undo a revision log — only if nothing was revised after it in that tier.
export function unrecordPure(q, log) {
  const u = log.undo;
  const list = unitsOf(q, log.tier);
  if (!u || (q.pointers?.[log.tier] ?? list[0]) !== u.ptrAfter) return null;
  const revisedAt = { ...(q.revisedAt || {}) };
  Object.entries(u.prev || {}).forEach(([k, d]) => (d ? (revisedAt[k] = d) : delete revisedAt[k]));
  return {
    pointers: { ...(q.pointers || {}), [log.tier]: u.ptr },
    cycles: { ...(q.cycles || {}), [log.tier]: u.cycles },
    revisedAt,
    khatm: u.khatm !== undefined ? u.khatm || { count: 0, start: log.date } : q.khatm,
    ...(u.cycleDays && { cycleDays: u.cycleDays, pendingCycleDays: u.pendingCycleDays }),
  };
}

// ---- debt: what a reading day didn't cover moves to the next days ----
export const revisedOn = (logs, tier, d) =>
  logs.reduce((n, l) => n + (l.kind === 'revise' && l.tier === tier && l.date === d ? l.units : 0), 0);
export const tierTaskOn = (tasks, tier, d) => tasks.find((t) => t.quranTier === tier && t.date === d && !t.carriedFrom);
// A day's own share, never more than the tier holds now (it may have shrunk since).
const dueOf = (q, t) => (t ? Math.min(unitsOf(q, t.quranTier).length, Number(t.quranDue ?? dailyAmount(q, t.quranTier)) || 0) : 0);

export function debtBefore(q, tasks, logs, tier, day) {
  const from = q?.debtFrom?.[tier] || '';
  const dates = new Set();
  tasks.forEach((t) => t.quranTier === tier && !t.carriedFrom && t.date < day && t.date >= from && dates.add(t.date));
  logs.forEach((l) => l.kind === 'revise' && l.tier === tier && l.date < day && l.date >= from && dates.add(l.date));
  // Never more than one full cycle: past that, every thumun of the tier is already owed.
  const cap = unitsOf(q, tier).length;
  let debt = 0;
  for (const d of [...dates].sort()) debt = Math.min(cap, Math.max(0, debt + dueOf(q, tierTaskOn(tasks, tier, d)) - revisedOn(logs, tier, d)));
  return debt;
}
// Everything about one tier on one day: debt carried in, its own share, what's done.
export function dayPlan(q, tasks, logs, tier, day) {
  const task = tierTaskOn(tasks, tier, day);
  const debt = debtBefore(q, tasks, logs, tier, day);
  const daily = dueOf(q, task);
  const done = revisedOn(logs, tier, day);
  const total = debt + daily;
  return { task, debt, daily, base: daily || dailyAmount(q, tier), total, done, left: Math.max(0, total - done), debtLeft: Math.max(0, debt - done) };
}
// Points for a day's revision, as shares of the tier's points:
// - daily: the day's own share, up to 100% (feeds the daily meter);
// - catchUp: anything beyond it (debt, rest-day reading, reading ahead) at half
//   rate, at most 50% — it feeds the weekly meter. Repaid is good, on time is better.
export const CATCH_UP_RATE = 0.5;
export function pointsSplit(plan) {
  const daily = plan.daily ? Math.min(1, plan.done / plan.daily) : 0;
  const extra = Math.max(0, plan.done - plan.daily);
  return { daily, catchUp: plan.base ? CATCH_UP_RATE * Math.min(1, extra / plan.base) : 0 };
}
export const unitsOfRanges = (ranges) => ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

// Consecutive runs, in reading order (a portion can wrap into the next cycle).
export function toRuns(units) {
  const runs = [];
  for (const u of units) {
    const last = runs[runs.length - 1];
    if (last && u === last[1] + 1) last[1] = u;
    else runs.push([u, u]);
  }
  return runs;
}

function piece(h, t1, t2) {
  if (t1 === 0 && t2 === 7) return `Hizb ${h}`;
  if (t1 === 0 && t2 === 3) return `1st half of Hizb ${h}`;
  if (t1 === 4 && t2 === 7) return `2nd half of Hizb ${h}`;
  if (t1 === t2) return `Hizb ${h} · thumun ${t1 + 1}`;
  return `Hizb ${h} · thumun ${t1 + 1}–${t2 + 1}`;
}
export function describeRun([a, b]) {
  const ha = hizbOf(a), hb = hizbOf(b), ta = a % 8, tb = b % 8;
  if (ha === hb) return piece(ha, ta, tb);
  const start = ta === 0 ? `Hizb ${ha}` : ta === 4 ? `2nd half of Hizb ${ha}` : `Hizb ${ha} (from thumun ${ta + 1})`;
  const end = tb === 7 ? `Hizb ${hb}` : tb === 3 ? `1st half of Hizb ${hb}` : `Hizb ${hb} (to thumun ${tb + 1})`;
  return `${start} → ${end}`;
}
export const describeUnits = (units) => toRuns(units).map(describeRun).join(' + ');

// Surahs at a unit's start/end, from the hizb-quarter table (thumun = half a quarter).
const surahAtStart = (u) => meta.quarters[Math.floor(u / 2)][0];
function surahAtEnd(u) {
  const nextQ = Math.ceil((u + 1) / 2);
  if (nextQ >= meta.quarters.length) return 114;
  const [s, a] = meta.quarters[nextQ];
  return a === 1 ? s - 1 : s;
}
// In reading order: a portion wrapping from An-Nas to Al-Fatiha lists them that way.
export function surahsOf(units) {
  const set = new Set();
  for (const [a, b] of toRuns(units)) for (let s = surahAtStart(a); s <= surahAtEnd(b); s++) set.add(s);
  return [...set];
}
export function surahLabel(units, lang = 'ar') {
  const list = surahsOf(units).map((n) => (lang === 'ar' ? SURAHS[n - 1].ar : SURAHS[n - 1].en));
  if (list.length <= 3) return list.join(lang === 'ar' ? ' · ' : ', ');
  return lang === 'ar' ? `${list[0]} ← … ← ${list[list.length - 1]}` : `${list[0]} → ${list[list.length - 1]} (${list.length} surahs)`;
}

export const hifzNext = (q) => {
  const pref = q?.hifzNext;
  if (pref != null && levelOf(q, pref) === 3) return pref;
  const list = unitsOf(q, 3);
  return list.length ? list[0] : null;
};

export const khatmProgress = (q) => {
  const start = q?.khatm?.start;
  if (!start) return 0;
  return Object.values(q.revisedAt || {}).filter((d) => d >= start).length / UNITS;
};

// Surahs beginning in each thumun. The table has hizb quarters, so a surah that
// starts inside a quarter is placed on that quarter's first thumun (≈).
export const SURAH_STARTS = (() => {
  const out = Array.from({ length: UNITS }, () => []);
  const cmp = ([s1, a1], [s2, a2]) => s1 - s2 || a1 - a2;
  for (let s = 1; s <= 114; s++) {
    let qi = 0;
    while (qi + 1 < meta.quarters.length && cmp(meta.quarters[qi + 1], [s, 1]) <= 0) qi++;
    out[qi * 2].push(s);
  }
  return out;
})();
export const surahName = (n, lang = 'ar') => (lang === 'ar' ? SURAHS[n - 1].ar : SURAHS[n - 1].en);
// The surah being read at a unit's start.
export const surahAt = (u) => surahAtStart(u);
