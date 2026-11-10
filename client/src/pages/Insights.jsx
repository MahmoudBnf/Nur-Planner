import { useState } from 'react';
import { BarChart3, Timer, ListChecks, LifeBuoy, Scale, Repeat } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { BarChart, HBars, Legend } from '../components/Charts.jsx';
import { Seg } from '../components/ui.jsx';
import { AVOID_REASONS, CATEGORIES, CATEGORY_KEYS, PRAYERS, inTime } from '../lib/constants.js';
import { fmtDate, lastNDays, parseDate } from '../lib/utils.js';

const STATUS_SERIES = [
  { key: 'done', name: 'Done', color: 'var(--good)' },
  { key: 'partial', name: 'Partly', color: 'var(--warn)' },
  { key: 'notdone', name: 'Not done', color: 'var(--bad)' },
  { key: 'todo', name: 'Not verified', color: 'var(--muted)' },
];

function Kpi({ label, value, hint }) {
  return <div className="card"><div className="stat"><span className="label">{label}</span><span className="value">{value}</span>{hint && <span className="hint">{hint}</span>}</div></div>;
}

export default function Insights() {
  const { tasks, focusSessions, prayerLog, reviews, avoidances, routines } = useData();
  const [range, setRange] = useState(14);
  const days = lastNDays(range);
  const inRange = (d) => d >= days[0] && d <= days[days.length - 1];

  const t = tasks.filter((x) => inRange(x.date));
  const started = t.filter((x) => x.started || x.status === 'done' || x.status === 'partial').length;
  const done = t.filter((x) => x.status === 'done').length;
  const fs = focusSessions.filter((x) => inRange(x.date));
  const focusMin = fs.reduce((n, x) => n + (x.minutes || 0), 0);
  const prayers = days.flatMap((d) => PRAYERS.map((p) => prayerLog[d]?.[p]).filter(Boolean));
  const ontime = prayers.filter(inTime).length;
  const owed = prayers.filter((x) => x === 'missed').length;
  const reviewed = days.filter((d) => reviews[d] && (reviews[d].started || reviews[d].tomorrow || reviews[d].mood)).length;
  const av = avoidances.filter((x) => inRange(x.date));

  const label = (d) => range > 14 ? String(Number(d.slice(8))) : parseDate(d).toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 2) + ' ' + Number(d.slice(8));

  const focusCols = days.map((d) => ({
    label: label(d), title: fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }),
    segments: [{ key: 'm', name: 'Minutes', value: Math.round(fs.filter((x) => x.date === d).reduce((n, x) => n + x.minutes, 0)), color: 'var(--cat-1)' }],
  }));
  const taskCols = days.map((d) => ({
    label: label(d), title: fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }),
    segments: STATUS_SERIES.map((s) => ({ ...s, value: t.filter((x) => x.date === d && (x.status || 'todo') === s.key).length })),
  }));

  const reasonRows = Object.entries(AVOID_REASONS)
    .map(([k, r]) => ({ key: k, label: r.label, value: av.filter((a) => a.reason === k).length }))
    .sort((a, b) => b.value - a.value);
  const top = reasonRows[0]?.value ? AVOID_REASONS[reasonRows[0].key] : null;
  const recovered = av.filter((a) => a.outcome === 'started').length;

  const catRows = CATEGORY_KEYS.map((k) => ({
    label: CATEGORIES[k].label, color: CATEGORIES[k].color,
    value: t.filter((x) => x.category === k && x.status === 'done').length,
  }));

  // Routine consistency: share of past occurrences in range that were done.
  const routineRows = routines.map((r) => {
    // Count finished occurrences, plus today's if already done.
    const occ = t.filter((x) => x.routineId === r.id && (x.status === 'done' || (x.until || x.date) < days[days.length - 1]));
    const ok = occ.filter((x) => x.status === 'done').length;
    return { label: r.title, value: occ.length ? Math.round((ok / occ.length) * 100) : 0, color: CATEGORIES[r.category]?.color, n: occ.length };
  }).filter((r) => r.n > 0).sort((a, b) => b.value - a.value);

  const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '—');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Insights</h1>
          <div className="sub">The metric that matters most: <b>how often you start</b> what you intended.</div>
        </div>
        <Seg value={range} onChange={setRange} options={[{ value: 7, label: '7 days' }, { value: 14, label: '14 days' }, { value: 30, label: '30 days' }]} />
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <Kpi label="Start rate" value={pct(started, t.length)} hint={`${started}/${t.length} planned tasks started`} />
        <Kpi label="Completion" value={pct(done, t.length)} hint={`${done} tasks done`} />
        <Kpi label="Focused time" value={`${Math.round(focusMin / 6) / 10}h`} hint={`${fs.length} sessions`} />
        <Kpi label="Salah within its time" value={pct(ontime, prayers.length)} hint={owed ? `${owed} still to make up · ${reviewed}/${range} days reviewed` : `${reviewed}/${range} days reviewed`} />
      </div>

      <div className="grid g-2">
        <div className="card">
          <div className="card-head"><h2><Timer size={18} /> Focus minutes per day</h2></div>
          <BarChart columns={focusCols} format={(v) => `${v}`} emptyText="No focus sessions in this range" />
        </div>
        <div className="card">
          <div className="card-head"><h2><ListChecks size={18} /> Tasks by verified status</h2></div>
          <Legend items={STATUS_SERIES} />
          <div className="mt-1"><BarChart columns={taskCols} emptyText="No tasks in this range" /></div>
        </div>
        <div className="card">
          <div className="card-head"><h2><LifeBuoy size={18} /> Why you avoid</h2><span className="small muted">{av.length} rescues · {recovered} restarted</span></div>
          {av.length === 0 ? <p className="muted small">Use “I’m avoiding something” on the Focus page — patterns appear here.</p> : (
            <>
              <HBars rows={reasonRows} />
              {top && <div className="fix small mt-2"><b>Your most common: {top.label}.</b> {top.fix}</div>}
            </>
          )}
        </div>
        <div className="card">
          <div className="card-head"><h2><Scale size={18} /> Balance of completed tasks</h2></div>
          <HBars rows={catRows} />
          <p className="small muted mt-2">Obligations first, then rights and duties, then growth — and rest without guilt. A healthy week has all four.</p>
        </div>
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <div className="card-head"><h2><Repeat size={18} /> Routine consistency</h2><span className="small muted">% of occurrences done</span></div>
          {routineRows.length === 0 ? <p className="muted small">Set up dailies & weeklies on the Routines page — their consistency shows up here.</p>
            : <HBars rows={routineRows} format={(v) => `${v}%`} />}
        </div>
      </div>
      {t.length === 0 && fs.length === 0 && (
        <p className="center muted mt-3"><BarChart3 size={16} style={{ verticalAlign: -3 }} /> Use the app for a few days and this page will fill up.</p>
      )}
    </>
  );
}
