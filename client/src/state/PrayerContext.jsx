// Today's (and tomorrow's) prayer times for the chosen city, plus a live
// "next prayer" countdown computed in the city's own timezone.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { useData } from './DataContext.jsx';
import { addDays, minutesOf, nowInTz } from '../lib/utils.js';
import { PRAYERS } from '../lib/constants.js';

const PrayerContext = createContext(null);

export function PrayerProvider({ children }) {
  const { settings } = useData();
  const [state, setState] = useState({ loading: true });
  const [tick, setTick] = useState(0);

  const locKey = settings?.location ? `${settings.location.latitude},${settings.location.longitude}` : '';
  const tz = settings?.location?.timezone;

  const load = useCallback(async () => {
    if (!settings?.location) return setState({ loading: false, noLocation: true });
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const today = nowInTz(tz).date;
      const [a, b] = await Promise.all([
        api.get(`/api/prayer/day?date=${today}`),
        api.get(`/api/prayer/day?date=${addDays(today, 1)}`),
      ]);
      setState({ loading: false, date: today, day: a.day, tomorrow: b.day, timezone: a.timezone, method: a.method, offline: a.offline });
    } catch (e) {
      setState({ loading: false, error: e.message });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locKey, settings?.method, settings?.school, tz]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = nowInTz(tz);
  // Day rolled over → reload.
  useEffect(() => {
    if (state.date && now.date !== state.date) load();
  }, [now.date, state.date, load]);

  const computed = useMemo(() => {
    if (!state.day) return {};
    const t = state.day.timings;
    const list = PRAYERS.map((name) => ({ name, time: t[name], secs: minutesOf(t[name]) * 60 }));
    let next = list.find((p) => p.secs > now.seconds);
    let nextIn;
    let prevSecs;
    if (next) {
      nextIn = next.secs - now.seconds;
      const idx = list.indexOf(next);
      prevSecs = idx > 0 ? list[idx - 1].secs : list[4].secs - 86400;
    } else if (state.tomorrow) {
      const fajr = minutesOf(state.tomorrow.timings.Fajr) * 60;
      next = { name: 'Fajr', time: state.tomorrow.timings.Fajr, tomorrow: true };
      nextIn = 86400 - now.seconds + fajr;
      prevSecs = list[4].secs;
    }
    const current = [...list].reverse().find((p) => p.secs <= now.seconds) || null;
    const span = next ? nextIn + (now.seconds - prevSecs) : 1;
    const progress = next ? 1 - nextIn / span : 0;
    return { list, next, nextIn, current, progress };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.day, state.tomorrow, tick]);

  const value = useMemo(() => ({ ...state, ...computed, reload: load, nowSecs: now.seconds }), [state, computed, load, now.seconds]);
  return <PrayerContext.Provider value={value}>{children}</PrayerContext.Provider>;
}

export const usePrayer = () => useContext(PrayerContext);
