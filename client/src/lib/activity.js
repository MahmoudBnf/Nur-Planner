// Activity points, WuWa-style: a daily meter fed by the day's tasks and a
// weekly one fed by weekly routines — a weekly never fills the daily meter.
// Qur'an catch-up (beyond the day's own share) goes to the weekly meter.
import { addDays, doneOn, pointsOf } from './utils.js';
import { dayPlan, pointsSplit } from './quran.js';

export function isWeeklyTask(t, routines) {
  if (t.weekly || t.scope === 'week' || t.until) return true;
  return !!t.routineId && routines?.find((r) => r.id === t.routineId)?.kind === 'weekly';
}

// Points one task earns for `day`. A Qur'an tier earns in proportion to what was
// revised that day vs. its own share, up to 100%.
export function taskPoints(t, day, ctx) {
  if (t.quranTier && t.quranTier < 4) {
    if (t.date !== day || t.carriedFrom) return 0;
    return Math.round(pointsOf(t) * pointsSplit(dayPlan(ctx.quran || {}, ctx.tasks, ctx.quranLogs, t.quranTier, day)).daily);
  }
  return t.status === 'done' && doneOn(t) === day ? pointsOf(t) : 0;
}

export function dailyPoints(ctx, day) {
  return ctx.tasks.filter((t) => !isWeeklyTask(t, ctx.routines)).reduce((n, t) => n + taskPoints(t, day, ctx), 0);
}

// Qur'an revised beyond each day's own share, in points (half rate). Counts rest
// days too, using the tier routine's points.
export function catchUpPoints(ctx, day) {
  let n = 0;
  for (const tier of [1, 2, 3]) {
    const p = dayPlan(ctx.quran || {}, ctx.tasks, ctx.quranLogs, tier, day);
    if (!p.done) continue;
    const pts = p.task ? pointsOf(p.task) : ctx.routines?.find((r) => r.quranTier === tier)?.points ?? 10;
    n += pts * pointsSplit(p).catchUp;
  }
  return Math.round(n);
}

// The week's weeklies (points earned / the most there was to earn), plus Qur'an catch-up.
export function weeklyPoints(ctx, weekStart) {
  const end = addDays(weekStart, 6);
  const list = ctx.tasks.filter((t) => isWeeklyTask(t, ctx.routines) && t.date >= weekStart && t.date <= end);
  let catchUp = 0;
  for (let d = weekStart; d <= end; d = addDays(d, 1)) catchUp += catchUpPoints(ctx, d);
  return {
    points: list.filter((t) => t.status === 'done').reduce((n, t) => n + pointsOf(t), 0) + catchUp,
    goal: list.reduce((n, t) => n + pointsOf(t), 0),
    catchUp,
  };
}
