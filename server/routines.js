// Turns routines into real tasks for the last 7 days up to today, so they can
// be focused on, verified in Review and counted in Insights like any task.
// Each instance has a unique key, remembered in `routineKeys`, so an instance
// you delete is never recreated.
import { getDb, save, newId } from './db.js';
import { addDays, instanceStartingOn } from '../shared/routines.js';

const isUntouched = (t) =>
  t.status === 'todo' && !t.started && !t.main && !t.count && !t.remark && !(t.steps || []).some((s) => s.done);

const stepsFrom = (r) => (r.steps || []).filter(Boolean).map((text) => ({ id: newId(), text, done: false }));

export function syncRoutines(today, weekStartsOn = 1) {
  const db = getDb();
  const created = [];
  const updated = [];
  const removed = [];
  const oldest = addDays(today, -6);

  for (const r of db.routines) {
    if (!r.active) continue;
    const startDate = r.startDate || r.createdAt.slice(0, 10);
    for (let k = 12; k >= 0; k--) {
      const inst = instanceStartingOn(r, addDays(today, -k), weekStartsOn);
      if (!inst || inst.date > today) continue;
      const end = inst.until || inst.date;
      if (end < startDate || end < oldest || db.routineKeys[inst.key]) continue;
      // An instance whose time is already over (app wasn't opened) is recorded as missed.
      const past = end < today;
      const task = {
        id: newId(),
        createdAt: new Date().toISOString(),
        title: r.title,
        steps: stepsFrom(r),
        firstAction: (r.steps || []).find(Boolean) || '',
        category: r.category || 'deen',
        anchor: inst.anchor,
        time: inst.time || '',
        date: inst.date,
        until: inst.until,
        untilAnchor: inst.untilAnchor,
        scope: inst.scope,
        target: inst.target,
        count: 0,
        points: r.points ?? 10,
        quranTier: r.quranTier,
        weekly: r.kind === 'weekly' || undefined,
        routineId: r.id,
        instanceKey: inst.key,
        status: past ? 'notdone' : 'todo',
        autoMissed: past || undefined,
        started: false,
        main: false,
      };
      db.tasks.push(task);
      db.routineKeys[inst.key] = true;
      created.push(task);
    }
  }

  // Keep today's untouched instances in line with edits, pauses and deletions.
  for (const t of db.tasks) {
    if (!t.routineId || (t.until || t.date) < today || !isUntouched(t) || created.includes(t)) continue;
    const r = db.routines.find((x) => x.id === t.routineId);
    const inst = r?.active && instanceStartingOn(r, t.date, weekStartsOn);
    if (!inst) {
      removed.push(t.id);
      delete db.routineKeys[t.instanceKey];
      continue;
    }
    const steps = (r.steps || []).filter(Boolean);
    const sameSteps = steps.join('\n') === (t.steps || []).map((s) => s.text).join('\n');
    const before = JSON.stringify(t);
    Object.assign(t, {
      title: r.title,
      category: r.category,
      points: r.points ?? 10,
      anchor: inst.anchor,
      time: inst.time || '',
      until: inst.until,
      untilAnchor: inst.untilAnchor,
      target: inst.target,
      firstAction: steps[0] || '',
      ...(sameSteps ? {} : { steps: stepsFrom(r) }),
    });
    if (JSON.stringify(t) !== before) updated.push(t);
  }

  if (removed.length) db.tasks = db.tasks.filter((t) => !removed.includes(t.id));
  if (created.length || updated.length || removed.length) save();
  return { created, updated, removed };
}
