import { useState } from 'react';
import { Flame, RotateCcw, Info } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { CHALLENGE_ITEMS, PRAYERS } from '../lib/constants.js';
import { addDays, cx, diffDays, fmtDate, todayStr } from '../lib/utils.js';
import { Progress, Ring } from '../components/ui.jsx';

// Hints from what the app already knows about that day.
function useAutoHints(date) {
  const { prayerLog, tasks, focusSessions, reviews, avoidances } = useData();
  const pl = prayerLog[date] || {};
  const prayed = PRAYERS.filter((p) => pl[p] === 'ontime' || pl[p] === 'late').length;
  const sessions = focusSessions.filter((s) => s.date === date);
  const startedImportant = tasks.some((t) => t.date === date && (t.started || t.status === 'done') && t.category !== 'rest');
  const r = reviews[date];
  return {
    salah: `${prayed}/5 prayers logged`,
    important: startedImportant ? 'A task was started ✓' : `${sessions.filter((s) => s.kind !== 'new').length} focus sessions`,
    unfamiliar: sessions.some((s) => s.kind === 'new') ? 'Tried a new thing ✓' : 'Use “Try New Things”',
    recreation: avoidances.some((a) => a.date === date) ? `${avoidances.filter((a) => a.date === date).length} rescue(s) used` : '',
    review: r && (r.started || r.tomorrow) ? 'Review written ✓' : 'Open the Review page',
  };
}

export default function Challenge() {
  const { settings, saveSettings, challengeDays, setEntry } = useData();
  const today = todayStr();
  const start = settings.challengeStart;
  const [sel, setSel] = useState(today);
  const hints = useAutoHints(sel);

  if (!start) {
    return (
      <>
        <div className="page-head"><div><h1>14-Day Challenge</h1><div className="sub">A small system, not a life overhaul.</div></div></div>
        <div className="card hero" style={{ maxWidth: 720 }}>
          <h2><Flame size={18} style={{ color: 'var(--gold)', verticalAlign: -3 }} /> Five things a day, for fourteen days</h2>
          <div className="stack mt-2" style={{ gap: 8 }}>
            {CHALLENGE_ITEMS.map((i, n) => (
              <div key={i.key} className="row" style={{ alignItems: 'flex-start' }}>
                <span className="step-num">{n + 1}</span>
                <div><b>{i.label}</b><div className="small muted">{i.hint}</div></div>
              </div>
            ))}
          </div>
          <p className="small text-2 mt-3">Don’t judge progress by whether you never procrastinate. Judge it by whether you <b>notice avoidance sooner</b>, <b>start more often</b>, and <b>recover more quickly</b>.</p>
          <button className="btn gold lg mt-3" onClick={() => saveSettings({ challengeStart: today })}>Start today</button>
        </div>
      </>
    );
  }

  const days = Array.from({ length: 14 }, (_, i) => addDays(start, i));
  const dayN = diffDays(start, today) + 1;
  const scoreOf = (d) => CHALLENGE_ITEMS.filter((i) => challengeDays[d]?.[i.key]).length;
  const total = days.reduce((n, d) => n + scoreOf(d), 0);
  const fullDays = days.filter((d) => scoreOf(d) === 5).length;
  const entry = challengeDays[sel] || {};
  const finished = dayN > 14;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>14-Day Challenge</h1>
          <div className="sub">Started {fmtDate(start, { day: 'numeric', month: 'long' })} · {finished ? 'completed' : `day ${Math.max(1, dayN)} of 14`}</div>
        </div>
        <button className="btn sm" onClick={() => { if (confirm('Restart the challenge from today? Past check-ins are kept in your data.')) saveSettings({ challengeStart: today }); }}>
          <RotateCcw size={14} /> Restart
        </button>
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <div className="card"><div className="stat"><span className="label">Overall</span><span className="value">{Math.round((total / 70) * 100)}%</span><Progress value={(total / 70) * 100} /></div></div>
        <div className="card"><div className="stat"><span className="label">Perfect days</span><span className="value">{fullDays}</span><span className="hint">all 5 habits</span></div></div>
        <div className="card"><div className="stat"><span className="label">Check-ins</span><span className="value">{total}<span className="small muted">/70</span></span></div></div>
        <div className="card"><div className="stat"><span className="label">Days left</span><span className="value">{Math.max(0, 14 - Math.max(0, dayN))}</span></div></div>
      </div>

      <div className="grid g-main">
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h2>Two weeks</h2><span className="small muted">Click a day to edit it</span></div>
          <div className="ch-grid">
            {days.map((d, i) => {
              const s = scoreOf(d);
              return (
                <div key={d} className={cx('ch-day', sel === d && 'sel', d > today && 'future')} onClick={() => d <= today && setSel(d)}>
                  <div className="n">Day {i + 1}</div>
                  <div style={{ display: 'grid', placeItems: 'center', marginTop: 6 }}><Ring value={s / 5} size={44} stroke={5}>{s}</Ring></div>
                  <div className="tiny muted mt-1">{fmtDate(d, { day: 'numeric', month: 'short' })}</div>
                </div>
              );
            })}
          </div>
          {finished && (
            <div className="fix mt-3">
              <b>Challenge finished.</b> Look at your Insights: did you start more often? Recover faster? Keep what worked and restart for another two weeks if you like.
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head"><h2>{sel === today ? 'Today' : fmtDate(sel, { weekday: 'long', day: 'numeric', month: 'short' })}</h2><span className="badge">{scoreOf(sel)}/5</span></div>
          <div className="stack" style={{ gap: 8 }}>
            {CHALLENGE_ITEMS.map((i) => (
              <div key={i.key} className={cx('check-item', entry[i.key] && 'on')} onClick={() => setEntry('challengeDays', sel, { [i.key]: !entry[i.key] })}>
                <span className={cx('check', entry[i.key] && 'on')}>✓</span>
                <div className="grow">
                  <b>{i.label}</b>
                  <div className="small muted">{i.hint}</div>
                  {hints[i.key] && <div className="tiny mt-1" style={{ color: 'var(--accent)' }}><Info size={11} style={{ verticalAlign: -1 }} /> {hints[i.key]}</div>}
                </div>
              </div>
            ))}
          </div>
          <p className="tiny muted mt-2">This checklist is a daily reminder, not a score of your worth.</p>
        </div>
      </div>
    </>
  );
}
