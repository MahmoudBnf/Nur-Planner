import { useState } from 'react';
import { CalendarDays, Plus, Sparkles } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { ANCHORS, ANCHOR_KEYS, CATEGORIES, CATEGORY_KEYS, WD } from '../lib/constants.js';
import { cx, todayStr } from '../lib/utils.js';
import { ALL_DAYS } from '../../../shared/routines.js';
import { Seg } from './ui.jsx';
import { StepsEditor, TaskItem } from './Tasks.jsx';

const PRAYER_POINTS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
const pointLabel = (k, end) => (k && k !== 'any' ? ANCHORS[k].prayer : end ? 'end of day' : 'start of day');

export function describeRoutine(r) {
  if (r.kind === 'daily') {
    const days = r.days?.length ? r.days : ALL_DAYS;
    const when = days.length === 7 ? 'Every day'
      : days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d)) ? 'Weekdays'
      : [...days].sort().map((d) => WD[d]).join(', ');
    return [when, r.anchor && r.anchor !== 'any' ? ANCHORS[r.anchor].label : null, r.time || null].filter(Boolean).join(' · ');
  }
  if (r.mode === 'window') {
    const w = r.window;
    return `${WD[w.startDay]} from ${pointLabel(w.startAnchor)} → ${WD[w.endDay]} until ${pointLabel(w.endAnchor, true)}`;
  }
  return (r.target || 1) > 1 ? `${r.target}× this week, any day` : 'Once this week, any day';
}

export const blankRoutine = (kind = 'daily') => ({
  title: '', category: 'deen', points: 10, kind, days: ALL_DAYS, anchor: 'any', time: '',
  mode: 'window', window: { startDay: 4, startAnchor: 'maghrib', endDay: 5, endAnchor: 'maghrib' }, target: 1, steps: [''],
});

export function RoutineForm({ initial, onSave, onCancel }) {
  const [r, setR] = useState(() => ({ ...blankRoutine(initial?.kind), ...initial, steps: initial?.steps?.length ? initial.steps : [''] }));
  const set = (patch) => setR((x) => ({ ...x, ...patch }));
  const setW = (patch) => setR((x) => ({ ...x, window: { ...x.window, ...patch } }));
  const days = r.days?.length ? r.days : ALL_DAYS;
  const toggleDay = (d) => set({ days: days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort() });

  const submit = (e) => {
    e.preventDefault();
    if (!r.title.trim()) return;
    if (r.kind === 'daily' && !days.length) return;
    onSave({ ...r, title: r.title.trim(), steps: r.steps.map((s) => s.trim()).filter(Boolean) });
  };

  return (
    <form className="stack" style={{ gap: 14 }} onSubmit={submit}>
      <Seg value={r.kind} onChange={(kind) => set({ kind })} options={[{ value: 'daily', label: '☀ Daily' }, { value: 'weekly', label: '🗓 Weekly' }]} />
      <input className="input" autoFocus placeholder={r.kind === 'daily' ? 'e.g. Revise 3 ahzab' : 'e.g. Read Surat Al-Kahf'} value={r.title} onChange={(e) => set({ title: e.target.value })} />

      {r.kind === 'daily' ? (
        <>
          <label className="field">On which days?
            <div className="weekday-pick">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button type="button" key={d} className={cx(days.includes(d) && 'on')} onClick={() => toggleDay(d)}>{WD[d]}</button>
              ))}
            </div>
          </label>
          <div className="grid g-2" style={{ gap: 10 }}>
            <label className="field">Block
              <select className="select" value={r.anchor} onChange={(e) => set({ anchor: e.target.value })}>
                {ANCHOR_KEYS.map((k) => <option key={k} value={k}>{ANCHORS[k].label}</option>)}
              </select>
            </label>
            <label className="field">Exact time (optional — reminder)
              <input className="input" type="time" value={r.time || ''} onChange={(e) => set({ time: e.target.value })} />
            </label>
          </div>
        </>
      ) : (
        <>
          <Seg value={r.mode} onChange={(mode) => set({ mode })} options={[{ value: 'window', label: 'In a specific window' }, { value: 'open', label: 'Anytime this week' }]} />
          {r.mode === 'window' ? (
            <div className="grid g-2" style={{ gap: 10 }}>
              <label className="field">From
                <div className="row">
                  <select className="select" value={r.window.startDay} onChange={(e) => setW({ startDay: Number(e.target.value) })}>
                    {WD.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <select className="select" value={r.window.startAnchor} onChange={(e) => setW({ startAnchor: e.target.value })}>
                    <option value="any">start of day</option>
                    {PRAYER_POINTS.map((k) => <option key={k} value={k}>{ANCHORS[k].prayer}</option>)}
                  </select>
                </div>
              </label>
              <label className="field">Until
                <div className="row">
                  <select className="select" value={r.window.endDay} onChange={(e) => setW({ endDay: Number(e.target.value) })}>
                    {WD.map((d, i) => <option key={i} value={i}>{d}</option>)}
                  </select>
                  <select className="select" value={r.window.endAnchor} onChange={(e) => setW({ endAnchor: e.target.value })}>
                    <option value="any">end of day</option>
                    {PRAYER_POINTS.map((k) => <option key={k} value={k}>{ANCHORS[k].prayer}</option>)}
                  </select>
                </div>
              </label>
            </div>
          ) : (
            <label className="field">How many times per week?
              <Seg value={r.target || 1} onChange={(target) => set({ target })} options={[1, 2, 3, 4, 5, 6].map((n) => ({ value: n, label: `${n}×` }))} />
            </label>
          )}
        </>
      )}

      <label className="field">Steps (optional)
        <StepsEditor steps={r.steps} onChange={(steps) => set({ steps })} />
      </label>
      <div className="grid g-2" style={{ gap: 10 }}>
        <label className="field">Category
          <select className="select" value={r.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label} — {CATEGORIES[k].long}</option>)}
          </select>
        </label>
        <label className="field">Activity points
          <Seg value={r.points} onChange={(points) => set({ points })} options={[5, 10, 20, 30].map((n) => ({ value: n, label: String(n) }))} />
        </label>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        {onCancel && <button type="button" className="btn ghost" onClick={onCancel}>Cancel</button>}
        <button className="btn primary"><Plus size={16} /> {initial?.id ? 'Save routine' : 'Create routine'}</button>
      </div>
      <p className="tiny muted">Changes apply to today’s occurrence (if you haven’t started it) and all future ones. Past days keep their history.</p>
    </form>
  );
}

// WuWa-style activity meter with milestones.
export function ActivityBar({ points, goal = 100, weekly, extra }) {
  const pct = goal ? Math.min(1, points / goal) : 0;
  const marks = [0.2, 0.4, 0.6, 0.8, 1];
  return (
    <div className={cx('activity', pct >= 1 && 'full', weekly && 'weekly')}
      title={weekly ? 'Points from this week’s weekly routines' : 'Points from today’s tasks and daily routines (weeklies have their own meter)'}>
      <div className="row between">
        <span className="small muted">{weekly ? <CalendarDays size={13} style={{ verticalAlign: -2 }} /> : <Sparkles size={13} style={{ verticalAlign: -2 }} />} {weekly ? 'Weekly activity' : 'Daily activity'}</span>
        <b className="nums">{points}<span className="muted small">/{goal}</span>{extra > 0 && <span className="tiny muted" title="Qur'an catch-up: debt paid or extra reading, at half rate"> · {extra} catch-up</span>}</b>
      </div>
      <div className="activity-track">
        <div className="activity-fill" style={{ width: `${pct * 100}%` }} />
        {marks.map((m) => <span key={m} className={cx('activity-node', pct >= m && 'on')} style={{ left: `${m * 100}%` }} />)}
      </div>
    </div>
  );
}

// "Anytime this week" routines, shown apart from the day's list.
export function WeekliesCard({ list }) {
  if (!list.length) return null;
  const done = list.filter((t) => t.status === 'done').length;
  return (
    <div className="card">
      <div className="card-head">
        <h2>🗓 This week</h2>
        <span className="badge">{done}/{list.length}</span>
      </div>
      <div className="task-list">{list.map((t) => <TaskItem key={t.id} task={t} compact />)}</div>
      <p className="tiny muted mt-1">Any day this week — tap ＋ each time you do it.</p>
    </div>
  );
}

export const isWeekScope = (t) => t.scope === 'week';
export const routineHistory = (tasks, id) =>
  tasks.filter((t) => t.routineId === id && t.date <= todayStr()).sort((a, b) => a.date.localeCompare(b.date));
