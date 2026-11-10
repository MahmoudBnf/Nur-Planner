// Runs on the PC while the server is up, whether or not any page is open:
// - at a new day, creates the day's routine tasks (so their reminders exist);
// - at each prayer time and at each task's exact time, sends a notification
//   to every device that turned them on (Settings → Notifications).
import { getDb } from './db.js';
import { getDay } from './prayer.js';
import { syncRoutines } from './routines.js';
import { sendAll, subscriptions } from './push.js';
import { PRAYERS, PRAYER_NUDGES } from '../shared/reminders.js';

const pad = (n) => String(n).padStart(2, '0');
// Date and HH:MM as seen in a timezone (the PC's own when tz is empty).
function clock(tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: tz || undefined, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
const localDate = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const onDay = (t, d) => (t.until ? t.date <= d && d <= t.until : t.date === d);

const sent = new Set(); // keys already notified (this run)
let day = null;

async function tick() {
  const db = getDb();
  const today = localDate();
  if (today !== day) {
    day = today;
    sent.clear();
    syncRoutines(today, Number(db.settings.weekStartsOn ?? 1));
  }
  if (db.settings.reminders === false || !subscriptions().length) return;
  const now = clock();

  for (const t of db.tasks) {
    if (!t.time || t.time !== now.time || t.status !== 'todo' || !onDay(t, today)) continue;
    const key = `t:${t.id}:${today}`;
    if (sent.has(key)) continue;
    sent.add(key);
    const step = (t.steps || []).find((s) => !s.done && s.text)?.text;
    await sendAll({ title: `⏰ ${t.title}`, body: step || 'Time to start — five minutes is enough.', tag: key, url: `/focus?task=${t.id}&min=5` });
  }

  const loc = db.settings.location;
  if (!loc) return;
  const city = clock(loc.timezone);
  const timings = (await getDay(city.date).catch(() => null))?.day?.timings;
  for (const p of PRAYERS) {
    const key = `p:${p}:${city.date}`;
    if (timings?.[p] !== city.time || sent.has(key)) continue;
    sent.add(key);
    await sendAll({ title: `🕌 It’s time for ${p}`, body: PRAYER_NUDGES[p], tag: key, url: '/salah' });
  }
}

export function startNotifier() {
  const run = () => tick().catch((e) => console.error('notifier:', e.message));
  run();
  setInterval(run, 20000);
}
