import { useState } from 'react';
import { ChevronLeft, ChevronRight, Target, Plus, Trash2, NotebookPen, Repeat } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { CATEGORIES, CATEGORY_KEYS } from '../lib/constants.js';
import { addDays, cx, fmtDate, onDay, parseDate, todayStr, weekDays, weekStartOf } from '../lib/utils.js';
import { instanceCovering } from '../../../shared/routines.js';
import { WeekliesCard } from '../components/Routine.jsx';
import { CatChip, Empty, Progress } from '../components/ui.jsx';

function Goals({ week }) {
  const { weeklyGoals, tasks, add, update, remove } = useData();
  const [title, setTitle] = useState('');
  const [why, setWhy] = useState('');
  const [category, setCategory] = useState('growth');
  const goals = weeklyGoals.filter((g) => g.weekStart === week);
  const days = weekDays(week);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await add('weeklyGoals', { weekStart: week, title: title.trim(), why: why.trim(), category, progress: 0, status: 'active', remark: '' });
    setTitle(''); setWhy('');
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2><Target size={18} /> Objectives of the week</h2>
        <span className="small muted">Choose 1–3. Fewer, clearer, actually done.</span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {goals.length === 0 && <Empty>No objectives yet for this week.</Empty>}
        {goals.map((g) => {
          const linked = tasks.filter((t) => t.goalId === g.id && days.includes(t.date));
          const linkedDone = linked.filter((t) => t.status === 'done').length;
          return (
            <div key={g.id} className="goal">
              <span className="cat-bar" style={{ background: CATEGORIES[g.category]?.color }} />
              <div className="grow stack" style={{ gap: 6 }}>
                <div className="row between">
                  <b style={{ textDecoration: g.status === 'done' ? 'line-through' : 'none' }}>{g.title}</b>
                  <div className="row" style={{ gap: 4 }}>
                    <CatChip cat={g.category} />
                    <select className="select" style={{ width: 'auto', padding: '4px 28px 4px 8px', fontSize: 12 }} value={g.status}
                      onChange={(e) => update('weeklyGoals', g.id, { status: e.target.value, progress: e.target.value === 'done' ? 100 : g.progress })}>
                      <option value="active">Active</option>
                      <option value="done">✓ Achieved</option>
                      <option value="partial">~ Partly</option>
                      <option value="dropped">✗ Not achieved</option>
                    </select>
                    <button className="icon-btn" onClick={() => remove('weeklyGoals', g.id)}><Trash2 size={15} /></button>
                  </div>
                </div>
                {g.why && <div className="small muted">Why: {g.why}</div>}
                <div className="row">
                  <input type="range" min="0" max="100" step="5" value={g.progress || 0} onChange={(e) => update('weeklyGoals', g.id, { progress: Number(e.target.value) })} />
                  <span className="nums small" style={{ width: 40 }}>{g.progress || 0}%</span>
                </div>
                {linked.length > 0 && <div className="tiny muted">{linkedDone}/{linked.length} linked tasks done this week</div>}
                <input className="input bare small" placeholder="Remark on this objective…" value={g.remark || ''} onChange={(e) => update('weeklyGoals', g.id, { remark: e.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
      <form onSubmit={submit} className="quick-add mt-2">
        <input className="input" placeholder="New objective, e.g. Finish chapter 3 of PostgreSQL" value={title} onChange={(e) => setTitle(e.target.value)} />
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label}</option>)}
        </select>
        <input className="input full" placeholder="Why does it matter? (niyyah)" value={why} onChange={(e) => setWhy(e.target.value)} />
        <button className="btn primary full"><Plus size={16} /> Add objective</button>
      </form>
    </div>
  );
}

function Board({ week }) {
  const { tasks, add, update, routines, settings } = useData();
  const ws = settings.weekStartsOn ?? 1;
  // Future occurrences of routines, shown faded until their day comes.
  const ghostsFor = (d) => (d <= today ? [] : routines.filter((r) => r.active)
    .map((r) => ({ r, inst: instanceCovering(r, d, ws) }))
    .filter(({ inst }) => inst && !inst.scope && !tasks.some((t) => t.instanceKey === inst.key)));
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [drafts, setDrafts] = useState({});
  const days = weekDays(week);
  const today = todayStr();

  const quickAdd = async (date) => {
    const title = (drafts[date] || '').trim();
    if (!title) return;
    await add('tasks', { title, firstAction: '', category: 'growth', anchor: 'any', date, status: 'todo', started: false, main: false });
    setDrafts({ ...drafts, [date]: '' });
  };

  return (
    <div className="week-board">
      {days.map((d) => {
        const list = tasks.filter((t) => onDay(t, d) && t.scope !== 'week').sort((a, b) => (b.main - a.main) || ((a.status === 'done') - (b.status === 'done')));
        const done = list.filter((t) => t.status === 'done').length;
        return (
          <div key={d} className={cx('day-col', d === today && 'today', over === d && 'drop')}
            onDragOver={(e) => { e.preventDefault(); setOver(d); }}
            onDragLeave={() => setOver(null)}
            onDrop={() => { if (drag) update('tasks', drag, { date: d }); setDrag(null); setOver(null); }}>
            <div className="row between">
              <div>
                <div className="day-name">{parseDate(d).toLocaleDateString('en-GB', { weekday: 'long' })}</div>
                <div className="day-date">{parseDate(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
              </div>
              {list.length > 0 && <span className="badge">{done}/{list.length}</span>}
            </div>
            {list.map((t) => (
              <div key={t.id} className={cx('mini-task', t.status === 'done' && 'done')} draggable={!t.routineId} onDragStart={() => setDrag(t.id)}>
                <button className={cx('check', t.status === 'done' && 'on', t.status === 'notdone' && 'bad', t.status === 'partial' && 'partial')}
                  onClick={() => update('tasks', t.id, { status: t.status === 'done' ? 'todo' : 'done' })}>
                  {t.status === 'notdone' ? '✗' : t.status === 'partial' ? '~' : '✓'}
                </button>
                <span className="t grow">{t.main && '★ '}{t.routineId && <Repeat size={11} style={{ verticalAlign: -1, opacity: 0.6 }} />} {t.time && <span className="muted">{t.time} </span>}{t.title}</span>
                <span className="dot" style={{ background: CATEGORIES[t.category]?.color, marginTop: 6 }} />
              </div>
            ))}
            {ghostsFor(d).map(({ r }) => (
              <div key={r.id} className="mini-task ghost" title="Routine — will appear automatically on this day">
                <Repeat size={12} style={{ marginTop: 3, flexShrink: 0 }} />
                <span className="t grow">{r.time && `${r.time} `}{r.title}</span>
              </div>
            ))}
            <input className="input bare small" style={{ marginTop: 'auto' }} placeholder="+ add"
              value={drafts[d] || ''} onChange={(e) => setDrafts({ ...drafts, [d]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && quickAdd(d)} />
          </div>
        );
      })}
    </div>
  );
}

function WeekNote({ week }) {
  const { reviews, setEntry } = useData();
  const key = `week-${week}`;
  const r = reviews[key] || {};
  return (
    <div className="card">
      <div className="card-head"><h2><NotebookPen size={18} /> Weekly reflection</h2></div>
      <div className="grid g-3" style={{ gap: 10 }}>
        <label className="field">What went well?
          <textarea className="textarea" value={r.well || ''} onChange={(e) => setEntry('reviews', key, { well: e.target.value })} />
        </label>
        <label className="field">What made starting difficult?
          <textarea className="textarea" value={r.hard || ''} onChange={(e) => setEntry('reviews', key, { hard: e.target.value })} />
        </label>
        <label className="field">One change for next week
          <textarea className="textarea" value={r.change || ''} onChange={(e) => setEntry('reviews', key, { change: e.target.value })} />
        </label>
      </div>
    </div>
  );
}

export default function Week() {
  const { settings, tasks } = useData();
  const ws = settings.weekStartsOn ?? 1;
  const [week, setWeek] = useState(weekStartOf(todayStr(), ws));
  const days = weekDays(week);
  const weekTasks = tasks.filter((t) => days.includes(t.date));
  const done = weekTasks.filter((t) => t.status === 'done').length;
  const isThis = week === weekStartOf(todayStr(), ws);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Week</h1>
          <div className="sub">{fmtDate(days[0], { day: 'numeric', month: 'long' })} – {fmtDate(days[6], { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="row">
          <span className="small muted">{done}/{weekTasks.length} tasks done</span>
          <div style={{ width: 120 }}><Progress value={weekTasks.length ? (done / weekTasks.length) * 100 : 0} /></div>
          <button className="icon-btn" onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={18} /></button>
          <button className="btn sm" disabled={isThis} onClick={() => setWeek(weekStartOf(todayStr(), ws))}>This week</button>
          <button className="icon-btn" onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={18} /></button>
        </div>
      </div>
      <div className="stack">
        <Goals week={week} />
        <WeekliesCard list={tasks.filter((t) => t.scope === 'week' && t.date === week)} />
        <div>
          <div className="row between" style={{ marginBottom: 10 }}>
            <h2>Plan the days</h2>
            <span className="small muted">Drag tasks between days · Enter to add</span>
          </div>
          <Board week={week} />
        </div>
        <WeekNote week={week} />
      </div>
    </>
  );
}
