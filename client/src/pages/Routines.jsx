import { useEffect, useState } from 'react';
import { Repeat, Plus, Pencil, Pause, PlayCircle, Trash2, Flame, Timer, Wand2 } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { CATEGORIES, ROUTINE_TEMPLATES } from '../lib/constants.js';
import { addDays, cx, fmtCountdown, onDay, routineStreak, todayStr, weekStartOf } from '../lib/utils.js';
import { instanceCovering } from '../../../shared/routines.js';
import { Empty, Modal } from '../components/ui.jsx';
import { RoutineForm, describeRoutine, routineHistory } from '../components/Routine.jsx';

const STATUS_COLOR = { done: 'var(--good)', partial: 'var(--warn)', notdone: 'var(--bad)', todo: 'var(--surface-3)' };

function useResetClock(weekStartsOn) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 30000); return () => clearInterval(t); }, []);
  const now = new Date();
  const midnight = new Date(now); midnight.setHours(24, 0, 0, 0);
  const [y, m, d] = addDays(weekStartOf(todayStr(), weekStartsOn), 7).split('-').map(Number);
  const weekReset = new Date(y, m - 1, d);
  return { daily: (midnight - now) / 1000, weekly: (weekReset - now) / 1000 };
}
const fmtLong = (s) => (s > 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : fmtCountdown(s));

function RoutineCard({ r, onEdit }) {
  const { tasks, update, remove, settings } = useData();
  const today = todayStr();
  const ws = settings.weekStartsOn ?? 1;
  const inst = tasks.find((t) => t.routineId === r.id && onDay(t, today));
  const scheduledToday = r.active && instanceCovering(r, today, ws);
  const streak = routineStreak(tasks, r.id, today);
  const history = routineHistory(tasks, r.id).slice(-14);
  const doneCount = history.filter((t) => t.status === 'done').length;

  let state = { label: 'Not today', cls: '' };
  if (!r.active) state = { label: 'Paused', cls: '' };
  else if (inst?.status === 'done') state = { label: '✓ Done', cls: 'good' };
  else if (inst && inst.target > 1) state = { label: `${inst.count || 0}/${inst.target}`, cls: 'on' };
  else if (inst) state = { label: 'Open', cls: 'warn' };
  else if (scheduledToday) state = { label: 'Removed today', cls: '' };

  return (
    <div className={cx('routine', !r.active && 'paused', inst?.status === 'done' && 'complete')}>
      <span className="cat-bar" style={{ background: CATEGORIES[r.category]?.color }} />
      <div className="grow">
        <div className="row between">
          <b>{r.title}</b>
          <span className={cx('chip', state.cls)}>{state.label}</span>
        </div>
        <div className="small muted">{describeRoutine(r)}</div>
        {r.steps?.length > 0 && <div className="tiny text-2 mt-1">{r.steps.length} step{r.steps.length > 1 ? 's' : ''} · first: {r.steps[0]}</div>}
        <div className="row between wrap mt-1">
          <div className="row" style={{ gap: 6 }}>
            <span className="chip gold"><Flame size={11} /> {streak}</span>
            <span className="chip">+{r.points ?? 10} pts</span>
            <div className="history" title={`${doneCount}/${history.length} recent occurrences done`}>
              {history.map((t) => <i key={t.id} style={{ background: STATUS_COLOR[t.status] || STATUS_COLOR.todo }} title={`${t.date}: ${t.status}`} />)}
            </div>
          </div>
          <div className="row" style={{ gap: 0 }}>
            <button className="icon-btn" title="Edit" onClick={() => onEdit(r)}><Pencil size={15} /></button>
            <button className="icon-btn" title={r.active ? 'Pause' : 'Resume'} onClick={() => update('routines', r.id, { active: !r.active })}>
              {r.active ? <Pause size={15} /> : <PlayCircle size={15} />}
            </button>
            <button className="icon-btn" title="Delete routine (history is kept)" onClick={() => confirm(`Delete “${r.title}”? Past occurrences stay in your history.`) && remove('routines', r.id)}><Trash2 size={15} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Routines() {
  const { routines, add, update, settings, syncRoutines } = useData();
  const ws = settings.weekStartsOn ?? 1;
  const reset = useResetClock(ws);
  const [editing, setEditing] = useState(null); // routine object (new or existing)
  const dailies = routines.filter((r) => r.kind === 'daily');
  const weeklies = routines.filter((r) => r.kind === 'weekly');

  // Every change to routines is reflected in today's tasks.
  const sig = JSON.stringify(routines.map((r) => [r.id, r.active, r.updatedAt]));
  useEffect(() => { syncRoutines(ws); }, [sig, ws, syncRoutines]);

  const save = async (r) => {
    const { id, createdAt, updatedAt, ...data } = r;
    if (id) update('routines', id, data);
    else await add('routines', { ...data, active: true, startDate: todayStr() });
    setEditing(null);
    setTimeout(() => syncRoutines(ws), 450);
  };

  const used = new Set(routines.map((r) => r.title));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Routines</h1>
          <div className="sub">Dailies and weeklies appear in your day automatically — and reset instead of piling up.</div>
        </div>
        <div className="row">
          <span className="chip"><Timer size={12} /> Daily reset in {fmtLong(reset.daily)}</span>
          <span className="chip"><Timer size={12} /> Weekly reset in {fmtLong(reset.weekly)}</span>
        </div>
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-head">
            <h2><Repeat size={18} /> Dailies</h2>
            <button className="btn sm primary" onClick={() => setEditing({ kind: 'daily' })}><Plus size={15} /> Daily</button>
          </div>
          {dailies.length === 0 ? <Empty>Things you do every day (or on certain days): adhkar, Qur’an revision, typing practice…</Empty> : (
            <div className="stack" style={{ gap: 8 }}>{dailies.map((r) => <RoutineCard key={r.id} r={r} onEdit={setEditing} />)}</div>
          )}
        </div>
        <div className="card">
          <div className="card-head">
            <h2>🗓 Weeklies</h2>
            <button className="btn sm primary" onClick={() => setEditing({ kind: 'weekly' })}><Plus size={15} /> Weekly</button>
          </div>
          {weeklies.length === 0 ? <Empty>Once (or N times) a week — in a specific window like Thursday Maghrib → Friday Maghrib, or any day.</Empty> : (
            <div className="stack" style={{ gap: 8 }}>{weeklies.map((r) => <RoutineCard key={r.id} r={r} onEdit={setEditing} />)}</div>
          )}
        </div>
      </div>

      <div className="card mt-3">
        <div className="card-head"><h2><Wand2 size={18} /> Quick start</h2><span className="small muted">Click one to open it pre-filled — adjust, then create.</span></div>
        <div className="templates">
          {ROUTINE_TEMPLATES.filter((t) => !used.has(t.title)).map((t) => (
            <button key={t.title} className="template" onClick={() => setEditing({ ...t })}>
              <span className="dot" style={{ background: CATEGORIES[t.category].color }} />
              <span className="grow"><b>{t.title}</b><span className="tiny muted">{describeRoutine({ ...t, days: t.days })}</span></span>
              <Plus size={15} />
            </button>
          ))}
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit routine' : 'New routine'} width={620}>
        {editing && <RoutineForm key={editing.id || editing.title || editing.kind} initial={editing} onSave={save} onCancel={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
