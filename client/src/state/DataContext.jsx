// All app data is small, so it is loaded once at startup and kept in memory.
// Updates are optimistic: the UI changes immediately, the server is told after.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { todayStr } from '../lib/utils.js';

const LISTS = ['tasks', 'weeklyGoals', 'ideas', 'avoidances', 'focusSessions', 'newThings', 'routines', 'transactions', 'quranLogs', 'sleeps', 'recurring'];
const MAPS = ['reviews', 'prayerLog', 'challengeDays'];

const DataContext = createContext(null);

// Typing in a remark field fires many updates; merge them and send one
// request after a short pause (or immediately when the tab is closing).
const pending = new Map();
function debounced(key, patch, send) {
  const p = pending.get(key) || { patch: {}, send };
  clearTimeout(p.timer);
  p.patch = { ...p.patch, ...patch };
  p.timer = setTimeout(() => flush(key), 400);
  pending.set(key, p);
}
function flush(key, drop = false) {
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(key);
  return drop ? undefined : p.send(p.patch);
}
const flushAll = () => Promise.all([...pending.keys()].map((k) => flush(k)));

// Ask the server to turn routines into today's tasks.
const requestSync = (weekStartsOn) => api.post('/api/sync', { today: todayStr(), weekStartsOn: weekStartsOn ?? 1 });
const applySync = (tasks, r) => {
  const upd = new Map(r.updated.map((t) => [t.id, t]));
  return [...tasks.filter((t) => !r.removed.includes(t.id)).map((t) => upd.get(t.id) || t), ...r.created];
};
window.addEventListener('beforeunload', () => [...pending.keys()].forEach((k) => flush(k)));

async function loadAll() {
  const settings = await api.get('/api/settings');
  await requestSync(settings.weekStartsOn).catch(() => {});
  const lists = await Promise.all(LISTS.map((c) => api.get(`/api/${c}`)));
  const maps = await Promise.all(MAPS.map((c) => api.get(`/api/map/${c}`)));
  const next = { settings, quran: await api.get('/api/quran') };
  LISTS.forEach((c, i) => (next[c] = lists[i]));
  MAPS.forEach((c, i) => (next[c] = maps[i]));
  return next;
}

export function DataProvider({ children }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const rev = useRef(0); // the Qur'an document revision this tab last saw

  // Reload everything from the server (sending pending edits first): when the
  // tab comes back after a while, when the date changes while it stays open
  // (so the new day's routines appear), and after a conflict with another tab.
  const reload = useCallback(async () => {
    try {
      await flushAll();
      const next = await loadAll();
      rev.current = next.quran._rev || 0;
      setData(next);
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    let day = todayStr();
    let hiddenAt = null;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 30000) { hiddenAt = null; day = todayStr(); reload(); }
    };
    const t = setInterval(() => { if (todayStr() !== day) { day = todayStr(); reload(); } }, 30000);
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [reload]);

  const fail = (e) => setError(e.message);

  const add = useCallback(async (col, item) => {
    const created = await api.post(`/api/${col}`, item);
    setData((d) => ({ ...d, [col]: [...d[col].filter((x) => x.id !== created.id), created] }));
    return created;
  }, []);

  const update = useCallback((col, id, patch) => {
    setData((d) => ({ ...d, [col]: d[col].map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
    debounced(`${col}/${id}`, patch, (p) => api.patch(`/api/${col}/${id}`, p).catch(fail));
  }, []);

  const remove = useCallback((col, id) => {
    setData((d) => ({ ...d, [col]: d[col].filter((x) => x.id !== id) }));
    flush(`${col}/${id}`, true);
    return api.del(`/api/${col}/${id}`).catch(fail);
  }, []);

  const syncRoutines = useCallback(async (weekStartsOn) => {
    await flushAll();
    const r = await requestSync(weekStartsOn).catch((e) => { fail(e); return null; });
    if (r && (r.created.length || r.updated.length || r.removed.length)) {
      setData((d) => ({ ...d, tasks: applySync(d.tasks, r) }));
    }
    if (r?.transactions?.length) setData((d) => ({ ...d, transactions: [...d.transactions, ...r.transactions] }));
  }, []);

  const setEntry = useCallback((col, key, patch) => {
    setData((d) => ({ ...d, [col]: { ...d[col], [key]: { ...(d[col][key] || {}), ...patch } } }));
    debounced(`map/${col}/${key}`, patch, (p) => api.put(`/api/map/${col}/${key}`, p).catch(fail));
  }, []);

  // The Qur'an revision state is one document; callers pass the fields that changed.
  // Resolves to false (and reloads) if another tab or device changed it first.
  const saveQuran = useCallback((patch) => {
    const base = rev.current++;
    setData((d) => ({ ...d, quran: { ...d.quran, ...patch } }));
    return api.put('/api/quran', { ...patch, _rev: base }).then(() => true, (e) => {
      if (e.status === 409) reload();
      fail(e);
      return false;
    });
  }, [reload]);

  const saveSettings = useCallback((patch) => {
    setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
    return api.put('/api/settings', patch).catch(fail);
  }, []);

  const value = useMemo(
    () => ({ ...data, ready: !!data, error, clearError: () => setError(null), add, update, remove, setEntry, saveSettings, syncRoutines, saveQuran, reload }),
    [data, error, add, update, remove, setEntry, saveSettings, syncRoutines, saveQuran, reload],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useData = () => useContext(DataContext);
