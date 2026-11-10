import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardCheck, Moon, HeartHandshake, ArrowRightCircle, ListChecks } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { PrayerTracker } from '../components/Prayer.jsx';
import { CatChip, Empty, Ring } from '../components/ui.jsx';
import { addDays, cx, endDate, fmtDate, lastNDays, nextStep, onDay, parseDate, todayStr } from '../lib/utils.js';
import { AVOID_REASONS, TASK_STATUS } from '../lib/constants.js';
import { api } from '../lib/api.js';
import { Link } from 'react-router-dom';
import { Wallet } from 'lucide-react';
import { useMoney } from './Money.jsx';
import { useTaskActions } from '../components/Tasks.jsx';
import { describeUnits, fmtHizb, surahLabel, takeUnits } from '../lib/quran.js';
import { DueBar, RevisionPicker } from '../components/QuranPicker.jsx';
import { useQuran } from '../state/useQuran.js';

const MOODS = ['😞', '😕', '😐', '🙂', '😄'];
const ENERGY = ['🪫', '😴', '🙂', '⚡', '🔥'];

function Verify({ date }) {
  const { tasks, update } = useData();
  const actions = useTaskActions();
  const quran = useQuran();
  const [picking, setPicking] = useState(null); // Qur'an tier being picked
  // Week-long routines are verified on their last day; everything else on each day it covers.
  const list = tasks.filter((t) => (t.scope === 'week' ? endDate(t) === date : onDay(t, date)));
  const counts = { done: 0, partial: 0, notdone: 0, todo: 0 };
  list.forEach((t) => counts[t.status || 'todo']++);
  const verified = list.length - counts.todo;
  const score = list.length ? (counts.done + counts.partial * 0.5) / list.length : 0;
  const [carried, setCarried] = useState(false);

  // ✓ here means "done on its day" (it counts for that day, not for today).
  // Not done on its day? Mark ✗ and carry it — that one task — to the next day.
  const setStatus = async (t, s) => {
    if (actions.isTier(t) && s === 'partial') return setPicking(t.quranTier);
    actions.setStatus(t, t.status === s ? 'todo' : s);
  };
  const next = addDays(date, 1);
  const nextLabel = next === todayStr() ? 'today' : next === addDays(todayStr(), 1) ? 'tomorrow' : 'next day';
  const canCarry = (t) => t.scope !== 'week' && t.status !== 'done' && !t.carriedTo && !actions.isTier(t);

  const carryAll = async () => {
    // Routines come back on their own; the bulk button carries one-off tasks only.
    for (const t of list.filter((x) => !x.routineId && canCarry(x))) await actions.carry(t, next);
    setCarried(true);
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2><ListChecks size={18} /> Verify the day</h2>
        <div className="row">
          <span className="chip good">✓ {counts.done}</span>
          <span className="chip warn">~ {counts.partial}</span>
          <span className="chip bad">✗ {counts.notdone}</span>
          <Ring value={score} size={44} stroke={5}>{Math.round(score * 100)}</Ring>
        </div>
      </div>
      {list.length === 0 ? <Empty>No tasks were planned for this day.</Empty> : (
        <div className="stack" style={{ gap: 8 }}>
          {list.map((t) => (
            <div key={t.id} className="verify-row">
              <div className="grow">
                <div className="row wrap" style={{ gap: 8 }}>
                  <b>{t.main && <span style={{ color: 'var(--gold)' }}>★ </span>}{t.title}</b>
                  <CatChip cat={t.category} />
                  {t.focusMinutes > 0 && <span className="chip">{Math.round(t.focusMinutes)} min</span>}
                  {t.carriedTo && <button className="chip on click" title="Undo the carry" onClick={() => actions.uncarry(t)}>→ carried to {nextLabel} ✕</button>}
                  {t.carriedFrom && t.forDate && <span className="chip warn">↪ carried from {fmtDate(t.forDate)}</span>}
                </div>
                {t.steps?.length > 1
                  ? <div className="small muted">{t.steps.filter((s) => s.done).length}/{t.steps.length} steps{nextStep(t) && <> · next: {nextStep(t)}</>}</div>
                  : nextStep(t) && <div className="small muted">{nextStep(t)}</div>}
                {t.target > 1 && <div className="small muted">{t.count || 0}/{t.target} times this week</div>}
                {actions.isTier(t) && (() => {
                  const p = quran.plan(t.quranTier, t.date);
                  const left = takeUnits(quran.q, t.quranTier, p.left).units;
                  return (
                    <div className="small muted">
                      <div className="quran-due"><DueBar p={p} /><span className="tiny">{fmtHizb(p.done)} of {fmtHizb(p.total)} hizb{p.debt > 0 && ` (incl. ${fmtHizb(p.debt)} debt)`}</span></div>
                      {left.length > 0 && <>✓ records the rest: <b>{fmtHizb(left.length)} hizb</b> · {describeUnits(left)} · <span className="ar">{surahLabel(left)}</span> — or ~ to say how much</>}
                    </div>
                  );
                })()}
                {t.autoMissed && <div className="tiny muted">Routine — the app wasn’t opened that day, so it was recorded as missed. Correct it if you did it.</div>}
              </div>
              <div className="verdict">
                {canCarry(t) && (
                  <button className="carry" title={`Not done on its day? Carry this task to ${nextLabel}`} onClick={() => actions.carry(t, next)}>
                    <ArrowRightCircle size={15} />
                  </button>
                )}
                {['done', 'partial', 'notdone'].map((s) => (
                  <button key={s} className={cx(TASK_STATUS[s].cls, t.status === s && 'on')} title={TASK_STATUS[s].label} onClick={() => setStatus(t, s)}>
                    {TASK_STATUS[s].icon}
                  </button>
                ))}
              </div>
              <input className="input remark small" placeholder={t.status === 'notdone' ? 'What got in the way? What will you do differently?' : 'Remark…'}
                value={t.remark || ''} onChange={(e) => update('tasks', t.id, { remark: e.target.value })} />
            </div>
          ))}
          {picking && <RevisionPicker tier={picking} day={date} open onClose={() => setPicking(null)} />}
          <div className="row between mt-1">
            <span className="small muted">{verified}/{list.length} verified</span>
            <button className="btn sm" disabled={carried} onClick={carryAll}><ArrowRightCircle size={15} /> {carried ? 'Carried over' : `Carry unfinished one-offs to ${nextLabel}`}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Questions({ date }) {
  const { reviews, setEntry, avoidances, add, transactions } = useData();
  const { fmt } = useMoney();
  const spentToday = transactions.filter((t) => t.date === date && t.type === 'expense').reduce((n, t) => n + t.amount, 0);
  const r = reviews[date] || {};
  const set = (k) => (e) => setEntry('reviews', date, { [k]: e.target.value });
  const [made, setMade] = useState(false);
  const todaysAvoid = avoidances.filter((a) => a.date === date);

  const makeTask = async () => {
    if (!r.tomorrow?.trim()) return;
    await add('tasks', { title: r.tomorrow.trim(), firstAction: r.tomorrow.trim(), category: 'growth', anchor: 'fajr', date: addDays(date, 1), status: 'todo', started: false, main: true });
    setMade(true);
  };

  return (
    <div className="card">
      <div className="card-head"><h2><HeartHandshake size={18} /> Muhasabah</h2><span className="small muted">Learn from the day — not punishment.</span></div>
      <div className="stack" style={{ gap: 14 }}>
        <div className="grid g-2" style={{ gap: 12 }}>
          <label className="field">Mood
            <div className="scale">{MOODS.map((m, i) => <button key={i} type="button" className={cx(r.mood === i + 1 && 'on')} onClick={() => setEntry('reviews', date, { mood: i + 1 })}>{m}</button>)}</div>
          </label>
          <label className="field">Energy
            <div className="scale">{ENERGY.map((m, i) => <button key={i} type="button" className={cx(r.energy === i + 1 && 'on')} onClick={() => setEntry('reviews', date, { energy: i + 1 })}>{m}</button>)}</div>
          </label>
        </div>
        <label className="field">Did I fulfil my obligations as best I could?
          <textarea className="textarea" style={{ minHeight: 60 }} value={r.obligations || ''} onChange={set('obligations')} />
        </label>
        <label className="field">What important thing did I actually begin or complete today?
          <textarea className="textarea" style={{ minHeight: 60 }} value={r.started || ''} onChange={set('started')} />
        </label>
        <label className="field">When did I avoid something, and what was behind it?
          {todaysAvoid.length > 0 && (
            <div className="row wrap">{todaysAvoid.map((a) => <span key={a.id} className="chip gold">{a.task}: {AVOID_REASONS[a.reason]?.label || '—'}</span>)}</div>
          )}
          <textarea className="textarea" style={{ minHeight: 60 }} value={r.avoided || ''} onChange={set('avoided')} />
        </label>
        <Link to="/money" className="hint-link"><Wallet size={14} /> Money {date === todayStr() ? 'today' : 'that day'}: spent <b>{fmt(spentToday)}</b> — anything not logged yet?</Link>
        <label className="field">One thing I’m grateful for (shukr)
          <input className="input" value={r.gratitude || ''} onChange={set('gratitude')} />
        </label>
        <label className="field">The first concrete action I’ll take tomorrow
          <div className="row">
            <input className="input" value={r.tomorrow || ''} onChange={set('tomorrow')} placeholder='e.g. "After Fajr, open my C++ project and write the next test"' />
            <button className="btn primary" type="button" disabled={made || !r.tomorrow} onClick={makeTask}>{made ? 'Added ★' : '★ Plan it'}</button>
          </div>
        </label>
        <label className="field">Free notes
          <textarea className="textarea" value={r.notes || ''} onChange={set('notes')} />
        </label>
      </div>
    </div>
  );
}

export default function Review() {
  const { reviews, tasks, settings } = useData();
  const prayer = usePrayer();
  const [date, setDate] = useState(todayStr());
  const [timings, setTimings] = useState(null);
  const strip = useMemo(() => lastNDays(14), []);

  useEffect(() => {
    if (date === prayer.date) return setTimings(prayer.day?.timings);
    if (!settings.location) return;
    api.get(`/api/prayer/day?date=${date}`).then((r) => setTimings(r.day?.timings)).catch(() => setTimings(null));
  }, [date, prayer.date, prayer.day, settings.location]);

  const reviewed = (d) => {
    const r = reviews[d];
    return r && (r.started || r.obligations || r.tomorrow || r.mood);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Review</h1>
          <div className="sub">{fmtDate(date)} — verify what was done, add remarks, set tomorrow’s first step.</div>
        </div>
        <div className="row">
          <button className="icon-btn" onClick={() => setDate(addDays(date, -1))}><ChevronLeft size={18} /></button>
          <input className="input" type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} style={{ width: 160 }} />
          <button className="icon-btn" disabled={date >= todayStr()} onClick={() => setDate(addDays(date, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="day-strip" style={{ marginBottom: 18 }}>
        {strip.map((d) => {
          const n = tasks.filter((t) => onDay(t, d)).length;
          return (
            <div key={d} className={cx('day-pill', d === date && 'on')} onClick={() => setDate(d)}>
              {parseDate(d).toLocaleDateString('en-GB', { weekday: 'short' })}
              <b>{Number(d.slice(8))}</b>
              <span className="dot" style={{ background: reviewed(d) ? 'var(--accent)' : n ? 'var(--surface-3)' : 'transparent' }} title={reviewed(d) ? 'Reviewed' : ''} />
            </div>
          );
        })}
      </div>

      <div className="grid g-main">
        <div className="stack">
          <Verify key={date} date={date} />
          <div className="card">
            <div className="card-head"><h2><Moon size={18} /> Salah of the day</h2><span className="small muted">Click to cycle · right-click for all choices</span></div>
            <PrayerTracker date={date} timings={timings} />
          </div>
        </div>
        <Questions key={date} date={date} />
      </div>
    </>
  );
}
