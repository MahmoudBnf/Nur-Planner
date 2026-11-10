import { useMemo, useRef, useState } from 'react';
import { Moon, Sun, Pencil, Trash2, Plus, BedDouble, Brain, AlarmClock, Clock3, BarChart3 } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { BarChart, Legend } from '../components/Charts.jsx';
import { Empty, Modal, Seg } from '../components/ui.jsx';
import { PRAYERS, inTime } from '../lib/constants.js';
import { addDays, cx, fmtDate, lastNDays, minutesOf, onDay, todayStr } from '../lib/utils.js';
import {
  SLEEP_TYPES, SLEEP_TYPE_KEYS, classify, dateOf, durationMin, fmtDur, minsOf, nowLocal, overlap, timeOf, toLocal, wakeDay,
} from '../lib/sleep.js';

const QUALITY = ['😫', '😕', '😐', '🙂', '😴✨'];
const hhmm = (m) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, '0')}:${String(Math.round(((m % 60) + 60) % 60)).padStart(2, '0')}`;

// ---------------- 24h clock of one day ----------------
function SleepClock({ day, sleeps, timings }) {
  const S = 320, c = S / 2, R = 118, W = 26;
  const ang = (min) => (min / 1440) * 2 * Math.PI - Math.PI / 2;
  const pt = (min, r) => [c + r * Math.cos(ang(min)), c + r * Math.sin(ang(min))];
  const arc = (a, b, r) => {
    let len = b - a;
    if (len <= 0) len += 1440;
    len = Math.min(len, 1439.9);
    const [x1, y1] = pt(a, r), [x2, y2] = pt(a + len, r);
    return `M${x1},${y1} A${r},${r} 0 ${len > 720 ? 1 : 0} 1 ${x2},${y2}`;
  };
  // Parts of each sleep inside this calendar day.
  const from = new Date(`${day}T00:00`), to = new Date(`${addDays(day, 1)}T00:00`);
  const parts = sleeps
    .map((s) => {
      const a = Math.max(new Date(s.start), from), b = Math.min(new Date(s.end || nowLocal()), to);
      if (b <= a) return null;
      return { s, a: (a - from) / 60000, b: (b - from) / 60000, type: classify(s, timings) };
    })
    .filter(Boolean);
  const total = parts.reduce((n, p) => n + (p.b - p.a), 0);
  const isToday = day === todayStr();
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <svg viewBox={`0 0 ${S} ${S}`} className="sleep-clock">
      <circle cx={c} cy={c} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={W} />
      {/* daylight (sunrise → maghrib) as a faint inner band */}
      {timings && <path d={arc(minutesOf(timings.Sunrise), minutesOf(timings.Maghrib), R - W / 2 - 8)} stroke="var(--gold)" strokeOpacity="0.25" strokeWidth="4" fill="none" strokeLinecap="round" />}
      {Array.from({ length: 24 }, (_, h) => {
        const [x1, y1] = pt(h * 60, R + W / 2 + 2), [x2, y2] = pt(h * 60, R + W / 2 + (h % 6 ? 6 : 10));
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth={h % 6 ? 1 : 2} />;
      })}
      {[0, 6, 12, 18].map((h) => {
        const [x, y] = pt(h * 60, R - W / 2 - 22);
        return <text key={h} x={x} y={y + 4} textAnchor="middle" className="clock-hour">{String(h).padStart(2, '0')}</text>;
      })}
      {parts.map((p, i) => (
        <path key={i} d={arc(p.a, p.b, R)} stroke={SLEEP_TYPES[p.type].color} strokeWidth={W - 4} fill="none" strokeLinecap="round">
          <title>{SLEEP_TYPES[p.type].label}: {timeOf(p.s.start)} → {p.s.end ? timeOf(p.s.end) : 'now'} ({fmtDur(durationMin(p.s))})</title>
        </path>
      ))}
      {timings && PRAYERS.map((p) => {
        const m = minutesOf(timings[p]);
        const [x1, y1] = pt(m, R - W / 2), [x2, y2] = pt(m, R + W / 2);
        const [lx, ly] = pt(m, R + W / 2 + 22);
        return (
          <g key={p}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--gold)" strokeWidth="2" />
            <text x={lx} y={ly + 4} textAnchor="middle" className="clock-prayer">{p}</text>
          </g>
        );
      })}
      {isToday && (() => {
        const [x, y] = pt(nowMin, R + W / 2 + 4);
        return <><line x1={c} y1={c} x2={x} y2={y} stroke="var(--text)" strokeOpacity="0.5" strokeWidth="1.5" /><circle cx={c} cy={c} r="3" fill="var(--text)" /></>;
      })()}
      <text x={c} y={c - 6} textAnchor="middle" className="clock-total">{fmtDur(total)}</text>
      <text x={c} y={c + 16} textAnchor="middle" className="clock-sub">{isToday ? 'slept today' : fmtDate(day, { weekday: 'short', day: 'numeric', month: 'short' })}</text>
    </svg>
  );
}

// ---------------- diary: one row per calendar day, 00:00 → 24:00 ----------------
// A sleep crossing midnight is drawn on both rows (cut edges show it continues);
// a row's total is what you slept in the sleeps that ended that day.
function Diary({ days, sleeps, timings }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const ticks = [0, 180, 360, 540, 720, 900, 1080, 1260, 1440];
  const fajr = timings ? minutesOf(timings.Fajr) : null;
  const dhuhr = timings ? minutesOf(timings.Dhuhr) : null;
  return (
    <div ref={wrap} className="diary" onMouseLeave={() => setTip(null)}>
      <div className="diary-axis">
        <span />
        <div className="diary-track">
          {ticks.map((t) => <i key={t} style={{ left: `${(t / 1440) * 100}%` }}>{t === 1440 ? '24' : hhmm(t).slice(0, 2)}</i>)}
        </div>
        <span className="tiny muted">total</span>
      </div>
      {days.map((d) => {
        const from = new Date(`${d}T00:00`), to = new Date(`${addDays(d, 1)}T00:00`);
        const parts = sleeps.map((s) => {
          const mins = overlap(s, from, to);
          if (!mins) return null;
          const a = Math.max(0, (new Date(s.start) - from) / 60000);
          return { s, a, w: mins, type: classify(s, timings), fromPrev: new Date(s.start) < from, toNext: new Date(s.end || nowLocal()) > to };
        }).filter(Boolean);
        const total = sleeps.filter((s) => wakeDay(s) === d).reduce((n, s) => n + durationMin(s), 0);
        return (
          <div key={d} className={cx('diary-row', d === todayStr() && 'today')}>
            <span className="diary-label">{fmtDate(d, { weekday: 'short', day: 'numeric' })}</span>
            <div className="diary-track">
              {[360, 720, 1080].map((m) => <b key={m} className="diary-grid" style={{ left: `${(m / 1440) * 100}%` }} />)}
              {fajr != null && <b className="diary-mark" style={{ left: `${(fajr / 1440) * 100}%` }} />}
              {dhuhr != null && <b className="diary-mark soft" style={{ left: `${(dhuhr / 1440) * 100}%` }} />}
              {parts.map((p, i) => (
                <span key={i} className={cx('diary-bar', !p.s.end && 'ongoing', p.fromPrev && 'from-prev', p.toNext && 'to-next')}
                  style={{ left: `${(p.a / 1440) * 100}%`, width: `${Math.max(0.4, (p.w / 1440) * 100)}%`, background: SLEEP_TYPES[p.type].color }}
                  onMouseMove={(e) => {
                    const r = wrap.current.getBoundingClientRect();
                    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, p });
                  }} />
              ))}
            </div>
            <span className="diary-total nums">{total ? fmtDur(total) : '—'}</span>
          </div>
        );
      })}
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{SLEEP_TYPES[tip.p.type].label}</b>
          <div>{fmtDate(dateOf(tip.p.s.start), { weekday: 'short' })} {timeOf(tip.p.s.start)} → {tip.p.s.end ? `${dateOf(tip.p.s.end) !== dateOf(tip.p.s.start) ? `${fmtDate(dateOf(tip.p.s.end), { weekday: 'short' })} ` : ''}${timeOf(tip.p.s.end)}` : 'now'} · {fmtDur(durationMin(tip.p.s))}</div>
          {tip.p.s.quality && <div>Quality {QUALITY[tip.p.s.quality - 1]}</div>}
        </div>
      )}
      <div className="row wrap between mt-1">
        <Legend items={SLEEP_TYPE_KEYS.map((k) => ({ name: SLEEP_TYPES[k].label, color: SLEEP_TYPES[k].color }))} />
        <span className="tiny muted"><b className="diary-mark inline" /> Fajr · <b className="diary-mark soft inline" /> Dhuhr · a night that starts before midnight continues on the next row</span>
      </div>
    </div>
  );
}

// ---------------- logging ----------------
function SleepForm({ initial, onDone }) {
  const { add, update, sleeps } = useData();
  const [f, setF] = useState(initial || { start: `${addDays(todayStr(), -1)}T23:30`, end: `${todayStr()}T06:30`, quality: 0, note: '', type: '' });
  const now = nowLocal();
  const bad = !f.start ? 'When did you fall asleep?'
    : f.end && f.end <= f.start ? 'Wake-up must be after falling asleep.'
    : f.start > now || (f.end && f.end > now) ? 'That time is still in the future.'
    : !f.end && sleeps.some((s) => !s.end && s.id !== initial?.id) ? 'Another sleep is already running — end that one first.'
    : null;
  // Overlapping another sleep is allowed (you may be fixing one), but said.
  const clash = !bad && sleeps.find((s) => s.id !== initial?.id && s.start < (f.end || now) && (s.end || now) > f.start);
  const submit = (e) => {
    e.preventDefault();
    if (bad) return;
    const data = { start: f.start, end: f.end || null, quality: f.quality || null, note: f.note.trim(), type: f.type || null };
    if (initial?.id) update('sleeps', initial.id, data);
    else add('sleeps', data);
    onDone?.();
  };
  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
      <div className="grid g-2" style={{ gap: 10 }}>
        <label className="field">Fell asleep<input className="input" type="datetime-local" value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></label>
        <label className="field">Woke up<input className="input" type="datetime-local" value={f.end || ''} onChange={(e) => setF({ ...f, end: e.target.value })} /></label>
      </div>
      {bad && <span className="small" style={{ color: 'var(--bad)' }}>{bad}</span>}
      {clash && <span className="small" style={{ color: 'var(--warn)' }}>This overlaps another sleep ({timeOf(clash.start)} → {clash.end ? timeOf(clash.end) : 'now'}, {fmtDate(dateOf(clash.start), { weekday: 'short', day: 'numeric' })}). Both would be counted.</span>}
      {!bad && f.end && durationMin(f) > 14 * 60 && <span className="small" style={{ color: 'var(--warn)' }}>{fmtDur(durationMin(f))} — is the date right?</span>}
      <label className="field">Quality
        <div className="scale">{QUALITY.map((m, i) => <button type="button" key={i} className={cx(f.quality === i + 1 && 'on')} onClick={() => setF({ ...f, quality: i + 1 })}>{m}</button>)}</div>
      </label>
      <label className="field">Type
        <select className="select" value={f.type || ''} onChange={(e) => setF({ ...f, type: e.target.value })}>
          <option value="">Automatic (from prayer times)</option>
          {SLEEP_TYPE_KEYS.map((k) => <option key={k} value={k}>{SLEEP_TYPES[k].label}</option>)}
        </select>
      </label>
      <input className="input" placeholder="Note (optional) — e.g. woke up twice, phone in bed…" value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} />
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary" disabled={!!bad}>{initial?.id ? 'Save' : 'Add sleep'}</button></div>
    </form>
  );
}

function NowCard({ ongoing }) {
  const { add, update, remove } = useData();
  const [manual, setManual] = useState(false);
  // A forgotten sleep starts the picker at a plausible wake-up (8 hours later).
  const [time, setTime] = useState(() => (ongoing && durationMin(ongoing) > 14 * 60 ? toLocal(new Date(new Date(ongoing.start).getTime() + 8 * 3600e3)) : nowLocal()));
  const [quality, setQuality] = useState(0);

  if (ongoing) {
    const wake = (end) => update('sleeps', ongoing.id, { end, quality: quality || null });
    // Over 14 hours "asleep" is almost always a forgotten wake-up tap.
    const forgotten = durationMin(ongoing) > 14 * 60;
    return (
      <div className="card hero sleep-now sleeping">
        <div className="row"><Moon size={22} style={{ color: 'var(--cat-7)' }} /><div>
          <div className="small muted">Sleeping since {timeOf(ongoing.start)}{dateOf(ongoing.start) !== todayStr() ? ` (${fmtDate(dateOf(ongoing.start), { weekday: 'short' })})` : ''}</div>
          <div className="sleep-big">{fmtDur(durationMin(ongoing))}</div>
        </div></div>
        <label className="field mt-2">How was it?
          <div className="scale">{QUALITY.map((m, i) => <button type="button" key={i} className={cx(quality === i + 1 && 'on')} onClick={() => setQuality(i + 1)}>{m}</button>)}</div>
        </label>
        {forgotten && <div className="fix small mt-2">That's {fmtDur(durationMin(ongoing))} — you probably forgot to tap “woke up”. When did you wake up?</div>}
        <div className="row wrap mt-2">
          <button className={cx('btn', forgotten ? '' : 'gold lg')} onClick={() => wake(nowLocal())}><Sun size={18} /> I just woke up</button>
          {!forgotten && <button className="btn" onClick={() => setManual(!manual)}><Clock3 size={16} /> I woke up earlier…</button>}
          <button className="btn ghost sm" onClick={() => remove('sleeps', ongoing.id)} title="Tapped by mistake">Cancel this sleep</button>
        </div>
        {(manual || forgotten) && (
          <div className="row mt-2">
            <input className="input" type="datetime-local" value={time} min={ongoing.start} max={nowLocal()} onChange={(e) => setTime(e.target.value)} />
            <button className={cx('btn', forgotten ? 'gold' : 'primary')} disabled={time <= ongoing.start || time > nowLocal()} onClick={() => wake(time)}>Save wake-up time</button>
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="card hero sleep-now">
      <div className="row"><BedDouble size={22} style={{ color: 'var(--cat-7)' }} /><div>
        <b>Going to sleep?</b>
        <div className="small muted">Tap when you lie down — tap again when you wake up. Forgot? Enter the times by hand.</div>
      </div></div>
      <div className="row wrap mt-2">
        <button className="btn primary lg" onClick={() => add('sleeps', { start: nowLocal(), end: null })}><Moon size={18} /> Going to sleep now</button>
        <button className="btn" onClick={() => setManual(!manual)}><Clock3 size={16} /> I fell asleep earlier…</button>
      </div>
      {manual && (
        <div className="row mt-2">
          <input className="input" type="datetime-local" value={time} max={nowLocal()} onChange={(e) => setTime(e.target.value)} />
          <button className="btn primary" disabled={!time || time > nowLocal()} onClick={() => add('sleeps', { start: time, end: null })}>Start from then</button>
        </div>
      )}
    </div>
  );
}

// ---------------- page ----------------
export default function Sleep() {
  const { sleeps, settings, saveSettings, prayerLog, tasks, remove } = useData();
  const prayer = usePrayer();
  const timings = prayer.day?.timings;
  const [range, setRange] = useState(14);
  const [day, setDay] = useState(todayStr());
  const [editing, setEditing] = useState(null);
  const goal = settings.sleepGoal || 7.5;
  const ongoing = sleeps.find((s) => !s.end);
  const days = lastNDays(range);
  const done = sleeps.filter((s) => s.end);

  const stats = useMemo(() => {
    const inRange = done.filter((s) => wakeDay(s) >= days[0]);
    // A sleep counts for the day you woke up from it.
    const perDay = days.map((d) => {
      const byType = Object.fromEntries(SLEEP_TYPE_KEYS.map((k) => [k, 0]));
      sleeps.forEach((s) => { if (wakeDay(s) === d) byType[classify(s, timings)] += durationMin(s); });
      return { d, byType, total: Object.values(byType).reduce((a, b) => a + b, 0) };
    });
    const logged = perDay.filter((x) => x.total > 0);
    const nights = inRange.filter((s) => classify(s, timings) === 'night');
    // Bedtime as minutes after 18:00 so that 23:00 and 01:00 average correctly.
    const bed = nights.map((s) => (minsOf(s.start) - 1080 + 1440) % 1440);
    const wake = nights.map((s) => minsOf(s.end));
    const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
    const sd = (a) => { const m = avg(a); return a.length > 1 ? Math.sqrt(avg(a.map((x) => (x - m) ** 2))) : null; };
    const naps = inRange.filter((s) => classify(s, timings) !== 'night');
    // Nights that covered Fajr time while Fajr wasn't prayed in its time.
    const throughFajr = nights.filter((s) => {
      const d = wakeDay(s);
      const f = new Date(`${d}T${timings?.Fajr || '05:30'}`);
      return new Date(s.start) < f && new Date(s.end) > f && !inTime(prayerLog[d]?.Fajr);
    }).length;
    const last7 = perDay.slice(-7).filter((x) => x.total > 0);
    const debt = last7.reduce((n, x) => n + Math.max(0, goal * 60 - x.total), 0);
    // Does sleep change how often you start what you planned?
    const startRate = (d) => {
      const t = tasks.filter((x) => onDay(x, d) && x.scope !== 'week');
      return t.length ? t.filter((x) => x.started || x.status === 'done').length / t.length : null;
    };
    const good = logged.filter((x) => x.total >= goal * 60 - 30).map((x) => startRate(x.d)).filter((x) => x != null);
    const short = logged.filter((x) => x.total < goal * 60 - 90).map((x) => startRate(x.d)).filter((x) => x != null);
    return {
      perDay, logged, avgTotal: avg(logged.map((x) => x.total)), avgNight: avg(nights.map((s) => durationMin(s))),
      bed: avg(bed), bedSd: sd(bed), wake: avg(wake), naps: naps.length, qaylula: naps.filter((s) => classify(s, timings) === 'qaylula').length,
      throughFajr, debt, good: avg(good), short: avg(short), goodN: good.length, shortN: short.length,
      avgQuality: avg(inRange.filter((s) => s.quality).map((s) => s.quality)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sleeps, range, timings, prayerLog, tasks, goal]);

  const cols = stats.perDay.map((x) => ({
    label: String(Number(x.d.slice(8))), title: fmtDate(x.d, { weekday: 'short', day: 'numeric', month: 'short' }),
    segments: SLEEP_TYPE_KEYS.map((k) => ({ key: k, name: SLEEP_TYPES[k].label, value: Math.round((x.byType[k] / 60) * 10) / 10, color: SLEEP_TYPES[k].color })),
  }));
  const list = [...sleeps].sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12);
  const dayTypes = (d) => sleeps.filter((s) => wakeDay(s) === d || dateOf(s.start) === d);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sleep</h1>
          <div className="sub">Every sleep — night, qaylula, naps — placed against the prayer times.</div>
        </div>
        <div className="row">
          <span className="small muted">Goal</span>
          <Seg value={goal} onChange={(v) => saveSettings({ sleepGoal: v })} options={[6.5, 7, 7.5, 8].map((h) => ({ value: h, label: `${h}h` }))} />
        </div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <NowCard ongoing={ongoing} />
          <div className="card">
            <div className="card-head">
              <h2><BedDouble size={18} /> Sleep diary</h2>
              <Seg value={range} onChange={setRange} options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} />
            </div>
            {sleeps.length === 0 ? <Empty icon={Moon}>Your sleep diary appears here — one row per day, midnight to midnight.</Empty>
              : <Diary days={[...days].reverse()} sleeps={sleeps} timings={timings} />}
          </div>
          <div className="card">
            <div className="card-head"><h2><BarChart3 size={18} /> Hours per day</h2><span className="small muted">goal {goal}h</span></div>
            <Legend items={SLEEP_TYPE_KEYS.map((k) => ({ name: SLEEP_TYPES[k].label, color: SLEEP_TYPES[k].color }))} />
            <div className="mt-1"><BarChart columns={cols} format={(v) => `${v}h`} refLine={{ value: goal, label: `goal ${goal}h` }} emptyText="No sleep logged yet" /></div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h2><Clock3 size={18} /> The day on a clock</h2>
              <div className="row" style={{ gap: 2 }}>
                <button className="icon-btn" onClick={() => setDay(addDays(day, -1))}>‹</button>
                <button className="icon-btn" disabled={day >= todayStr()} onClick={() => setDay(addDays(day, 1))}>›</button>
              </div>
            </div>
            <SleepClock day={day} sleeps={sleeps} timings={timings} />
            <div className="row wrap" style={{ justifyContent: 'center', gap: 6 }}>
              {dayTypes(day).map((s) => {
                const t = classify(s, timings);
                return <span key={s.id} className="chip"><span className="dot" style={{ background: SLEEP_TYPES[t].color }} /> {SLEEP_TYPES[t].label} {timeOf(s.start)}–{s.end ? timeOf(s.end) : 'now'}</span>;
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2><Brain size={18} /> What your sleep says</h2><span className="small muted">last {range} days</span></div>
            {stats.logged.length === 0 ? <p className="small muted">Log a few nights and naps to see averages, consistency and how sleep affects your day.</p> : (
              <div className="stack small" style={{ gap: 9 }}>
                <div className="row between"><span className="muted">Average per day</span><b className={cx(stats.avgTotal < goal * 60 - 30 ? 'warn-text' : 'good-text')}>{fmtDur(stats.avgTotal)}</b></div>
                {stats.avgNight != null && <div className="row between"><span className="muted">Average night</span><b>{fmtDur(stats.avgNight)}</b></div>}
                {stats.bed != null && <div className="row between"><span className="muted">Usual bedtime</span><b>{hhmm(stats.bed + 1080)}{stats.bedSd != null && <span className="muted"> ± {Math.round(stats.bedSd)} min</span>}</b></div>}
                {stats.wake != null && <div className="row between"><span className="muted">Usual wake-up</span><b>{hhmm(stats.wake)}</b></div>}
                <div className="row between"><span className="muted">Naps</span><b>{stats.naps} <span className="muted">({stats.qaylula} qaylula)</span></b></div>
                <div className="row between"><span className="muted">Sleep debt (7 days)</span><b className={cx(stats.debt > 120 && 'warn-text')}>{fmtDur(stats.debt)}</b></div>
                {stats.avgQuality != null && <div className="row between"><span className="muted">Average quality</span><b>{QUALITY[Math.round(stats.avgQuality) - 1]}</b></div>}
                {stats.throughFajr > 0 && <div className="fix small"><AlarmClock size={13} style={{ verticalAlign: -2 }} /> You slept through Fajr <b>{stats.throughFajr}</b> time{stats.throughFajr > 1 ? 's' : ''}. An earlier bedtime is the most reliable alarm.</div>}
                {stats.goodN >= 2 && stats.shortN >= 2 && (
                  <div className="fix small" style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)' }}>
                    After a good night you start <b>{Math.round(stats.good * 100)}%</b> of your planned tasks; after a short one, <b>{Math.round(stats.short * 100)}%</b>.
                  </div>
                )}
                {stats.bedSd > 60 && <p className="tiny muted">Your bedtime moves by more than an hour — a steady bedtime makes waking for Fajr much easier.</p>}
              </div>
            )}
          </div>
          <div className="card">
            <div className="card-head"><h2>Recent sleeps</h2><button className="btn sm" onClick={() => setEditing({})}><Plus size={14} /> Add</button></div>
            {list.length === 0 ? <p className="small muted">Nothing yet.</p> : (
              <div className="stack" style={{ gap: 4 }}>
                {list.map((s) => {
                  const t = classify(s, timings);
                  return (
                    <div key={s.id} className="tx">
                      <span className="tx-icon" style={{ background: SLEEP_TYPES[t].color, color: '#fff' }}>{t === 'night' ? '☾' : '☀'}</span>
                      <div className="grow">
                        <div>{SLEEP_TYPES[t].label} · <span className="nums">{timeOf(s.start)} → {s.end ? timeOf(s.end) : 'now'}</span></div>
                        <div className="tiny muted">{fmtDate(wakeDay(s), { weekday: 'short', day: 'numeric', month: 'short' })}{s.note ? ` · ${s.note}` : ''}</div>
                      </div>
                      <b className="nums">{fmtDur(durationMin(s))}</b>
                      {s.quality && <span>{QUALITY[s.quality - 1]}</span>}
                      <button className="icon-btn" onClick={() => setEditing(s)}><Pencil size={14} /></button>
                      <button className="icon-btn" onClick={() => remove('sleeps', s.id)}><Trash2 size={14} /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit sleep' : 'Add a sleep'}>
        {editing && <SleepForm initial={editing.id ? editing : null} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
