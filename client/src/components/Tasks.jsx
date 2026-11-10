import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Footprints, Pencil, Play, Plus, Star, Trash2, CalendarArrowUp, X, ChevronDown, Repeat, Clock, Flame, SlidersHorizontal } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { ANCHORS, ANCHOR_KEYS, CATEGORIES, CATEGORY_KEYS, WD } from '../lib/constants.js';
import { addDays, cx, doneStamp, endDate, nextStep, parseDate, routineStreak, todayStr } from '../lib/utils.js';
import { CatChip, Modal } from './ui.jsx';
import { useQuran } from '../state/useQuran.js';
import { describeUnits, fmtHizb, hifzNext, positionLabel, surahLabel, takeUnits } from '../lib/quran.js';
import { DueBar, RevisionPicker } from './QuranPicker.jsx';

// Ordered list of steps. Step 1 is the first physical action; Enter adds a
// step, Backspace on an empty one removes it.
export function StepsEditor({ steps, onChange }) {
  const refs = useRef([]);
  const focusIdx = useRef(null);
  useEffect(() => {
    if (focusIdx.current != null) refs.current[focusIdx.current]?.focus();
    focusIdx.current = null;
  }, [steps.length]);

  const set = (i, v) => onChange(steps.map((s, j) => (j === i ? v : s)));
  const add = (at = steps.length) => { focusIdx.current = at; onChange([...steps.slice(0, at), '', ...steps.slice(at)]); };
  const del = (i) => { focusIdx.current = Math.max(0, i - 1); onChange(steps.filter((_, j) => j !== i)); };
  const count = steps.filter((s) => s.trim()).length;

  return (
    <div className="steps-editor full">
      {steps.map((s, i) => (
        <div key={i} className="step-input">
          <span className={cx('step-n', i === 0 && 'first')}>{i === 0 ? <Footprints size={13} /> : i + 1}</span>
          <input ref={(el) => (refs.current[i] = el)} className="input" value={s}
            placeholder={i === 0 ? 'First physical action — e.g. "open my notes and explain one index type"' : 'Next step…'}
            onChange={(e) => set(i, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); add(i + 1); }
              if (e.key === 'Backspace' && !s && steps.length > 1) { e.preventDefault(); del(i); }
            }} />
          {steps.length > 1 && <button type="button" className="icon-btn" onClick={() => del(i)} title="Remove step"><X size={14} /></button>}
        </div>
      ))}
      <div className="row between wrap">
        <button type="button" className="btn ghost sm" onClick={() => add()}><Plus size={14} /> Add step</button>
        {count > 7
          ? <span className="tiny" style={{ color: 'var(--warn)' }}>That’s a lot of steps — maybe this is a weekly objective, not a task.</span>
          : <span className="tiny muted">Only the next unchecked step is shown on the task — one thing at a time.</span>}
      </div>
    </div>
  );
}

// Keep the done-state of steps whose text didn't change.
export function mergeSteps(texts, old = []) {
  const pool = [...old];
  return texts.map((s) => s.trim()).filter(Boolean).map((text) => {
    const i = pool.findIndex((o) => o.text === text);
    const prev = i >= 0 ? pool.splice(i, 1)[0] : null;
    return prev || { id: crypto.randomUUID(), text, done: false };
  });
}

const initialSteps = (t) => (t?.steps?.length ? t.steps.map((s) => s.text) : [t?.firstAction || '']);
const blank = (date) => ({ title: '', category: 'growth', anchor: 'any', time: '', date, goalId: '' });

export function TaskForm({ date, initial, onDone, compact, goals = [] }) {
  const { add, update } = useData();
  const [f, setF] = useState(initial || blank(date));
  const [steps, setSteps] = useState(initialSteps(initial));
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!f.title.trim()) return;
    const merged = mergeSteps(steps, initial?.steps);
    const data = { ...f, title: f.title.trim(), steps: merged, firstAction: merged[0]?.text || '' };
    if (initial?.id) {
      const allDone = merged.length > 0 && merged.every((s) => s.done);
      update('tasks', initial.id, { ...data, ...(allDone && initial.status === 'todo' ? { status: 'done', doneAt: doneStamp(initial) } : {}) });
    } else {
      await add('tasks', { ...data, status: 'todo', started: false, main: false });
      setF(blank(f.date));
      setSteps(['']);
    }
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="quick-add">
      <input className="input full" placeholder="What do you intend to do?" value={f.title} onChange={set('title')} autoFocus={!compact} />
      <StepsEditor steps={steps} onChange={setSteps} />
      <select className="select" value={f.category} onChange={set('category')}>
        {CATEGORY_KEYS.map((k) => <option key={k} value={k}>{CATEGORIES[k].label} — {CATEGORIES[k].long}</option>)}
      </select>
      <div className="row">
        <select className="select" value={f.anchor} onChange={set('anchor')}>
          {ANCHOR_KEYS.map((k) => <option key={k} value={k}>{ANCHORS[k].label}</option>)}
        </select>
        <input className="input" type="time" title="Optional exact time (also triggers a reminder)" style={{ width: 130 }} value={f.time || ''} onChange={set('time')} />
      </div>
      {!compact && !initial?.routineId && (
        <input className="input" type="date" value={f.date} onChange={set('date')} />
      )}
      {!compact && goals.length > 0 && (
        <select className="select" value={f.goalId || ''} onChange={set('goalId')}>
          <option value="">No weekly objective</option>
          {goals.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
      )}
      <button className="btn primary full" type="submit"><Plus size={16} /> {initial?.id ? 'Save changes' : 'Add task'}</button>
      {initial?.routineId && <p className="tiny muted full">This is one occurrence of a routine — edit the routine itself on the Routines page to change every day.</p>}
    </form>
  );
}

// Ticking a task means "I did it on its day": the completion counts for the
// task's own date. A Qur'an tier task records its revision for that day (all of
// what's due, or the amount picked in the revision picker). Shared by Today and
// Review so both behave the same.
export function useTaskActions() {
  const { update, add, remove } = useData();
  const quran = useQuran();
  const today = todayStr();
  const dayOf = (t) => (today < t.date ? t.date : today > endDate(t) ? endDate(t) : today);
  const isTier = (t) => t.quranTier && t.quranTier < 4;

  // Returns 'picker' for a partial Qur'an revision: the caller asks how much.
  const setStatus = async (t, status) => {
    if (isTier(t)) {
      if (status === 'partial') return 'picker';
      const p = quran.plan(t.quranTier, t.date);
      const r = await quran.setRevised(t.quranTier, t.date, status === 'done' ? Math.max(p.done, p.total) : 0);
      if (r.ok && status === 'notdone') update('tasks', t.id, { status });
      return r.ok;
    }
    update('tasks', t.id, { status, doneAt: status === 'done' ? doneStamp(t) : t.doneAt, ...(status === 'done' && { started: true }) });
    return true;
  };

  // Carry this one task to another day (the original stays as not done).
  // Qur'an tiers don't carry: what's left becomes debt on its own.
  const carry = async (t, date) => {
    const copy = await add('tasks', {
      title: t.title, firstAction: t.firstAction, steps: (t.steps || []).filter((s) => !s.done), category: t.category,
      anchor: t.until ? t.untilAnchor || t.anchor : t.anchor, time: t.time, goalId: t.goalId, points: t.points,
      date, status: 'todo', started: false, main: false, carriedFrom: t.id, forDate: t.forDate || t.date,
    });
    update('tasks', t.id, { carriedTo: copy.id, status: t.status === 'todo' ? 'notdone' : t.status });
    return copy;
  };
  const uncarry = (t) => {
    remove('tasks', t.carriedTo);
    update('tasks', t.id, { carriedTo: null });
  };

  return { setStatus, carry, uncarry, dayOf, isTier };
}

const untilLabel = (t) => {
  if (!t.until) return null;
  const day = WD[parseDate(t.until).getDay()];
  const p = t.untilAnchor && t.untilAnchor !== 'any' ? ANCHORS[t.untilAnchor].prayer : 'end of day';
  return `until ${day} ${p}`;
};

export function TaskItem({ task, showDate, onFocus, compact }) {
  const { update, remove, tasks, weeklyGoals } = useData();
  const nav = useNavigate();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(false);
  const today = todayStr();
  const done = task.status === 'done';
  const goal = task.goalId && weeklyGoals.find((g) => g.id === task.goalId);
  const overdue = endDate(task) < today && task.status === 'todo';
  const steps = task.steps || [];
  const stepsDone = steps.filter((s) => s.done).length;
  const next = nextStep(task);
  const target = task.target || 1;
  const streak = task.routineId ? routineStreak(tasks, task.routineId, today) : 0;
  const quran = useQuran();
  const actions = useTaskActions();
  const tier = task.quranTier;
  const [picking, setPicking] = useState(false);
  // Qur'an tier tasks show what's still due today (debt first), from the pointer.
  const qPlan = tier && tier < 4 ? quran.plan(tier, task.date) : null;
  const qLeft = qPlan?.left ? takeUnits(quran.q, tier, qPlan.left).units : [];
  const qHifz = tier === 4 ? hifzNext(quran.q) : null;

  const toggle = () => {
    if ((target > 1 || tier === 4) && !done) return bump(1);
    if (tier === 4 && done) return bump(-1);
    actions.setStatus(task, done ? 'todo' : 'done');
  };
  const bump = async (n) => {
    const count = Math.max(0, Math.min(target, (task.count || 0) + n));
    const patch = { count, started: true, status: count >= target ? 'done' : 'todo', ...(count >= target && { doneAt: doneStamp(task) }) };
    if (tier === 4) {
      const snaps = [...(task.quranSnaps || [])];
      if (n > 0) {
        const snap = await quran.memorize(undefined, actions.dayOf(task));
        if (!snap?.logId) return; // a double click, or another tab changed the Qur'an data
        snaps.push(snap);
      } else quran.undo(snaps.pop());
      patch.quranSnaps = snaps;
    }
    update('tasks', task.id, patch);
  };
  const toggleStep = (id) => {
    const nextSteps = steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s));
    const all = nextSteps.every((s) => s.done);
    update('tasks', task.id, {
      steps: nextSteps, started: true,
      ...(all ? { status: 'done', doneAt: doneStamp(task) } : done ? { status: 'todo' } : {}),
    });
  };
  const toggleMain = () => {
    // Only one main task per day.
    if (!task.main) tasks.filter((t) => t.date === task.date && t.main).forEach((t) => update('tasks', t.id, { main: false }));
    update('tasks', task.id, { main: !task.main });
  };
  const focus = () => (onFocus ? onFocus(task) : nav(`/focus?task=${task.id}`));

  return (
    <>
      <div className={cx('task', done && 'done', task.main && 'main-task')}>
        <span className="cat-bar" style={{ background: CATEGORIES[task.category]?.color }} />
        <button className={cx('check', done && 'on', task.status === 'partial' && 'partial', task.status === 'notdone' && 'bad')} onClick={toggle}
          aria-label="Toggle done" title={qPlan && !done ? `Revised all ${fmtHizb(qPlan.left)} hizb` : target > 1 && !done ? 'Count one more' : 'Done'}>
          {task.status === 'partial' ? '~' : task.status === 'notdone' ? '✗' : target > 1 && !done ? <Plus size={13} strokeWidth={3} /> : <Check size={14} strokeWidth={3} />}
        </button>
        <div className="grow">
          <div className="title">{task.title}</div>
          {qPlan && qLeft.length > 0 && (
            <div className="first quran-portion">
              <b>{fmtHizb(qLeft.length)} hizb</b> · {describeUnits(qLeft)} · <span className="ar">{surahLabel(qLeft)}</span>
            </div>
          )}
          {qPlan && (qPlan.debt > 0 || qPlan.done > 0) && (
            <div className="quran-due">
              <DueBar p={qPlan} />
              <span className="tiny muted">
                {qPlan.done > 0 && <>{fmtHizb(qPlan.done)} revised · </>}
                {qPlan.debtLeft > 0 && <span style={{ color: 'var(--warn)' }}>debt {fmtHizb(qPlan.debtLeft)} · </span>}
                {qPlan.daily > 0 && <>today's share {fmtHizb(qPlan.daily)}{qPlan.done >= qPlan.daily && ' ✓'}</>}
              </span>
            </div>
          )}
          {tier === 4 && !done && qHifz != null && <div className="first"><Footprints size={13} /> Next to memorize: {positionLabel(qHifz)} · <span className="ar">{surahLabel([qHifz])}</span></div>}
          {!tier && !done && next && <div className="first"><Footprints size={13} /> {next}</div>}
          <div className="meta">
            {task.carriedFrom && task.forDate && <span className="chip warn" title="Carried over from a previous day">↪ from {WD[parseDate(task.forDate).getDay()]}</span>}
            {task.time && <span className="chip"><Clock size={11} /> {task.time}</span>}
            {task.routineId && !compact && <span className="chip on" title="Routine — appears automatically"><Repeat size={11} /> {task.scope === 'week' ? 'weekly' : task.until ? 'weekly' : 'daily'}</span>}
            {streak > 0 && <span className="chip gold" title="Streak"><Flame size={11} /> {streak}</span>}
            {target > 1 && <span className={cx('chip', done && 'good')}>{task.count || 0}/{target} this week</span>}
            {task.until && !(compact && task.scope === 'week') && <span className="chip warn">{untilLabel(task)}</span>}
            {steps.length > 1 && (
              <button className="chip click" onClick={() => setOpen(!open)}>
                {stepsDone}/{steps.length} steps <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
              </button>
            )}
            {!compact && <CatChip cat={task.category} />}
            {showDate && <span className={cx('chip', overdue && 'bad')}>{task.date}</span>}
            {task.started && !done && stepsDone === 0 && <span className="chip on">Started</span>}
            {task.focusMinutes > 0 && <span className="chip">{Math.round(task.focusMinutes)} min focused</span>}
            {goal && <span className="chip gold">◎ {goal.title}</span>}
            {task.remark && <span className="chip" title={task.remark}>💬 remark</span>}
          </div>
          {open && steps.length > 1 && (
            <div className="step-list">
              {steps.map((s) => (
                <div key={s.id} className={cx('step-line', s.done && 'done')} onClick={() => toggleStep(s.id)}>
                  <span className={cx('check sm', s.done && 'on')}><Check size={11} strokeWidth={3} /></span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="actions">
          {qPlan && <button className="icon-btn" title="How much did you revise?" onClick={() => setPicking(true)}><SlidersHorizontal size={15} /></button>}
          {!done && <button className="icon-btn" title="Start a 5-minute focus" onClick={focus}><Play size={16} /></button>}
          {steps.length === 1 && !done && next && (
            <button className="icon-btn" title="Mark the step done" onClick={() => toggleStep(steps[0].id)}><Check size={15} /></button>
          )}
          {target > 1 && (task.count || 0) > 0 && <button className="icon-btn" title="Undo one" onClick={() => bump(-1)}>−1</button>}
          {!compact && (
            <button className={cx('icon-btn', task.main && 'on')} title="Make this the main task of the day" onClick={toggleMain}>
              <Star size={16} fill={task.main ? 'currentColor' : 'none'} />
            </button>
          )}
          {overdue && !task.routineId && <button className="icon-btn" title="Move to today" onClick={() => update('tasks', task.id, { date: today })}><CalendarArrowUp size={16} /></button>}
          {!overdue && !done && !task.routineId && <button className="icon-btn" title="Postpone to tomorrow" onClick={() => update('tasks', task.id, { date: addDays(task.date, 1), main: false })}>⤳</button>}
          <button className="icon-btn" title="Edit" onClick={() => setEditing(true)}><Pencil size={15} /></button>
          <button className="icon-btn" title={task.routineId ? 'Remove this occurrence' : 'Delete'} onClick={() => remove('tasks', task.id)}><Trash2 size={15} /></button>
        </div>
      </div>
      {qPlan && <RevisionPicker tier={tier} day={task.date} open={picking} onClose={() => setPicking(false)} />}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit task">
        <TaskForm initial={task} date={task.date} onDone={() => setEditing(false)} goals={weeklyGoals} />
      </Modal>
    </>
  );
}
