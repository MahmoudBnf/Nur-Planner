import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDb, save, newId, replaceAll, dailyBackup, importBackup,
  LIST_COLLECTIONS, MAP_COLLECTIONS, DB_FILE,
} from './db.js';
import { searchCities, getMethods, getMonth, getDay } from './prayer.js';
import { syncRoutines } from './routines.js';
import { syncRecurring } from './recurring.js';
import { publicKey, subscribe, unsubscribe, subscriptions, sendAll } from './push.js';
import { startNotifier } from './notify.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 4000;
// Only this PC can connect (Tailscale forwards the phone in from here).
// HOST=0.0.0.0 opens it to every network the PC is on — there is no password.
const HOSTS = process.env.HOST ? [process.env.HOST] : ['127.0.0.1', '::1'];
const DIST = path.join(__dirname, '..', 'client', 'dist');

const app = express();
app.use(express.json({ limit: '20mb' }));

const wrap = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((e) => {
    console.error(e.message);
    res.status(e.status || 500).json({ error: e.message });
  });

// ---------- settings ----------
app.get('/api/settings', (req, res) => res.json(getDb().settings));
app.put('/api/settings', (req, res) => {
  const db = getDb();
  db.settings = { ...db.settings, ...req.body };
  save();
  res.json(db.settings);
});

// ---------- prayer ----------
app.get('/api/prayer/search', wrap(async (req, res) => res.json(await searchCities(req.query.q || ''))));
app.get('/api/prayer/methods', wrap(async (req, res) => res.json(await getMethods())));
app.get('/api/prayer/month', wrap(async (req, res) => {
  res.json(await getMonth(Number(req.query.year), Number(req.query.month)));
}));
app.get('/api/prayer/day', wrap(async (req, res) => res.json(await getDay(req.query.date))));

// ---------- routines → today's tasks, recurring money → transactions ----------
app.post(['/api/sync', '/api/routines/sync'], (req, res) => {
  const { today, weekStartsOn } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today || '')) return res.status(400).json({ error: 'today must be YYYY-MM-DD' });
  res.json({ ...syncRoutines(today, Number(weekStartsOn ?? 1)), transactions: syncRecurring(today).created });
});

// ---------- Qur'an revision state (one document) ----------
app.get('/api/quran', (req, res) => res.json(getDb().quran));
// Every change carries the revision (_rev) it was computed from: a tab or device
// holding an older copy is refused instead of writing stale pointers back.
app.put('/api/quran', (req, res) => {
  const db = getDb();
  const { _rev, ...patch } = req.body || {};
  const rev = db.quran._rev || 0;
  if (_rev != null && _rev !== rev) {
    return res.status(409).json({ error: "Your Qur'an data was changed in another tab or device. This page now shows the latest — please redo your last step.", quran: db.quran });
  }
  db.quran = { ...db.quran, ...patch, _rev: rev + 1 };
  save();
  res.json(db.quran);
});

// ---------- phone notifications (Web Push) ----------
app.get('/api/push/key', (req, res) => res.json({ key: publicKey(), devices: subscriptions().map((s) => ({ device: s.device, createdAt: s.createdAt })) }));
app.post('/api/push/subscribe', wrap(async (req, res) => { subscribe(req.body?.subscription, req.body?.device); res.json({ ok: true }); }));
app.post('/api/push/unsubscribe', (req, res) => { unsubscribe(req.body?.endpoint); res.json({ ok: true }); });
app.post('/api/push/test', wrap(async (req, res) => {
  const results = await sendAll({ title: '🌙 Nur Planner', body: 'Notifications work on this device.', tag: 'test', url: '/settings' });
  res.json({ results });
}));

// ---------- backup / export ----------
app.get('/api/export', (req, res) => {
  const { prayerCache, push, ...data } = getDb();
  res.setHeader('Content-Disposition', `attachment; filename="nur-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
});
app.post('/api/import', (req, res) => {
  const b = req.body;
  if (!b || typeof b !== 'object' || !b.settings
    || LIST_COLLECTIONS.some((c) => c in b && !Array.isArray(b[c]))
    || MAP_COLLECTIONS.some((c) => c in b && (typeof b[c] !== 'object' || Array.isArray(b[c])))) {
    return res.status(400).json({ error: 'This does not look like a Nur backup file.' });
  }
  importBackup();
  replaceAll({ ...b, push: getDb().push }); // this PC's notification keys and devices stay
  res.json({ ok: true });
});
app.get('/api/info', (req, res) => res.json({ dbFile: DB_FILE }));

// ---------- map collections (keyed by date) ----------
app.get('/api/map/:col', (req, res) => {
  if (!MAP_COLLECTIONS.includes(req.params.col)) return res.status(404).json({ error: 'Unknown collection' });
  res.json(getDb()[req.params.col]);
});
app.put('/api/map/:col/:key', (req, res) => {
  const { col, key } = req.params;
  if (!MAP_COLLECTIONS.includes(col)) return res.status(404).json({ error: 'Unknown collection' });
  const db = getDb();
  db[col][key] = { ...(db[col][key] || {}), ...req.body, updatedAt: new Date().toISOString() };
  save();
  res.json(db[col][key]);
});

// ---------- list collections ----------
const checkList = (req, res, next) =>
  LIST_COLLECTIONS.includes(req.params.col) ? next() : res.status(404).json({ error: 'Unknown collection' });

app.get('/api/:col', checkList, (req, res) => res.json(getDb()[req.params.col]));
app.post('/api/:col', checkList, (req, res) => {
  const db = getDb();
  const item = { ...req.body, id: newId(), createdAt: new Date().toISOString() };
  db[req.params.col].push(item);
  save();
  res.status(201).json(item);
});
app.patch('/api/:col/:id', checkList, (req, res) => {
  const list = getDb()[req.params.col];
  const item = list.find((x) => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  Object.assign(item, req.body, { id: item.id, updatedAt: new Date().toISOString() });
  save();
  res.json(item);
});
app.delete('/api/:col/:id', checkList, (req, res) => {
  const db = getDb();
  db[req.params.col] = db[req.params.col].filter((x) => x.id !== req.params.id);
  save();
  res.json({ ok: true });
});

// ---------- built React app (production) ----------
if (fs.existsSync(DIST)) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
} else {
  app.get('/', (req, res) =>
    res.send('API is running. The UI is not built yet: run <code>npm run build</code>, or use <code>npm run dev</code> and open http://localhost:5173'),
  );
}

getDb();
dailyBackup();
startNotifier();
HOSTS.forEach((host, i) => {
  const server = app.listen(PORT, host, () => {
    if (i) return;
    console.log(`\n  Nur planner running →  http://localhost:${PORT}${process.env.HOST ? `  (open on ${host})` : '  (this PC only)'}`);
    console.log(`  Data file           →  ${DB_FILE}\n`);
  });
  // ::1 doesn't exist on PCs without IPv6; 127.0.0.1 is enough there.
  if (i) server.on('error', () => {});
});
