// Tiny JSON-file database. Everything lives in server/data/db.json so it is
// easy to back up, copy to another PC, or read by hand.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.NUR_DATA_DIR || path.join(__dirname, 'data');
export const DB_FILE = path.join(DATA_DIR, 'db.json');
export const BACKUP_DIR = path.join(DATA_DIR, 'backups');

// Array collections: each item has an `id`.
export const LIST_COLLECTIONS = ['tasks', 'weeklyGoals', 'ideas', 'avoidances', 'focusSessions', 'newThings', 'routines', 'transactions', 'quranLogs', 'sleeps', 'recurring'];
// Map collections: keyed by date (YYYY-MM-DD).
export const MAP_COLLECTIONS = ['reviews', 'prayerLog', 'challengeDays'];

const DEFAULTS = () => ({
  settings: {
    name: '',
    theme: 'dark',
    location: null, // { name, country, latitude, longitude, timezone }
    method: 'auto', // Aladhan calculation method id, or 'auto'
    school: 0, // 0 = Shafi/Maliki/Hanbali, 1 = Hanafi (Asr)
    challengeStart: null,
    focusDefault: 5,
    activityGoal: 100,
    reminders: true,
    currency: '', // empty = guessed from the city's country
    monthlyBudget: 0,
    sleepGoal: 7.5, // hours per day
  },
  tasks: [],
  weeklyGoals: [],
  ideas: [],
  avoidances: [],
  focusSessions: [],
  newThings: [],
  routines: [],
  transactions: [],
  recurring: [], // repeating money: salary, subscriptions…
  recurringKeys: {}, // occurrences already logged, so deleted ones never come back
  quran: {}, // revision state: tier of each thumun, cycle positions, last revision dates
  quranLogs: [],
  sleeps: [],
  routineKeys: {}, // instance keys already created, so deleted ones never come back
  reviews: {},
  prayerLog: {},
  challengeDays: {},
  prayerCache: {},
});

let db = null;

function load() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    db = DEFAULTS();
    save();
    return;
  }
  const raw = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  const base = DEFAULTS();
  db = { ...base, ...raw, settings: { ...base.settings, ...(raw.settings || {}) } };
}

export function save() {
  // The day's backup is taken before its first change, even if the server runs for days.
  if (db && fs.existsSync(DB_FILE) && !fs.existsSync(backupFile())) dailyBackup();
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  // On Windows an antivirus or the search indexer can hold db.json for a moment.
  for (let i = 0; ; i++) {
    try { fs.renameSync(tmp, DB_FILE); return; } catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code)) throw e;
      if (i === 5) { fs.copyFileSync(tmp, DB_FILE); fs.rmSync(tmp, { force: true }); return; }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

export function getDb() {
  if (!db) load();
  return db;
}

export function newId() {
  return crypto.randomUUID();
}

export function replaceAll(data) {
  const base = DEFAULTS();
  db = { ...base, ...data, settings: { ...base.settings, ...(data.settings || {}) } };
  save();
}

// One automatic backup per day, keeping the last 14.
const backupFile = () => {
  const d = new Date();
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return path.join(BACKUP_DIR, `db-${day}.json`);
};
export function dailyBackup() {
  getDb();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = backupFile();
  if (!fs.existsSync(file)) fs.copyFileSync(DB_FILE, file);
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('db-')).sort();
  for (const old of files.slice(0, Math.max(0, files.length - 14))) {
    fs.unlinkSync(path.join(BACKUP_DIR, old));
  }
  return file;
}

// A copy of the data just before it is replaced by an import (keeps the last 10).
export function importBackup() {
  getDb();
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const file = path.join(BACKUP_DIR, `import-${stamp}.json`);
  if (fs.existsSync(DB_FILE)) fs.copyFileSync(DB_FILE, file);
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith('import-')).sort();
  for (const old of files.slice(0, Math.max(0, files.length - 10))) fs.unlinkSync(path.join(BACKUP_DIR, old));
  return file;
}
