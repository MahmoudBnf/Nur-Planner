// The focus timer lives at the app level so it keeps running while you move
// between pages, and survives a page reload (state mirrored in localStorage).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useData } from './DataContext.jsx';
import { todayStr } from '../lib/utils.js';

const KEY = 'nur.focus';
const FocusContext = createContext(null);

const readStored = () => {
  try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; }
};

export function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1.3);
    });
  } catch { /* audio not available */ }
}

export function FocusProvider({ children }) {
  const { add, update, tasks, newThings } = useData();
  // session: { label, taskId, newThingId, kind, durationSec, endAt, pausedLeft, startedAt }
  const [session, setSession] = useState(readStored);
  const [finished, setFinished] = useState(null);
  const [, force] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    try { session ? localStorage.setItem(KEY, JSON.stringify(session)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
  }, [session]);

  const remaining = session
    ? session.pausedLeft != null ? session.pausedLeft : Math.max(0, (session.endAt - Date.now()) / 1000)
    : 0;

  const log = useCallback((s, spentSec) => {
    const minutes = Math.round((spentSec / 60) * 10) / 10;
    if (minutes < 0.5) return;
    add('focusSessions', { date: todayStr(), label: s.label, taskId: s.taskId || null, kind: s.kind || 'focus', minutes, startedAt: s.startedAt });
    if (s.taskId) {
      const t = tasks.find((x) => x.id === s.taskId);
      if (t) update('tasks', t.id, { started: true, focusMinutes: Math.round(((t.focusMinutes || 0) + minutes) * 10) / 10 });
    }
    if (s.newThingId) {
      const n = newThings.find((x) => x.id === s.newThingId);
      if (n) update('newThings', n.id, { status: n.status === 'waiting' ? 'tried' : n.status, triedAt: n.triedAt || todayStr(), minutes: (n.minutes || 0) + minutes });
    }
  }, [add, update, tasks, newThings]);

  useEffect(() => {
    if (!session || session.pausedLeft != null) return;
    doneRef.current = false;
    const t = setInterval(() => {
      force((n) => n + 1);
      if (!doneRef.current && Date.now() >= session.endAt) {
        doneRef.current = true;
        playChime();
        log(session, session.durationSec);
        setFinished(session);
        setSession(null);
        if (window.Notification?.permission === 'granted') new Notification('Focus session complete', { body: session.label || 'Well done — you started!' });
      }
    }, 250);
    return () => clearInterval(t);
  }, [session, log]);

  const start = useCallback(({ minutes, label, taskId, newThingId, kind }) => {
    try { if (window.Notification && Notification.permission === 'default') Notification.requestPermission(); } catch { /* ignore */ }
    const durationSec = Math.round(minutes * 60);
    setFinished(null);
    setSession({ label, taskId, newThingId, kind, durationSec, endAt: Date.now() + durationSec * 1000, startedAt: new Date().toISOString() });
  }, []);

  const pause = () => setSession((s) => s && { ...s, pausedLeft: Math.max(0, (s.endAt - Date.now()) / 1000) });
  const resume = () => setSession((s) => s && { ...s, endAt: Date.now() + s.pausedLeft * 1000, pausedLeft: null });
  const stop = () => {
    if (session) {
      log(session, session.durationSec - remaining);
      setFinished({ ...session, stoppedEarly: true });
    }
    setSession(null);
  };
  const cancel = () => setSession(null);

  return (
    <FocusContext.Provider value={{ session, remaining, finished, clearFinished: () => setFinished(null), start, pause, resume, stop, cancel }}>
      {children}
    </FocusContext.Provider>
  );
}

export const useFocus = () => useContext(FocusContext);
