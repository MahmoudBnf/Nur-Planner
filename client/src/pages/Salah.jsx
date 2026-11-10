import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, Moon, RefreshCw, WifiOff, Award, RotateCcw } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { CitySearch, PrayerTracker } from '../components/Prayer.jsx';
import { Modal } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { PRAYERS, PRAYER_AR, PRAYER_STATES, PRAYER_STATE_KEYS, inTime } from '../lib/constants.js';
import { addDays, cx, fmtCountdown, fmtDate, lastNDays, todayStr } from '../lib/utils.js';

function Streaks() {
  const { prayerLog } = useData();
  const days = lastNDays(30);
  // Count back from yesterday (today may still be in progress), include today if complete.
  const complete = (d) => PRAYERS.every((p) => prayerLog[d]?.[p] === 'ontime');
  let streak = 0;
  for (let d = complete(todayStr()) ? todayStr() : addDays(todayStr(), -1); complete(d); d = addDays(d, -1)) streak++;
  const inTimeDays = (() => {
    let n = 0;
    for (let d = addDays(todayStr(), -1); PRAYERS.every((p) => inTime(prayerLog[d]?.[p])); d = addDays(d, -1)) n++;
    return n;
  })();
  const logged = days.flatMap((d) => PRAYERS.map((p) => prayerLog[d]?.[p]).filter(Boolean));
  const count = (k) => logged.filter((x) => x === k).length;

  return (
    <div className="card">
      <div className="card-head"><h2><Award size={18} /> Consistency</h2><span className="small muted">last 30 days</span></div>
      <div className="grid g-2">
        <div className="stat"><span className="label">All five on time</span><span className="value">{streak} <span className="small muted">days</span></span></div>
        <div className="stat"><span className="label">All five within their time</span><span className="value">{inTimeDays} <span className="small muted">days</span></span></div>
      </div>
      <div className="state-bar mt-2" title="Logged prayers by state">
        {PRAYER_STATE_KEYS.map((k) => count(k) > 0 && (
          <div key={k} className={PRAYER_STATES[k].cls} style={{ flex: count(k) }} />
        ))}
      </div>
      <div className="legend mt-1">
        {PRAYER_STATE_KEYS.map((k) => (
          <span key={k}><i className={PRAYER_STATES[k].cls} /> {PRAYER_STATES[k].label} <b className="nums">{count(k)}</b></span>
        ))}
      </div>
      <div className="mt-2" style={{ display: 'grid', gridTemplateColumns: 'repeat(30, 1fr)', gap: 3 }}>
        {days.map((d) => {
          const n = PRAYERS.filter((p) => inTime(prayerLog[d]?.[p])).length;
          const miss = PRAYERS.some((p) => prayerLog[d]?.[p] === 'missed');
          return <div key={d} title={`${d}: ${n}/5 within time${miss ? ' · missed one' : ''}`} style={{ height: 26, borderRadius: 4, outline: miss ? '1.5px solid var(--bad)' : 'none', outlineOffset: -1.5, background: n ? `color-mix(in srgb, var(--accent) ${20 + n * 16}%, var(--surface-3))` : 'var(--surface-3)' }} />;
        })}
      </div>
      <div className="tiny muted mt-1">Each bar is a day; darker = more prayers within their time; red outline = a missed prayer.</div>
    </div>
  );
}

// Every prayer marked "missed" — still owed until it's made up.
function ToMakeUp() {
  const { prayerLog, setEntry } = useData();
  const owed = Object.entries(prayerLog)
    .flatMap(([d, log]) => PRAYERS.filter((p) => log?.[p] === 'missed').map((p) => ({ d, p })))
    .sort((a, b) => a.d.localeCompare(b.d) || PRAYERS.indexOf(a.p) - PRAYERS.indexOf(b.p));
  const madeUp = Object.values(prayerLog).reduce((n, log) => n + PRAYERS.filter((p) => log?.[p] === 'qada').length, 0);

  return (
    <div className={cx('card', owed.length > 0 && 'owed')}>
      <div className="card-head">
        <h2><RotateCcw size={18} /> To make up</h2>
        <span className={cx('badge', owed.length > 0 && 'bad')}>{owed.length}</span>
      </div>
      {owed.length === 0 ? (
        <p className="small muted">Nothing owed{madeUp ? ` — ${madeUp} prayer${madeUp > 1 ? 's' : ''} made up so far, alhamdulillah` : ''}. Prayers marked <b>Missed</b> appear here until you pray them.</p>
      ) : (
        <>
          <p className="small text-2" style={{ marginBottom: 10 }}>Pray them as soon as you can, in order. Tap when done — it becomes <b>Qada’</b>.</p>
          <div className="stack" style={{ gap: 6 }}>
            {owed.slice(0, 12).map(({ d, p }) => (
              <div key={d + p} className="owed-row">
                <span className="ar" style={{ color: 'var(--gold)', fontSize: 17 }}>{PRAYER_AR[p]}</span>
                <span className="grow"><b>{p}</b> <span className="small muted">· {fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span></span>
                <button className="btn sm" onClick={() => setEntry('prayerLog', d, { [p]: 'qada', [`${p}At`]: new Date().toISOString() })}>↺ Made up</button>
              </div>
            ))}
            {owed.length > 12 && <span className="tiny muted">+ {owed.length - 12} more</span>}
          </div>
        </>
      )}
    </div>
  );
}

function MonthTable() {
  const { settings } = useData();
  const prayer = usePrayer();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!settings.location) return;
    setErr('');
    api.get(`/api/prayer/month?year=${ym.y}&month=${ym.m}`).then(setData).catch((e) => setErr(e.message));
  }, [ym, settings.location, settings.method, settings.school]);

  const move = (n) => {
    const d = new Date(ym.y, ym.m - 1 + n, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };
  const today = prayer.date || todayStr();

  return (
    <div className="card">
      <div className="card-head">
        <h2>{new Date(ym.y, ym.m - 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</h2>
        <div className="row">
          <button className="icon-btn" onClick={() => move(-1)}><ChevronLeft size={18} /></button>
          <button className="icon-btn" onClick={() => move(1)}><ChevronRight size={18} /></button>
        </div>
      </div>
      {err && <p className="muted">{err}</p>}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Date</th><th>Hijri</th><th>Fajr</th><th>Sunrise</th><th>Dhuhr</th><th>Asr</th><th>Maghrib</th><th>Isha</th></tr></thead>
            <tbody>
              {data.days.map((d) => (
                <tr key={d.date} className={cx(d.date === today && 'today', d.weekday === 'Friday' && 'friday')}>
                  <td>{d.weekday.slice(0, 3)} {Number(d.date.slice(8))}</td>
                  <td className="muted">{d.hijri.day} {d.hijri.month.split(' ')[0]}{d.hijri.holidays.length > 0 && <span className="holiday" title={d.hijri.holidays.join(', ')}>★ {d.hijri.holidays[0]}</span>}</td>
                  {['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'].map((k) => <td key={k}>{d.timings[k]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Salah() {
  const { settings } = useData();
  const p = usePrayer();
  const [picking, setPicking] = useState(false);

  if (!settings.location) {
    return (
      <>
        <div className="page-head"><div><h1>Salah</h1><div className="sub">Let the five prayers structure your day.</div></div></div>
        <div className="card hero" style={{ maxWidth: 680 }}>
          <div className="card-head"><h2><MapPin size={18} /> Choose your city</h2></div>
          <p className="text-2" style={{ marginBottom: 14 }}>Times are fetched from the Aladhan API and cached locally, so they keep working offline once loaded.</p>
          <CitySearch />
        </div>
      </>
    );
  }

  const t = p.day?.timings || {};
  const cells = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Salah</h1>
          <div className="sub">
            <MapPin size={14} style={{ verticalAlign: -2 }} /> {settings.location.name}, {settings.location.country}
            {p.day && <> · {p.day.hijri.day} {p.day.hijri.month} {p.day.hijri.year} AH · <span className="ar">{p.day.hijri.weekdayAr}</span></>}
          </div>
        </div>
        <div className="row">
          {p.offline && <span className="chip warn"><WifiOff size={12} /> offline — cached times</span>}
          <button className="btn sm" onClick={p.reload}><RefreshCw size={14} /> Refresh</button>
          <button className="btn sm" onClick={() => setPicking(true)}><MapPin size={14} /> Change city</button>
        </div>
      </div>

      {p.error && <div className="card" style={{ marginBottom: 18 }}><p>{p.error}</p></div>}

      <div className="big-prayers">
        {cells.map((name) => {
          const isNext = p.next?.name === name && !p.next?.tomorrow;
          return (
            <div key={name} className={cx('card big-prayer', isNext && 'hero')} style={isNext ? { borderColor: 'var(--accent)' } : name === 'Sunrise' ? { opacity: 0.7 } : undefined}>
              <div className="ar">{PRAYER_AR[name]}</div>
              <div className="small muted">{name}</div>
              <div className="t">{t[name] || '--:--'}</div>
              {isNext && <div className="chip on mt-1">in {fmtCountdown(p.nextIn)}</div>}
            </div>
          );
        })}
      </div>

      <div className="grid g-main mt-3">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2><Moon size={18} /> Today’s tracker</h2><span className="small muted">Click to cycle · right-click for all choices</span></div>
            <PrayerTracker timings={t} />
            <div className="row wrap mt-2 small muted">
              <span>Imsak {t.Imsak}</span>·<span>Midnight {t.Midnight}</span>·<span>Last third of night {t.Lastthird}</span>
            </div>
          </div>
          <MonthTable />
        </div>
        <div className="stack">
          <ToMakeUp />
          <Streaks />
          <div className="card gold">
            <h3>Prayer as checkpoints</h3>
            <ul className="small text-2" style={{ paddingLeft: 18, margin: '8px 0 0' }}>
              <li><b>After Fajr</b> — Qur’an, beneficial reading, or your most important task.</li>
              <li><b>Around Dhuhr</b> — have you started the important thing? If not, begin a short session now.</li>
              <li><b>After Asr</b> — study, work, exercise, practical responsibilities.</li>
              <li><b>Maghrib → Isha</b> — finish what matters, family, prepare tomorrow.</li>
              <li><b>After Isha</b> — free time, games, hobbies, chosen deliberately; then sleep on time.</li>
            </ul>
            <p className="small muted mt-2">If the morning went badly, you haven’t lost the day. The next prayer is another reset point.</p>
          </div>
        </div>
      </div>

      <Modal open={picking} onClose={() => setPicking(false)} title="Change city & method" width={640}>
        <CitySearch onPicked={() => setPicking(false)} />
      </Modal>
    </>
  );
}
