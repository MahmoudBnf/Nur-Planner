// Prayer times from the Aladhan API (https://aladhan.com/prayer-times-api),
// city search from Open-Meteo geocoding. Results are cached in the DB so the
// app keeps working offline once a month has been fetched.
import net from 'node:net';
import { getDb, save } from './db.js';

// Node gives each IPv4/IPv6 connection attempt only 250ms by default, which
// makes every request fail with ETIMEDOUT on a slow connection.
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

const ALADHAN = 'https://api.aladhan.com/v1';
const PRAYER_KEYS = ['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Imsak', 'Midnight', 'Lastthird'];

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

export async function searchCities(q) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=10&language=en&format=json`;
  const data = await getJson(url);
  return (data.results || []).map((r) => ({
    name: r.name,
    country: r.country || '',
    region: r.admin1 || '',
    latitude: r.latitude,
    longitude: r.longitude,
    timezone: r.timezone,
  }));
}

let methodsCache = null;
export async function getMethods() {
  if (methodsCache) return methodsCache;
  const data = await getJson(`${ALADHAN}/methods`);
  methodsCache = Object.values(data.data)
    .filter((m) => m && typeof m.id === 'number' && m.id !== 99)
    .map((m) => ({ id: m.id, name: m.name }))
    .sort((a, b) => a.id - b.id);
  return methodsCache;
}

const clean = (t) => (t || '').split(' ')[0];

function simplifyDay(d) {
  const [dd, mm, yyyy] = d.date.gregorian.date.split('-');
  const timings = {};
  for (const k of PRAYER_KEYS) timings[k] = clean(d.timings[k]);
  return {
    date: `${yyyy}-${mm}-${dd}`,
    weekday: d.date.gregorian.weekday.en,
    timings,
    hijri: {
      day: Number(d.date.hijri.day),
      month: d.date.hijri.month.en,
      monthAr: d.date.hijri.month.ar,
      year: d.date.hijri.year,
      weekdayAr: d.date.hijri.weekday.ar,
      holidays: d.date.hijri.holidays || [],
    },
  };
}

export async function getMonth(year, month) {
  const db = getDb();
  const { location, method, school } = db.settings;
  if (!location) {
    const err = new Error('No city selected yet. Choose your city on the Salah page or in Settings.');
    err.status = 400;
    throw err;
  }
  const key = [location.latitude, location.longitude, method, school, year, month].join('|');
  const cached = db.prayerCache[key];
  // Refresh cache after 7 days, but always fall back to it when offline.
  if (cached && Date.now() - cached.fetchedAt < 7 * 864e5) return { ...cached.payload, cached: true };

  try {
    const params = new URLSearchParams({
      latitude: location.latitude,
      longitude: location.longitude,
      school: String(school ?? 0),
    });
    if (method !== 'auto' && method !== '' && method != null) params.set('method', String(method));
    const data = await getJson(`${ALADHAN}/calendar/${year}/${month}?${params}`);
    const days = data.data.map(simplifyDay);
    const meta = data.data[0]?.meta || {};
    const payload = {
      location,
      timezone: meta.timezone || location.timezone,
      method: meta.method ? { id: meta.method.id, name: meta.method.name } : null,
      days,
    };
    db.prayerCache[key] = { fetchedAt: Date.now(), payload };
    // Keep the cache small.
    const keys = Object.keys(db.prayerCache);
    if (keys.length > 24) {
      keys
        .sort((a, b) => db.prayerCache[a].fetchedAt - db.prayerCache[b].fetchedAt)
        .slice(0, keys.length - 24)
        .forEach((k) => delete db.prayerCache[k]);
    }
    save();
    return { ...payload, cached: false };
  } catch (e) {
    if (cached) return { ...cached.payload, cached: true, offline: true };
    throw e;
  }
}

export async function getDay(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  const month = await getMonth(y, m);
  const day = month.days.find((d) => d.date === dateStr);
  return { ...month, days: undefined, day };
}
