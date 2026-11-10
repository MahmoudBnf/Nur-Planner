// Actions on the Qur'an revision state. Revisions are logs (one per entry,
// dated to the day they count for); each log can undo itself as long as
// nothing was revised after it in that tier.
import { useCallback, useEffect, useRef } from 'react';
import { useData } from './DataContext.jsx';
import { doneStamp, onDay, todayStr } from '../lib/utils.js';
import { dailyAmount, dayPlan, hifzNext, levelOf, recordPure, setLevels, toRuns, unrecordPure } from '../lib/quran.js';

// One Qur'an change at a time across the whole page: a double click must not
// record the same portion twice from the same (not yet updated) state.
let busy = false;
const exclusive = (fn) => async (...args) => {
  if (busy) return { ok: false, busy: true };
  busy = true;
  try { return await fn(...args); } finally { busy = false; }
};

export function useQuran() {
  const { quran, saveQuran, add, remove, update, tasks, quranLogs } = useData();
  const q = quran || {};

  const plan = useCallback((tier, day = todayStr()) => dayPlan(q, tasks, quranLogs, tier, day), [q, tasks, quranLogs]);

  // Set how much of a tier was revised on `day` (in thumun). Going down undoes
  // that day's latest entries; refused if a later day was recorded after them.
  const setRevised = useCallback(exclusive(async (tier, day, total) => {
    const dayLogs = quranLogs
      .filter((l) => l.kind === 'revise' && l.tier === tier && l.date === day)
      .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
    let cur = dayLogs.reduce((n, l) => n + l.units, 0);
    let work = q;
    const removed = [];
    while (cur > total && dayLogs.length) {
      const l = dayLogs.pop();
      const back = unrecordPure(work, l);
      if (!back) return { ok: false, error: 'A later revision of this tier is recorded after this one — lower that one first.' };
      work = { ...work, ...back };
      removed.push(l);
      cur -= l.units;
    }
    let log = null;
    if (total > cur) {
      const r = recordPure(work, tier, total - cur, day);
      if (r) { work = { ...work, ...r.state }; log = r.log; }
    }
    if (work === q) return { ok: true };
    if (!await saveQuran({ pointers: work.pointers, cycles: work.cycles, revisedAt: work.revisedAt, khatm: work.khatm, cycleDays: work.cycleDays, pendingCycleDays: work.pendingCycleDays || {} })) return { ok: false };
    removed.forEach((l) => remove('quranLogs', l.id));
    if (log) await add('quranLogs', log);

    // Keep the day's task in step: ✓ when everything due is revised, ~ when part of it.
    const logsAfter = [...quranLogs.filter((l) => !removed.includes(l)), ...(log ? [log] : [])];
    const p = dayPlan(work, tasks, logsAfter, tier, day);
    if (p.task) {
      const status = p.done >= p.total ? 'done' : p.done > 0 ? 'partial' : day < todayStr() ? 'notdone' : 'todo';
      update('tasks', p.task.id, { status, started: p.done > 0 || p.task.started, doneAt: status === 'done' ? doneStamp(p.task) : p.task.doneAt, quranRecorded: status === 'done' });
    }
    return { ok: true };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [q, quranLogs, tasks, saveQuran, add, remove, update]);

  // Memorized a thumun from Tier 3: it moves to Tier 2 and counts as revised that day.
  const memorize = useCallback(exclusive(async (unit = hifzNext(q), date = todayStr()) => {
    if (unit == null) return null;
    const snap = { unit, prevLevel: levelOf(q, unit), prevRevised: q.revisedAt?.[unit] ?? null };
    if (!await saveQuran({ levels: setLevels(q, [unit], 2), revisedAt: { ...(q.revisedAt || {}), [unit]: date }, hifzNext: null })) return null;
    const log = await add('quranLogs', { date, tier: 4, kind: 'memorize', ranges: [[unit, unit]], units: 1 });
    return { ...snap, logId: log.id };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [q, saveQuran, add]);

  const move = useCallback(async (units, tier) => {
    saveQuran({ levels: setLevels(q, units, tier) });
    await add('quranLogs', { date: todayStr(), tier, kind: 'move', ranges: toRuns(units), units: units.length });
  }, [q, saveQuran, add]);

  // Undo a memorization (touches only that thumun).
  const undo = useCallback((snap) => {
    if (!snap || snap.unit == null) return;
    const revisedAt = { ...(q.revisedAt || {}) };
    if (snap.prevRevised) revisedAt[snap.unit] = snap.prevRevised; else delete revisedAt[snap.unit];
    saveQuran({ levels: setLevels(q, [snap.unit], snap.prevLevel ?? 3), revisedAt });
    if (snap.logId) remove('quranLogs', snap.logId);
  }, [q, saveQuran, remove]);

  const todayTask = (tier) => tasks.find((t) => t.quranTier === tier && onDay(t, todayStr()) && !t.carriedFrom);

  const memorizeToday = useCallback(async (unit) => {
    const snap = await memorize(unit);
    if (!snap?.logId) return snap;
    const t = todayTask(4);
    if (t && t.status !== 'done') {
      const count = (t.count || 0) + 1;
      const target = t.target || 1;
      update('tasks', t.id, { count, started: true, quranSnaps: [...(t.quranSnaps || []), snap], ...(count >= target ? { status: 'done', doneAt: doneStamp(t) } : {}) });
    }
    return snap;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memorize, update, tasks]);

  return { q, plan, setRevised, memorize, move, undo, memorizeToday, todayTask };
}

// Bookkeeping, once per change:
// - each tier task remembers its own share (so later tier changes don't rewrite the past);
// - a tier task marked done elsewhere (Focus, main task…) gets its revision recorded,
//   one at a time so each sees the moved pointer.
export function useQuranAutoRecord() {
  const { tasks, update } = useData();
  const quran = useQuran();
  const running = useRef(false);
  useEffect(() => {
    if (running.current || !quran.q.setup) return;
    const today = todayStr();
    tasks.filter((t) => t.quranTier && t.quranTier < 4 && t.quranDue == null && t.date <= today)
      .forEach((t) => update('tasks', t.id, { quranDue: dailyAmount(quran.q, t.quranTier) }));
    const t = tasks
      .filter((x) => x.quranTier && x.quranTier < 4 && x.status === 'done' && !x.quranRecorded && !x.carriedFrom)
      .sort((a, b) => a.date.localeCompare(b.date))[0];
    if (!t) return;
    running.current = true;
    (async () => {
      const p = quran.plan(t.quranTier, t.date);
      const r = await quran.setRevised(t.quranTier, t.date, Math.max(p.done, p.total));
      if (r.ok) update('tasks', t.id, { quranRecorded: true });
      running.current = false;
    })();
  }, [tasks, quran]);
}
