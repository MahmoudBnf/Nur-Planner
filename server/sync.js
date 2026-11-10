// Copy the data between this PC and the PC that runs the planner, over Tailscale.
//
//   npm run pull-data -- https://<server-pc>.<tailnet>.ts.net   server PC → this PC
//   npm run push-data                                           this PC → server PC
//
// The address is remembered after the first use. Each side keeps a backup of what
// it had before being replaced. Both commands refuse to overwrite changes the other
// side made since the last pull/push (add --force to do it anyway).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, DB_FILE, LIST_COLLECTIONS, getDb, importBackup, replaceAll } from './db.js';

const STATE_FILE = path.join(DATA_DIR, 'sync.json');
const PORT = Number(process.env.PORT) || 4000;
const [mode, ...rest] = process.argv.slice(2);
const force = rest.includes('--force');
const addrArg = rest.find((a) => !a.startsWith('--'));

const fail = (msg) => { console.error(`\n  ✗ ${msg}\n`); process.exit(1); };
const readState = () => { try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); } catch { return {}; } };
const writeState = (s) => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); };

// Same data → same fingerprint, whatever the key order.
const stable = (v) => (Array.isArray(v) ? `[${v.map(stable).join(',')}]`
  : v && typeof v === 'object' ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(',')}}`
  : JSON.stringify(v ?? null));
const fingerprint = (data) => crypto.createHash('sha256').update(stable(data)).digest('hex');
const isEmpty = (data) => LIST_COLLECTIONS.every((c) => !data[c]?.length);
const count = (data) => `${data.tasks?.length || 0} tasks, ${data.transactions?.length || 0} transactions, ${data.sleeps?.length || 0} sleeps`;

async function call(url, opts = {}) {
  let res;
  try {
    res = await fetch(url, { ...opts, signal: AbortSignal.timeout(opts.timeout || 20000) });
  } catch {
    return null;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) fail(`${url} answered ${res.status}: ${data.error || 'error'}`);
  return data;
}
const post = (url, body) => call(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// The server PC.
async function remoteExport(remote) {
  const data = await call(`${remote}/api/export`);
  if (!data) fail(`Can't reach ${remote}. Is the server PC on, with the planner running, and Tailscale on here?`);
  return data;
}

// This PC: through its own planner if it is running (so the running server stays in charge), else the file.
const LOCAL = `http://127.0.0.1:${PORT}`;
const localRunning = async () => (await call(`${LOCAL}/api/info`, { timeout: 1500 }))?.dbFile === DB_FILE;
async function localExport(running) {
  if (running) return call(`${LOCAL}/api/export`);
  const { prayerCache, push, ...data } = getDb();
  return data;
}
async function localImport(running, data) {
  if (running) return post(`${LOCAL}/api/import`, data);
  importBackup();
  replaceAll({ ...data, push: getDb().push });
}

async function main() {
  if (mode !== 'pull' && mode !== 'push') fail('Use: npm run pull-data  or  npm run push-data  (first time: add -- https://<server-pc>.<tailnet>.ts.net)');
  const state = readState();
  let remote = addrArg || state.remote;
  if (!remote) fail(`First time: tell me the server PC's address, e.g.\n    npm run ${mode}-data -- https://nur.tail035a7a.ts.net`);
  if (!/^https?:\/\//.test(remote)) remote = `https://${remote}`;
  remote = remote.replace(/\/+$/, '');
  // Fingerprints from the last pull/push only count for the same server PC.
  const known = state.remote === remote ? state : {};

  const running = await localRunning();
  const theirs = await remoteExport(remote);
  const ours = await localExport(running);
  if (fingerprint(ours) === fingerprint(theirs)) {
    writeState({ remote, remoteHash: fingerprint(theirs), localHash: fingerprint(ours), at: new Date().toISOString() });
    return console.log('\n  ✓ Both PCs already have the same data. Nothing to do.\n');
  }

  if (mode === 'pull') {
    if (isEmpty(theirs)) fail(`${remote} has no data yet. Did you mean npm run push-data?`);
    if (!force && known.localHash && fingerprint(ours) !== known.localHash) {
      fail('You changed data on this PC since the last pull/push. Send it first (npm run push-data),\n    or add --force to throw those changes away (a backup is kept).');
    }
    await localImport(running, theirs);
    console.log(`\n  ✓ Pulled from ${remote}: ${count(theirs)}.`);
    console.log('    What this PC had before is kept in server/data/backups/import-….');
    if (!running) console.log('    Start the planner here to use it (./start.sh or npm start).');
  } else {
    if (!force) {
      if (known.remoteHash && fingerprint(theirs) !== known.remoteHash) {
        fail(`The data on ${remote} changed since your last pull. Pushing would erase those changes.\n    Pull first (npm run pull-data), or add --force to replace it anyway (it keeps a backup).`);
      }
      if (!known.remoteHash && !isEmpty(theirs)) {
        fail(`${remote} already has data (${count(theirs)}) that you never pulled here.\n    Pull it first (npm run pull-data), or add --force to replace it (it keeps a backup).`);
      }
    }
    await post(`${remote}/api/import`, ours) || fail(`Lost the connection to ${remote} while sending. Nothing was changed there; try again.`);
    console.log(`\n  ✓ Pushed to ${remote}: ${count(ours)}.`);
    console.log('    The server PC kept a backup of what it had (server/data/backups/import-… there).');
    console.log('    Open tabs and the phone app pick it up when you return to them (or refresh).');
  }

  writeState({ remote, remoteHash: fingerprint(await remoteExport(remote)), localHash: fingerprint(await localExport(running)), at: new Date().toISOString() });
  console.log('');
}

main();
