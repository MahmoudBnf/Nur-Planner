import { useEffect, useRef, useState } from 'react';
import { Download, Upload, User, Palette, MapPin, Database, Timer, BellRing, Smartphone } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { CitySearch } from '../components/Prayer.jsx';
import { Seg } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { currentSubscription, disablePush, enablePush, pushSupported } from '../lib/push.js';

// Notifications sent by the PC at prayer times and task times, even when the
// app is closed. Turned on per device (phone, laptop browser…).
function DeviceNotifications() {
  const [on, setOn] = useState(null);
  const [devices, setDevices] = useState([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const refresh = () => {
    currentSubscription().then((s) => setOn(!!s)).catch(() => setOn(false));
    api.get('/api/push/key').then((r) => setDevices(r.devices)).catch(() => {});
  };
  useEffect(refresh, []);
  const run = (fn, done) => async () => {
    setBusy(true); setMsg('');
    try { await fn(); setMsg(done); } catch (e) { setMsg(e.message); }
    setBusy(false); refresh();
  };

  if (!pushSupported()) {
    return <p className="small text-2">This browser can’t receive notifications here. On the phone, open the planner from its <b>https://….ts.net</b> address (not an IP address).</p>;
  }
  return (
    <div className="stack" style={{ gap: 10 }}>
      <p className="small text-2">At each prayer and at each task’s exact time, your PC sends a notification to this device — even when the app is closed, as long as the PC is on with the planner running.</p>
      <div className="row wrap">
        <span className="small">This device: <b className={on ? 'good-text' : ''}>{on == null ? '…' : on ? 'on' : 'off'}</b></span>
        {on ? (
          <>
            <button className="btn sm" disabled={busy} onClick={run(() => api.post('/api/push/test'), 'Test sent — it should arrive in a few seconds.')}>Send a test</button>
            <button className="btn sm ghost" disabled={busy} onClick={run(disablePush, 'Turned off on this device.')}>Turn off</button>
          </>
        ) : <button className="btn sm primary" disabled={busy} onClick={run(enablePush, 'Turned on. Try “Send a test”.')}>Turn on for this device</button>}
      </div>
      {msg && <p className="small">{msg}</p>}
      {devices.length > 0 && <p className="tiny muted">Receiving: {devices.map((d) => d.device || 'a device').join(' · ')}</p>}
    </div>
  );
}

export default function Settings() {
  const { settings, saveSettings } = useData();
  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState('');
  const [perm, setPerm] = useState(window.Notification?.permission || 'unsupported');
  const fileRef = useRef(null);

  useEffect(() => { api.get('/api/info').then(setInfo).catch(() => {}); }, []);

  const importFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm('Replace ALL current data with this backup? (Your current data is backed up first.)')) return;
      await api.post('/api/import', data);
      location.reload();
    } catch (err) {
      setMsg(`Import failed: ${err.message}`);
    }
  };

  return (
    <>
      <div className="page-head"><div><h1>Settings</h1><div className="sub">Everything is stored on your PC — other devices only show it.</div></div></div>
      <div className="grid g-2">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2><User size={18} /> You</h2></div>
            <label className="field">Name (for the greeting)
              <input className="input" value={settings.name || ''} onChange={(e) => saveSettings({ name: e.target.value })} />
            </label>
          </div>
          <div className="card">
            <div className="card-head"><h2><Palette size={18} /> Appearance & week</h2></div>
            <div className="stack" style={{ gap: 12 }}>
              <label className="field">Theme
                <Seg value={settings.theme || 'dark'} onChange={(v) => saveSettings({ theme: v })} options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]} />
              </label>
              <label className="field">Week starts on
                <Seg value={settings.weekStartsOn ?? 1} onChange={(v) => saveSettings({ weekStartsOn: v })}
                  options={[{ value: 6, label: 'Saturday' }, { value: 0, label: 'Sunday' }, { value: 1, label: 'Monday' }]} />
              </label>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2><Timer size={18} /> Focus</h2></div>
            <label className="field">Default session length
              <Seg value={settings.focusDefault || 5} onChange={(v) => saveSettings({ focusDefault: v })}
                options={[5, 10, 25, 45].map((m) => ({ value: m, label: `${m} min` }))} />
            </label>
          </div>
          <div className="card">
            <div className="card-head"><h2><BellRing size={18} /> Reminders & activity</h2></div>
            <div className="stack" style={{ gap: 12 }}>
              <label className="field">Reminders at task times and prayer times
                <Seg value={settings.reminders !== false} onChange={(v) => saveSettings({ reminders: v })} options={[{ value: true, label: 'On' }, { value: false, label: 'Off' }]} />
              </label>
              <div className="row wrap">
                <span className="small text-2">Browser notifications while the app is open: <b>{perm}</b></span>
                {perm === 'default' && <button className="btn sm" onClick={() => Notification.requestPermission().then(setPerm)}>Allow notifications</button>}
                {perm === 'denied' && <span className="tiny muted">Blocked — allow them in the browser’s site settings (lock icon in the address bar).</span>}
              </div>
              <label className="field">Daily activity goal (points)
                <Seg value={settings.activityGoal || 100} onChange={(v) => saveSettings({ activityGoal: v })} options={[60, 100, 150, 200].map((n) => ({ value: n, label: String(n) }))} />
              </label>
              <p className="tiny muted">Tasks give 10 points (the main task 20); routines give what you set. It’s feedback on consistency — not a price for your free time.</p>
            </div>
          </div>
          <div className="card">
            <div className="card-head"><h2><Smartphone size={18} /> Notifications on this device</h2></div>
            <DeviceNotifications />
          </div>
          <div className="card">
            <div className="card-head"><h2><Database size={18} /> Data & backups</h2></div>
            <p className="small text-2">Data file: <code>{info?.dbFile || '…'}</code></p>
            <p className="small muted mt-1">An automatic backup is made every day in <code>server/data/backups</code> (last 14 kept). To move to another PC, export here and import there — or just copy the <code>server/data</code> folder.</p>
            <div className="row mt-2">
              <a className="btn" href="/api/export" download><Download size={16} /> Export backup</a>
              <button className="btn" onClick={() => fileRef.current.click()}><Upload size={16} /> Import backup</button>
              <input ref={fileRef} type="file" accept="application/json" hidden onChange={importFile} />
            </div>
            {msg && <p className="small mt-1" style={{ color: 'var(--bad)' }}>{msg}</p>}
          </div>
        </div>
        <div className="card" style={{ alignSelf: 'start' }}>
          <div className="card-head"><h2><MapPin size={18} /> Location & prayer calculation</h2></div>
          <CitySearch />
        </div>
      </div>
    </>
  );
}
