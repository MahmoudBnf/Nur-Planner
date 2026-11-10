import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pause, Play, Square, LifeBuoy, History, Coffee, CheckCircle2, RotateCcw, PhoneOff } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { useFocus } from '../state/FocusContext.jsx';
import { AVOID_REASONS } from '../lib/constants.js';
import { cx, doneStamp, fmtTimer, nextStep, onDay, todayStr } from '../lib/utils.js';
import { Empty, Modal } from '../components/ui.jsx';

const PRESETS = [5, 10, 25, 45];

function TimerRing({ remaining, total }) {
  const size = 280, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const frac = total ? remaining / total : 1;
  return (
    <div className="ring-wrap">
      <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`}>
        <defs>
          <linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" /><stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="url(#ringGrad)" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 0.25s linear' }} />
      </svg>
      <div className="ring-center">
        <div>
          <div className="ring-time">{fmtTimer(remaining)}</div>
          <div className="small muted">{total ? 'remaining' : 'ready'}</div>
        </div>
      </div>
    </div>
  );
}

// Shown app-wide when a session ends: step 5 — "decide what comes next".
export function FinishedModal() {
  const { finished, clearFinished, start } = useFocus();
  const { tasks, update, newThings } = useData();
  const nav = useNavigate();
  if (!finished) return null;
  const task = finished.taskId && tasks.find((t) => t.id === finished.taskId);
  const thing = finished.newThingId && newThings.find((t) => t.id === finished.newThingId);
  const again = (m) => { clearFinished(); start({ ...finished, minutes: m }); };

  return (
    <Modal open onClose={clearFinished} title={finished.stoppedEarly ? 'Session stopped' : 'You started — that was the hard part 🌱'}>
      <p className="text-2">{finished.label}</p>
      <p className="muted small mt-1">Decide deliberately what comes next — not automatically reaching for the phone.</p>
      <div className="grid g-2 mt-3" style={{ gap: 8 }}>
        <button className="btn primary" onClick={() => again(5)}><RotateCcw size={16} /> 5 more minutes</button>
        <button className="btn" onClick={() => again(25)}><Play size={16} /> Continue 25 min</button>
        {task && task.status !== 'done' && (
          <button className="btn" onClick={() => { update('tasks', task.id, { status: 'done', doneAt: doneStamp(task) }); clearFinished(); }}>
            <CheckCircle2 size={16} /> Mark task done
          </button>
        )}
        {thing && (
          <button className="btn" onClick={() => { clearFinished(); nav('/explore'); }}>Give it a verdict</button>
        )}
        <button className="btn" onClick={() => { clearFinished(); }}><Coffee size={16} /> Take a real break</button>
      </div>
    </Modal>
  );
}

function Rescue({ todays, onStart }) {
  const { add } = useData();
  const [step, setStep] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [reason, setReason] = useState('');
  const [phoneAway, setPhoneAway] = useState(false);
  const task = todays.find((t) => t.id === taskId);

  const reset = () => { setStep(0); setReason(''); setPhoneAway(false); setTaskId(''); };
  const log = (outcome) => add('avoidances', { date: todayStr(), taskId: taskId || null, task: task?.title || 'Something', reason, outcome });

  const go = () => {
    log('started');
    onStart({ minutes: 5, label: task ? nextStep(task) || task.title : 'Five minutes on what I was avoiding', taskId: taskId || null, kind: 'rescue' });
    reset();
  };
  const rest = () => { log('rest'); reset(); };

  const Step = ({ n, title, children }) => (
    <div className={cx('step', step === n && 'active', step > n && 'done')}>
      <div className="step-num">{n + 1}</div>
      <div className="grow">
        <b>{title}</b>
        {step === n && <div className="mt-1">{children}</div>}
      </div>
    </div>
  );

  return (
    <div className="card">
      <div className="card-head"><h2><LifeBuoy size={18} /> I’m avoiding something</h2>{step > 0 && <button className="btn ghost sm" onClick={reset}>Reset</button>}</div>
      <p className="small muted" style={{ marginBottom: 12 }}>Don’t spend the next 30 minutes feeling guilty about the last 30. Restart now.</p>
      <div className="steps">
        <Step n={0} title="Notice: “I’m avoiding the thing I intended to do.”">
          <select className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">Something not in my list</option>
            {todays.filter((t) => t.status === 'todo').map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
          <button className="btn primary sm mt-2" onClick={() => setStep(1)}>I noticed it</button>
        </Step>
        <Step n={1} title="Name the reason — without judging yourself">
          <div className="reason-grid">
            {Object.entries(AVOID_REASONS).map(([k, r]) => (
              <button key={k} className={cx('reason', reason === k && 'on')} onClick={() => setReason(k)}>
                <b>{r.label}</b><span>{r.feel}</span>
              </button>
            ))}
          </div>
          {reason && (
            <>
              <div className="fix mt-2 small"><b>What helps:</b> {AVOID_REASONS[reason].fix}</div>
              <div className="row mt-2">
                {reason === 'exhausted'
                  ? <><button className="btn sm" onClick={rest}>I’ll rest properly</button><button className="btn primary sm" onClick={() => setStep(2)}>Still try 5 min</button></>
                  : <button className="btn primary sm" onClick={() => setStep(2)}>Next</button>}
              </div>
            </>
          )}
        </Step>
        <Step n={2} title="Remove the immediate distraction">
          <div className="row" style={{ cursor: 'pointer' }} onClick={() => setPhoneAway(!phoneAway)}>
            <span className={cx('check', phoneAway && 'on')}>✓</span>
            <span className="small"><PhoneOff size={14} style={{ verticalAlign: -2 }} /> Phone is in another room / face down, distracting tabs closed</span>
          </div>
          <button className="btn primary sm mt-2" disabled={!phoneAway} onClick={() => setStep(3)}>Done</button>
        </Step>
        <Step n={3} title="Do the smallest meaningful action for 5 minutes">
          {task && nextStep(task) && <p className="small text-2">Next step: <b>{nextStep(task)}</b></p>}
          <button className="btn gold mt-1" onClick={go}><Play size={16} /> Start 5 minutes</button>
        </Step>
        <Step n={4} title="Decide what to do next (after the timer)" />
      </div>
    </div>
  );
}

export default function Focus() {
  const { tasks, focusSessions, settings } = useData();
  const focus = useFocus();
  const [params, setParams] = useSearchParams();
  const today = todayStr();
  const todays = useMemo(() => tasks.filter((t) => onDay(t, today)), [tasks, today]);

  const [taskId, setTaskId] = useState(params.get('task') || '');
  const [label, setLabel] = useState(params.get('label') || '');
  const [minutes, setMinutes] = useState(Number(params.get('min')) || settings.focusDefault || 5);
  const [custom, setCustom] = useState('');

  useEffect(() => {
    if (params.get('task')) setTaskId(params.get('task'));
    if (params.get('label')) { setLabel(params.get('label')); setTaskId(''); }
  }, [params]);

  const task = tasks.find((t) => t.id === taskId);
  const s = focus.session;
  const sessionsToday = focusSessions.filter((x) => x.date === today).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  const totalToday = sessionsToday.reduce((n, x) => n + (x.minutes || 0), 0);

  const startNow = () => {
    focus.start({
      minutes,
      label: task ? (nextStep(task) ? `${task.title} — ${nextStep(task)}` : task.title) : label || 'Focus session',
      taskId: task?.id || null,
      newThingId: params.get('thing') || null,
      kind: params.get('thing') ? 'new' : 'focus',
    });
    setParams({});
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Focus</h1>
          <div className="sub">Train the skill of <b>starting</b>. Five minutes is enough — you can stop after if you genuinely want to.</div>
        </div>
        <div className="chip on nums">{Math.round(totalToday)} min focused today</div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card hero">
            <div className="timer-wrap">
              <TimerRing remaining={s ? focus.remaining : minutes * 60} total={s ? s.durationSec : 0} />
            </div>

            {s ? (
              <div className="stack center" style={{ gap: 12 }}>
                <div><div className="muted small">Working on</div><b>{s.label}</b></div>
                <div className="row" style={{ justifyContent: 'center' }}>
                  {s.pausedLeft != null
                    ? <button className="btn primary lg" onClick={focus.resume}><Play size={18} /> Resume</button>
                    : <button className="btn lg" onClick={focus.pause}><Pause size={18} /> Pause</button>}
                  <button className="btn lg" onClick={focus.stop}><Square size={16} /> Stop & log</button>
                  <button className="btn ghost" onClick={focus.cancel}>Discard</button>
                </div>
              </div>
            ) : (
              <div className="stack" style={{ gap: 14 }}>
                <div className="grid g-2" style={{ gap: 10 }}>
                  <label className="field">From today’s tasks
                    <select className="select" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                      <option value="">— free session —</option>
                      {todays.filter((t) => t.status !== 'done').map((t) => <option key={t.id} value={t.id}>{t.main ? '★ ' : ''}{t.title}</option>)}
                    </select>
                  </label>
                  <label className="field">…or describe it
                    <input className="input" disabled={!!taskId} placeholder="e.g. read one page" value={label} onChange={(e) => setLabel(e.target.value)} />
                  </label>
                </div>
                {task && nextStep(task) && <div className="fix small">{task.steps?.some((s) => s.done) ? 'Next step' : 'First physical action'}: <b>{nextStep(task)}</b></div>}
                <div className="presets">
                  {PRESETS.map((m) => (
                    <button key={m} className={cx('btn', minutes === m && 'primary')} onClick={() => setMinutes(m)}>{m} min</button>
                  ))}
                  <input className="input" style={{ width: 90 }} type="number" min="1" placeholder="custom" value={custom}
                    onChange={(e) => { setCustom(e.target.value); if (Number(e.target.value) > 0) setMinutes(Number(e.target.value)); }} />
                </div>
                <div className="center"><button className="btn gold lg" onClick={startNow}><Play size={18} /> Start {minutes} minutes</button></div>
                <p className="center small muted">Before you press start: phone in another room, materials open, one task only.</p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head"><h2><History size={18} /> Today’s sessions</h2><span className="badge">{sessionsToday.length}</span></div>
            {sessionsToday.length === 0 ? <Empty>No sessions yet today. The first one is the one that counts.</Empty> : (
              <div className="task-list">
                {sessionsToday.map((x) => (
                  <div key={x.id} className="task" style={{ alignItems: 'center' }}>
                    <span className={cx('chip', x.kind === 'rescue' ? 'gold' : x.kind === 'new' ? 'on' : '')}>{x.kind === 'rescue' ? 'rescue' : x.kind === 'new' ? 'new thing' : 'focus'}</span>
                    <span className="grow">{x.label}</span>
                    <span className="nums muted">{x.minutes} min</span>
                    <span className="tiny muted">{x.startedAt ? new Date(x.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <Rescue todays={todays} onStart={focus.start} />
      </div>
    </>
  );
}
