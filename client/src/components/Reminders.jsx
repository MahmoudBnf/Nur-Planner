// While the app is open: chime + in-app reminder when a task's time arrives and
// at each prayer (with its checkpoint message). Devices that turned on
// notifications get the system notification from the PC instead (server/notify.js).
// Also re-syncs routines when the day changes at midnight.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellRing, X } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { usePrayer } from '../state/PrayerContext.jsx';
import { playChime } from '../state/FocusContext.jsx';
import { PRAYERS, PRAYER_NUDGES } from '../lib/constants.js';
import { nowInTz, onDay, todayStr } from '../lib/utils.js';
import { currentSubscription } from '../lib/push.js';

const hhmm = (secs) => `${String(Math.floor(secs / 3600)).padStart(2, '0')}:${String(Math.floor((secs % 3600) / 60)).padStart(2, '0')}`;

export function Reminders() {
  const { tasks, settings, syncRoutines } = useData();
  const prayer = usePrayer();
  const nav = useNavigate();
  const [toast, setToast] = useState(null);
  const fired = useRef(new Set());
  const day = useRef(todayStr());

  const pushed = useRef(false); // this device already gets the PC's notifications
  useEffect(() => { currentSubscription().then((s) => (pushed.current = !!s)).catch(() => {}); }, []);
  const notify = (n) => {
    playChime();
    setToast(n);
    if (pushed.current) return;
    try { if (window.Notification?.permission === 'granted') new Notification(n.title, { body: n.body, tag: n.key }); } catch { /* ignore */ }
  };

  useEffect(() => {
    const check = () => {
      const today = todayStr();
      if (today !== day.current) { day.current = today; syncRoutines(settings.weekStartsOn ?? 1); }
      if (settings.reminders === false) return;

      const local = hhmm(nowInTz().seconds);
      for (const t of tasks) {
        if (t.time !== local || t.status !== 'todo' || !onDay(t, today)) continue;
        const key = `t:${t.id}:${today}`;
        if (fired.current.has(key)) continue;
        fired.current.add(key);
        return notify({ key, title: `⏰ ${t.title}`, body: t.steps?.find((s) => !s.done)?.text || 'Time to start — five minutes is enough.', taskId: t.id });
      }
      const timings = prayer.day?.timings;
      if (!timings) return;
      const cityNow = hhmm(nowInTz(prayer.timezone).seconds);
      for (const p of PRAYERS) {
        const key = `p:${p}:${prayer.date}`;
        if (timings[p] !== cityNow || fired.current.has(key)) continue;
        fired.current.add(key);
        return notify({ key, title: `🕌 It’s time for ${p}`, body: PRAYER_NUDGES[p] });
      }
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, settings.reminders, settings.weekStartsOn, prayer.day, prayer.date, prayer.timezone]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 30000);
    return () => clearTimeout(t);
  }, [toast]);

  if (!toast) return null;
  return (
    <div className="toast info">
      <BellRing size={20} style={{ color: 'var(--gold)', flexShrink: 0 }} />
      <div className="grow">
        <b>{toast.title}</b>
        <div className="small text-2">{toast.body}</div>
        {toast.taskId && (
          <button className="btn sm primary mt-1" onClick={() => { nav(`/focus?task=${toast.taskId}&min=5`); setToast(null); }}>Start 5 minutes</button>
        )}
      </div>
      <button className="icon-btn" onClick={() => setToast(null)}><X size={16} /></button>
    </div>
  );
}
