import { useEffect, useState } from 'react';
import { MapPin, Search } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { api } from '../lib/api.js';
import { PRAYERS, PRAYER_STATES, PRAYER_STATE_KEYS } from '../lib/constants.js';
import { cx, minutesOf, todayStr } from '../lib/utils.js';

// Five cells; a click cycles on time → late → qada' → missed → cleared, and a
// right-click (long-press on touch) opens the menu with explanations. On today,
// a prayer whose time has come but isn't logged is shown as "not logged yet".
export function PrayerTracker({ date = todayStr(), timings }) {
  const { prayerLog, setEntry } = useData();
  const prayer = usePrayer();
  const [menu, setMenu] = useState(null);
  const log = prayerLog[date] || {};
  const isToday = date === (prayer.date || todayStr());
  const isPast = date < (prayer.date || todayStr());

  useEffect(() => {
    if (!menu) return;
    const close = (e) => !e.target.closest('.prayer-menu, .prayer-cell') && setMenu(null);
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [menu]);

  const due = (p) => isPast || (isToday && timings?.[p] && prayer.nowSecs >= minutesOf(timings[p]) * 60);
  const pick = (p, st) => {
    // Keep the first logging time while cycling through states.
    setEntry('prayerLog', date, { [p]: st, [`${p}At`]: st ? log[`${p}At`] || new Date().toISOString() : null });
    setMenu(null);
  };
  const cycle = (p) => {
    const i = PRAYER_STATE_KEYS.indexOf(log[p]);
    pick(p, i === PRAYER_STATE_KEYS.length - 1 ? null : PRAYER_STATE_KEYS[i + 1]);
  };

  return (
    <div className="prayer-row">
      {PRAYERS.map((p) => {
        const st = log[p];
        const pending = !st && due(p);
        return (
          <div key={p} style={{ position: 'relative' }}>
            <div className={cx('prayer-cell', st, pending && 'pending', isToday && prayer.next?.name === p && !prayer.next?.tomorrow && 'is-next')}
              onClick={() => cycle(p)} onContextMenu={(e) => { e.preventDefault(); setMenu(menu === p ? null : p); }}
              title={`${st ? PRAYER_STATES[st].hint : 'Click to log'} · right-click for all choices`}>
              <div className="p-name">{p}</div>
              <div className="p-time">{timings?.[p] || '--:--'}</div>
              <div className="p-state">{st ? PRAYER_STATES[st].label : pending ? 'not logged' : <span className="muted">upcoming</span>}</div>
            </div>
            {menu === p && (
              <div className="prayer-menu">
                {PRAYER_STATE_KEYS.map((k) => (
                  <button key={k} className={cx(PRAYER_STATES[k].cls, st === k && 'on')} onClick={() => pick(p, k)}>
                    <span className="sym">{PRAYER_STATES[k].short}</span>
                    <span><b>{PRAYER_STATES[k].label}</b><small>{PRAYER_STATES[k].hint}</small></span>
                  </button>
                ))}
                {st && <button className="clear" onClick={() => pick(p, null)}>Clear</button>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CitySearch({ onPicked }) {
  const { settings, saveSettings } = useData();
  const prayer = usePrayer();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [methods, setMethods] = useState([]);

  useEffect(() => { api.get('/api/prayer/methods').then(setMethods).catch(() => {}); }, []);

  const search = async (e) => {
    e?.preventDefault();
    if (!q.trim()) return;
    setBusy(true); setErr('');
    try {
      const r = await api.get(`/api/prayer/search?q=${encodeURIComponent(q.trim())}`);
      setResults(r);
      if (!r.length) setErr('No city found — try another spelling (English names work best).');
    } catch (e2) { setErr(e2.message); }
    setBusy(false);
  };

  const pick = async (loc) => {
    await saveSettings({ location: loc });
    setResults([]); setQ('');
    prayer.reload();
    onPicked?.();
  };

  const setMethod = async (patch) => { await saveSettings(patch); prayer.reload(); };

  return (
    <div className="stack" style={{ gap: 12 }}>
      {settings.location && (
        <div className="row"><MapPin size={16} className="muted" /> <b>{settings.location.name}</b>
          <span className="muted">{[settings.location.region, settings.location.country].filter(Boolean).join(', ')} · {settings.location.timezone}</span>
        </div>
      )}
      <form className="row" onSubmit={search}>
        <input className="input" placeholder="Search your city (e.g. Rabat, Algiers, Paris)…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn primary" disabled={busy}><Search size={16} /> {busy ? 'Searching…' : 'Search'}</button>
      </form>
      {err && <div className="small" style={{ color: 'var(--bad)' }}>{err}</div>}
      {results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button key={i} onClick={() => pick(r)}>
              <b>{r.name}</b> <span className="muted">— {[r.region, r.country].filter(Boolean).join(', ')}</span>
            </button>
          ))}
        </div>
      )}
      <div className="grid g-2" style={{ gap: 10 }}>
        <label className="field">Calculation method
          <select className="select" value={String(settings.method)} onChange={(e) => setMethod({ method: e.target.value === 'auto' ? 'auto' : Number(e.target.value) })}>
            <option value="auto">Auto — nearest authority for this location</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <label className="field">Asr calculation
          <select className="select" value={settings.school} onChange={(e) => setMethod({ school: Number(e.target.value) })}>
            <option value={0}>Standard (Shafi'i, Maliki, Hanbali)</option>
            <option value={1}>Hanafi</option>
          </select>
        </label>
      </div>
      {prayer.method && <div className="tiny muted">Using: {prayer.method.name}</div>}
    </div>
  );
}
