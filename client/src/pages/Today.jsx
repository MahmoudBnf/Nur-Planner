import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Star, Play, Plus, ListTodo, History, Sparkles, Flame, MapPin, Repeat, BedDouble } from 'lucide-react';
import { durationMin, fmtDur, timeOf, wakeDay } from '../lib/sleep.js';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { TaskForm, TaskItem } from '../components/Tasks.jsx';
import { PrayerTracker } from '../components/Prayer.jsx';
import { Empty, Progress } from '../components/ui.jsx';
import { ANCHORS, ANCHOR_KEYS, CHALLENGE_ITEMS, REMINDERS } from '../lib/constants.js';
import { blockAt, blockOf, cx, daySeed, diffDays, doneStamp, endDate, fmtCountdown, fmtDate, greeting, minutesOf, nextStep, onDay, todayStr, weekStartOf } from '../lib/utils.js';
import { ActivityBar, WeekliesCard, isWeekScope } from '../components/Routine.jsx';
import { dailyPoints, weeklyPoints } from '../lib/activity.js';

function NextPrayerCard() {
  const p = usePrayer();
  if (p.noLocation) {
    return (
      <div className="card hero">
        <h2>Salah times</h2>
        <p className="muted mt-1">Choose your city once and your day will be structured around the five prayers.</p>
        <Link to="/salah" className="btn primary mt-2"><MapPin size={16} /> Choose city</Link>
      </div>
    );
  }
  if (p.error) return <div className="card"><h2>Salah times</h2><p className="muted mt-1">{p.error}</p></div>;
  const hijri = p.day?.hijri;
  return (
    <div className="card hero next-prayer">
      <div className="row between">
        <span className="chip gold">Next prayer</span>
        {hijri && <span className="small muted">{hijri.day} {hijri.month} {hijri.year} AH</span>}
      </div>
      {p.next ? (
        <>
          <div className="row between mt-2" style={{ alignItems: 'flex-end' }}>
            <div>
              <div className="name">{p.next.name}</div>
              <div className="muted">{p.next.tomorrow ? 'Tomorrow at ' : 'at '}{p.next.time}</div>
            </div>
            <div className="count">{fmtCountdown(p.nextIn)}</div>
          </div>
          <div className="mt-2"><Progress value={p.progress * 100} /></div>
        </>
      ) : <div className="muted mt-2">Loading…</div>}
      <div className="mt-3"><PrayerTracker timings={p.day?.timings} /></div>
    </div>
  );
}

function MainTask({ tasks }) {
  const { update } = useData();
  const nav = useNavigate();
  const main = tasks.find((t) => t.main);
  const candidates = tasks.filter((t) => t.status === 'todo' && !t.main);

  if (!main) {
    return (
      <div className="card gold">
        <div className="card-head"><h2><Star size={18} style={{ color: 'var(--gold)' }} /> The one task</h2></div>
        <p className="text-2">Which single task would make today meaningfully successful? Decide it <b>before</b> opening social media.</p>
        {candidates.length > 0 ? (
          <div className="row wrap mt-2">
            {candidates.slice(0, 6).map((t) => (
              <button key={t.id} className="chip click" onClick={() => update('tasks', t.id, { main: true })}>☆ {t.title}</button>
            ))}
          </div>
        ) : <p className="muted small mt-2">Add a task below, then star it.</p>}
      </div>
    );
  }
  const done = main.status === 'done';
  return (
    <div className="card gold">
      <div className="row between">
        <span className="chip gold"><Star size={12} fill="currentColor" /> Main task of the day</span>
        {done && <span className="chip good">✓ Done — alhamdulillah</span>}
      </div>
      <h2 style={{ fontSize: 22, marginTop: 10 }}>{main.title}</h2>
      {nextStep(main) && <p className="text-2 mt-1">{main.steps?.some((x) => x.done) ? 'Next step' : 'First action'}: <b>{nextStep(main)}</b></p>}
      {main.steps?.length > 1 && <p className="tiny muted mt-1">{main.steps.filter((x) => x.done).length}/{main.steps.length} steps done</p>}
      {!done && (
        <div className="row wrap mt-3">
          <button className="btn gold lg" onClick={() => nav(`/focus?task=${main.id}&min=5`)}><Play size={18} /> Start 5 minutes</button>
          <button className="btn" onClick={() => update('tasks', main.id, { status: 'done', started: true, doneAt: doneStamp(main) })}>Mark done</button>
          <span className="small muted">You only need to begin. You can stop after five minutes.</span>
        </div>
      )}
    </div>
  );
}

function ChallengeMini() {
  const { settings, challengeDays, setEntry } = useData();
  const today = todayStr();
  if (!settings.challengeStart) {
    return (
      <div className="card">
        <div className="card-head"><h2><Flame size={18} /> 14-day challenge</h2></div>
        <p className="muted small">Five small habits for two weeks.</p>
        <Link to="/challenge" className="btn sm mt-2">Start the challenge</Link>
      </div>
    );
  }
  const dayN = diffDays(settings.challengeStart, today) + 1;
  const entry = challengeDays[today] || {};
  const count = CHALLENGE_ITEMS.filter((i) => entry[i.key]).length;
  return (
    <div className="card">
      <div className="card-head">
        <h2><Flame size={18} /> Challenge {dayN >= 1 && dayN <= 14 ? `· day ${dayN}/14` : ''}</h2>
        <span className="badge">{count}/5</span>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {CHALLENGE_ITEMS.map((i) => (
          <div key={i.key} className="row small" style={{ cursor: 'pointer' }} onClick={() => setEntry('challengeDays', today, { [i.key]: !entry[i.key] })}>
            <span className={cx('check', entry[i.key] && 'on')}>✓</span>
            <span className={entry[i.key] ? 'muted' : ''}>{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Last night at a glance, with a one-tap "going to sleep" in the evening.
function SleepMini() {
  const { sleeps } = useData();
  const today = todayStr();
  const ongoing = sleeps.find((s) => !s.end);
  const last = sleeps.filter((s) => s.end && wakeDay(s) === today).sort((a, b) => b.end.localeCompare(a.end));
  if (ongoing || (!last.length && !sleeps.length)) return null;
  const total = last.reduce((n, s) => n + durationMin(s), 0);
  return (
    <Link to="/sleep" className="card flat" style={{ display: 'block' }}>
      <div className="row between">
        <b><BedDouble size={16} style={{ verticalAlign: -3 }} /> Sleep today</b>
        <span className="nums">{last.length ? fmtDur(total) : '—'}</span>
      </div>
      <div className="small muted mt-1">
        {last.length ? last.map((s) => `${timeOf(s.start)}–${timeOf(s.end)}`).join(' · ') : 'Not logged yet — when did you sleep last night?'}
      </div>
    </Link>
  );
}

export default function Today() {
  const { tasks, settings, weeklyGoals, routines, quran, quranLogs } = useData();
  const prayer = usePrayer();
  const today = todayStr();
  const [adding, setAdding] = useState(false);
  const timings = prayer.day?.timings;
  const nowBlock = timings ? blockAt(Math.floor(prayer.nowSecs / 60), timings) : null;

  const onToday = useMemo(() => tasks.filter((t) => onDay(t, today)), [tasks, today]);
  const todays = onToday.filter((t) => !isWeekScope(t));
  const weeklies = onToday.filter(isWeekScope);
  const overdue = tasks.filter((t) => endDate(t) < today && t.status === 'todo' && !t.routineId);
  const done = todays.filter((t) => t.status === 'done').length;
  const ctx = { tasks, routines, quran, quranLogs };
  const points = dailyPoints(ctx, today);
  const week = weeklyPoints(ctx, weekStartOf(today, settings.weekStartsOn ?? 1));
  const reminder = REMINDERS[daySeed() % REMINDERS.length];
  const isFriday = new Date().getDay() === 5;
  const isLastDayOfWeek = new Date().getDay() === ((settings.weekStartsOn ?? 1) + 6) % 7;

  const sortKey = (t) => [(t.status === 'done') ? 1 : 0, t.time ? minutesOf(t.time) : 9999];
  const byBlock = (a, b) => {
    const [x1, y1] = sortKey(a), [x2, y2] = sortKey(b);
    return x1 - x2 || y1 - y2;
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>{greeting()}{settings.name ? `, ${settings.name}` : ''}</h1>
          <div className="sub">{fmtDate(today)} · {done}/{todays.length} done</div>
        </div>
        <div className="activity-pair">
          <ActivityBar points={points} goal={settings.activityGoal || 100} />
          {(week.goal > 0 || week.catchUp > 0) && <ActivityBar weekly points={week.points} goal={week.goal} extra={week.catchUp} />}
        </div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <MainTask tasks={todays} />

          <div className="card">
            <div className="card-head">
              <h2><ListTodo size={18} /> Today’s plan</h2>
              <button className="btn sm" onClick={() => setAdding((a) => !a)}><Plus size={15} /> Add</button>
            </div>
            {adding && <div style={{ marginBottom: 16 }}><TaskForm date={today} compact goals={weeklyGoals} onDone={() => {}} /></div>}
            {todays.length === 0 && !adding && (
              <Empty icon={ListTodo}>Nothing planned yet. Add one task with a clear <b>first physical action</b>.</Empty>
            )}
            {ANCHOR_KEYS.map((a) => {
              const list = todays.filter((t) => blockOf(t, today, timings) === a).sort(byBlock);
              const isNow = a === nowBlock;
              if (!list.length && !isNow) return null;
              const beforeFajr = timings && prayer.nowSecs < minutesOf(timings.Fajr) * 60;
              const passed = nowBlock && !beforeFajr && a !== 'any' && ANCHOR_KEYS.indexOf(a) < ANCHOR_KEYS.indexOf(nowBlock);
              return (
                <div key={a} className={cx('block', isNow && 'now', passed && 'passed')}>
                  <div className="block-title">
                    <h3>{ANCHORS[a].label}</h3>
                    {isNow && <span className="chip on">Now</span>}
                    {timings && ANCHORS[a].prayer && <span className="tiny muted nums">{timings[ANCHORS[a].prayer]}</span>}
                    <span className="tiny muted">{ANCHORS[a].hint}</span>
                  </div>
                  {list.length ? <div className="task-list">{list.map((t) => <TaskItem key={t.id} task={t} />)}</div>
                    : <div className="tiny muted" style={{ padding: '2px 2px 6px' }}>Nothing here — what deserves this block?</div>}
                </div>
              );
            })}
            {routines.length === 0 && (
              <Link to="/routines" className="hint-link mt-2"><Repeat size={14} /> Tired of re-adding the same things? Set up your <b>dailies & weeklies</b> once →</Link>
            )}
          </div>

          {overdue.length > 0 && (
            <div className="card">
              <div className="card-head"><h2><History size={18} /> Left from previous days</h2><span className="badge">{overdue.length}</span></div>
              <p className="small muted" style={{ marginBottom: 10 }}>Bring them to today, postpone deliberately, or verify them in Review. No guilt — just decide.</p>
              <div className="task-list">{overdue.slice(0, 8).map((t) => <TaskItem key={t.id} task={t} showDate />)}</div>
            </div>
          )}
        </div>

        <div className="stack">
          <NextPrayerCard />
          <SleepMini />
          {(isLastDayOfWeek || isFriday) && (
            <Link to="/summary" className="card flat summary-prompt">
              <b>📋 Your weekly summary is ready</b>
              <div className="small muted mt-1">Salah, Qur'an, sleep, money and what you started — and one change for next week →</div>
            </Link>
          )}
          <WeekliesCard list={weeklies} />
          <div className="card">
            <div className="card-head"><h2><Sparkles size={18} /> Reminder</h2></div>
            <div className="reminder">“{reminder.text}”{reminder.src && <cite>— {reminder.src}</cite>}</div>
          </div>
          <ChallengeMini />
          <Link to="/review" className="card flat" style={{ display: 'block' }}>
            <b>End of day?</b>
            <div className="small muted mt-1">Verify what you did ✓ / ✗, add remarks, and set tomorrow’s first action →</div>
          </Link>
        </div>
      </div>
    </>
  );
}
