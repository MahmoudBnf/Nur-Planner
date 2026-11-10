import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Printer, ListChecks, Moon, BookOpen, BedDouble, Wallet, Brain, Target, NotebookPen, Sparkles } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { useMoney } from './Money.jsx';
import { AVOID_REASONS, EXPENSE_CATS, PRAYERS, PRAYER_STATES, PRAYER_STATE_KEYS, inTime } from '../lib/constants.js';
import { addDays, cx, fmtDate, todayStr, weekDays, weekStartOf } from '../lib/utils.js';
import { dailyPoints } from '../lib/activity.js';
import { TIER_INFO, fmtHizb } from '../lib/quran.js';
import { classify, durationMin, fmtDur, minsOf, wakeDay } from '../lib/sleep.js';

const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const hhmm = (m) => `${String(Math.floor((((m % 1440) + 1440) % 1440) / 60)).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(2, '0')}`;

function metrics(data, start, timings) {
  const { tasks, focusSessions, prayerLog, quranLogs, sleeps, transactions, avoidances, reviews, routines } = data;
  const days = weekDays(start);
  const end = days[6];
  const inWeek = (d) => d >= start && d <= end;
  const t = tasks.filter((x) => inWeek(x.date) && x.scope !== 'week');
  const started = t.filter((x) => x.started || x.status === 'done' || x.status === 'partial').length;
  const done = t.filter((x) => x.status === 'done').length;
  const pointsByDay = days.map((d) => ({ d, p: dailyPoints(data, d) }));
  const best = [...pointsByDay].sort((a, b) => b.p - a.p)[0];

  const states = days.flatMap((d) => PRAYERS.map((p) => prayerLog[d]?.[p]).filter(Boolean));
  const count = (k) => states.filter((s) => s === k).length;

  const ql = quranLogs.filter((l) => inWeek(l.date));
  const revisedBy = (tier) => sum(ql.filter((l) => l.kind === 'revise' && l.tier === tier).map((l) => l.units));

  const perDay = days.map((d) => sum(sleeps.filter((s) => wakeDay(s) === d).map((s) => durationMin(s))));
  const slept = perDay.filter((m) => m > 0);
  const nights = sleeps.filter((s) => s.end && inWeek(s.end.slice(0, 10)) && classify(s, timings) === 'night');
  const naps = sleeps.filter((s) => s.end && inWeek(s.end.slice(0, 10)) && classify(s, timings) !== 'night');

  const tx = transactions.filter((x) => inWeek(x.date));
  const spent = sum(tx.filter((x) => x.type === 'expense').map((x) => x.amount));
  const received = sum(tx.filter((x) => x.type === 'income').map((x) => x.amount));
  const byCat = Object.keys(EXPENSE_CATS).map((k) => ({ k, v: sum(tx.filter((x) => x.type === 'expense' && x.category === k).map((x) => x.amount)) })).sort((a, b) => b.v - a.v);

  const av = avoidances.filter((a) => inWeek(a.date));
  const reasons = Object.keys(AVOID_REASONS).map((k) => ({ k, n: av.filter((a) => a.reason === k).length })).sort((a, b) => b.n - a.n);
  const moods = days.map((d) => reviews[d]?.mood).filter(Boolean);

  const routineOcc = tasks.filter((x) => x.routineId && inWeek(x.date) && (x.until || x.date) <= todayStr());
  const routineRows = routines.filter((r) => r.active).map((r) => {
    const occ = routineOcc.filter((x) => x.routineId === r.id);
    return { title: r.title, done: occ.filter((x) => x.status === 'done').length, n: occ.length };
  }).filter((r) => r.n);

  return {
    days, planned: t.length, started, done, startRate: t.length ? started / t.length : null,
    focus: sum(focusSessions.filter((x) => inWeek(x.date)).map((x) => x.minutes || 0)), best,
    prayers: states.length, inTime: states.filter(inTime).length, count, owed: count('missed'),
    revised: { 1: revisedBy(1), 2: revisedBy(2), 3: revisedBy(3) }, memorized: ql.filter((l) => l.kind === 'memorize').length,
    sleepAvg: avg(slept), sleepDays: slept.length, naps: naps.length, bed: avg(nights.map((s) => (minsOf(s.start) - 1080 + 1440) % 1440)),
    spent, received, topCat: byCat[0]?.v ? byCat[0] : null, sadaqa: byCat.find((c) => c.k === 'sadaqa')?.v || 0,
    avoid: av.length, topReason: reasons[0]?.n ? reasons[0].k : null, reviewsWritten: days.filter((d) => reviews[d]?.started || reviews[d]?.tomorrow || reviews[d]?.mood).length, mood: avg(moods),
    routineRows,
  };
}

function Delta({ now, prev, unit = '', better = 'up', pct = false }) {
  if (now == null || prev == null) return null;
  const diff = pct ? Math.round((now - prev) * 100) : Math.round((now - prev) * 10) / 10;
  if (!diff) return <span className="delta">= same</span>;
  const good = better === 'up' ? diff > 0 : diff < 0;
  return <span className={cx('delta', good ? 'good-text' : 'warn-text')}>{diff > 0 ? '▲' : '▼'} {Math.abs(diff)}{pct ? ' pts' : unit}</span>;
}

function Stat({ label, value, children }) {
  return <div className="row between small"><span className="muted">{label}</span><span className="row" style={{ gap: 8 }}><b>{value}</b>{children}</span></div>;
}

export default function Summary() {
  const data = useData();
  const { settings, weeklyGoals, reviews, setEntry } = data;
  const prayer = usePrayer();
  const { fmt } = useMoney();
  const ws = settings.weekStartsOn ?? 1;
  const [start, setStart] = useState(weekStartOf(todayStr(), ws));
  const m = useMemo(() => metrics(data, start, prayer.day?.timings), [data, start, prayer.day]);
  const p = useMemo(() => metrics(data, addDays(start, -7), prayer.day?.timings), [data, start, prayer.day]);
  const goals = weeklyGoals.filter((g) => g.weekStart === start);
  const key = `week-${start}`;
  const r = reviews[key] || {};
  const isCurrent = start === weekStartOf(todayStr(), ws);
  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

  // A few plain-language highlights.
  const lines = [];
  if (m.startRate != null) lines.push(`You started ${Math.round(m.startRate * 100)}% of what you planned${p.startRate != null ? (m.startRate >= p.startRate ? ' — better than last week.' : ' — a bit less than last week.') : '.'}`);
  if (m.prayers) lines.push(m.owed ? `${m.owed} prayer${m.owed > 1 ? 's are' : ' is'} still to make up from this week.` : `${pct(m.inTime, m.prayers)} of logged prayers were within their time${m.count('ontime') === m.prayers ? ' — all on time, alhamdulillah.' : '.'}`);
  const rev = m.revised[1] + m.revised[2] + m.revised[3];
  if (rev) lines.push(`You revised ${fmtHizb(rev)} hizb of Qur'an${m.memorized ? ` and memorized ${m.memorized} new thumun` : ''}.`);
  if (m.sleepAvg) lines.push(`You slept ${fmtDur(m.sleepAvg)} a day on average (goal ${settings.sleepGoal || 7.5}h).`);
  if (m.topReason) lines.push(`When you avoided something, it was mostly “${AVOID_REASONS[m.topReason].label.toLowerCase()}”: ${AVOID_REASONS[m.topReason].fix}`);
  if (m.best?.p) lines.push(`Your strongest day was ${fmtDate(m.best.d, { weekday: 'long' })}.`);

  return (
    <div className="summary">
      <div className="page-head">
        <div>
          <h1>Weekly summary</h1>
          <div className="sub">{fmtDate(m.days[0], { day: 'numeric', month: 'long' })} – {fmtDate(m.days[6], { day: 'numeric', month: 'long', year: 'numeric' })}{isCurrent && ' · this week so far'}</div>
        </div>
        <div className="row no-print">
          <button className="icon-btn" onClick={() => setStart(addDays(start, -7))}><ChevronLeft size={18} /></button>
          <button className="btn sm" disabled={isCurrent} onClick={() => setStart(weekStartOf(todayStr(), ws))}>This week</button>
          <button className="icon-btn" disabled={isCurrent} onClick={() => setStart(addDays(start, 7))}><ChevronRight size={18} /></button>
          <button className="btn sm" onClick={() => window.print()}><Printer size={14} /> Print</button>
        </div>
      </div>

      <div className="card hero" style={{ marginBottom: 18 }}>
        <div className="card-head"><h2><Sparkles size={18} /> The week in a few lines</h2></div>
        {lines.length ? <ul className="summary-lines">{lines.map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="muted">Not much logged this week yet.</p>}
      </div>

      <div className="grid g-3">
        <div className="card">
          <div className="card-head"><h2><ListChecks size={18} /> Doing</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            <Stat label="Start rate" value={m.startRate != null ? pct(m.started, m.planned) : '—'}><Delta now={m.startRate} prev={p.startRate} pct /></Stat>
            <Stat label="Tasks done" value={`${m.done} / ${m.planned}`}><Delta now={m.done} prev={p.done} /></Stat>
            <Stat label="Focused" value={fmtDur(m.focus)}><Delta now={Math.round(m.focus / 6) / 10} prev={Math.round(p.focus / 6) / 10} unit="h" /></Stat>
            {m.best?.p > 0 && <Stat label="Best day" value={fmtDate(m.best.d, { weekday: 'long' })} />}
            {m.routineRows.length > 0 && <div className="divider" />}
            {m.routineRows.map((x) => <Stat key={x.title} label={x.title} value={`${x.done}/${x.n}`} />)}
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2><Moon size={18} /> Salah</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            <Stat label="Within their time" value={pct(m.inTime, m.prayers)}><Delta now={m.prayers ? m.inTime / m.prayers : null} prev={p.prayers ? p.inTime / p.prayers : null} pct /></Stat>
            {PRAYER_STATE_KEYS.map((k) => <Stat key={k} label={PRAYER_STATES[k].label} value={m.count(k)} />)}
            <Stat label="Logged" value={`${m.prayers} / 35`} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2><BookOpen size={18} /> Qur'an</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            {[1, 2, 3].map((t) => <Stat key={t} label={TIER_INFO[t].name} value={`${fmtHizb(m.revised[t])} hizb`}><Delta now={m.revised[t] / 8} prev={p.revised[t] / 8} unit=" hizb" /></Stat>)}
            <Stat label="Memorized (→ Tier 2)" value={`${m.memorized} thumun`} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2><BedDouble size={18} /> Sleep</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            <Stat label="Average per day" value={m.sleepAvg ? fmtDur(m.sleepAvg) : '—'}><Delta now={m.sleepAvg ? m.sleepAvg / 60 : null} prev={p.sleepAvg ? p.sleepAvg / 60 : null} unit="h" /></Stat>
            <Stat label="Usual bedtime" value={m.bed != null ? hhmm(m.bed + 1080) : '—'} />
            <Stat label="Naps" value={m.naps} />
            <Stat label="Days logged" value={`${m.sleepDays} / 7`} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2><Wallet size={18} /> Money</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            <Stat label="Spent" value={fmt(m.spent)}><Delta now={m.spent} prev={p.spent} better="down" /></Stat>
            <Stat label="Received" value={fmt(m.received)} />
            {m.topCat && <Stat label="Most on" value={`${EXPENSE_CATS[m.topCat.k].icon} ${EXPENSE_CATS[m.topCat.k].label}`} />}
            <Stat label="Sadaqa" value={fmt(m.sadaqa)} />
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h2><Brain size={18} /> Mind</h2></div>
          <div className="stack" style={{ gap: 8 }}>
            <Stat label="Rescues used" value={m.avoid} />
            {m.topReason && <Stat label="Most common reason" value={AVOID_REASONS[m.topReason].label} />}
            <Stat label="Days reviewed" value={`${m.reviewsWritten} / 7`}><Delta now={m.reviewsWritten} prev={p.reviewsWritten} /></Stat>
            {m.mood && <Stat label="Average mood" value={['😞', '😕', '😐', '🙂', '😄'][Math.round(m.mood) - 1]} />}
          </div>
        </div>
      </div>

      <div className="grid g-2 mt-3">
        <div className="card">
          <div className="card-head"><h2><Target size={18} /> Objectives of the week</h2></div>
          {goals.length === 0 ? <p className="small muted">No objectives were set for this week.</p> : (
            <div className="stack" style={{ gap: 8 }}>
              {goals.map((g) => (
                <div key={g.id} className="row between small">
                  <span>{g.title}</span>
                  <span className={cx('chip', g.status === 'done' ? 'good' : g.status === 'dropped' ? 'bad' : g.status === 'partial' ? 'warn' : '')}>
                    {g.status === 'done' ? '✓ achieved' : g.status === 'dropped' ? '✗ not achieved' : g.status === 'partial' ? '~ partly' : `${g.progress || 0}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2><NotebookPen size={18} /> Reflection</h2></div>
          <div className="stack" style={{ gap: 10 }}>
            <label className="field">What went well?<textarea className="textarea" style={{ minHeight: 50 }} value={r.well || ''} onChange={(e) => setEntry('reviews', key, { well: e.target.value })} /></label>
            <label className="field">What made starting difficult?<textarea className="textarea" style={{ minHeight: 50 }} value={r.hard || ''} onChange={(e) => setEntry('reviews', key, { hard: e.target.value })} /></label>
            <label className="field">One change for next week<textarea className="textarea" style={{ minHeight: 50 }} value={r.change || ''} onChange={(e) => setEntry('reviews', key, { change: e.target.value })} /></label>
          </div>
        </div>
      </div>
    </div>
  );
}
