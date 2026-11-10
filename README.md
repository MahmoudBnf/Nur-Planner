# 🌙 Nur Planner

A local, private planner built around one idea: **train the skill of starting**.
Daily & weekly objectives and routines, a 5-minute focus timer with an "I'm avoiding something"
rescue flow, end-of-day muhasabah (✓ / ~ / ✗ with remarks), salah times and tracking for your
city, Qur'an revision, sleep, money, a 14-day challenge, an ideas inbox and insights.
It runs on one PC, and your phone and other computers use it through Tailscale
(installed as an app on the phone, with notifications).

Stack: **React (Vite)** for the UI, **Express** for the API, and a **JSON file** for
the data (`server/data/db.json`). No database to install, and it runs the same on Linux and Windows.

---

## ⚡ Cheat sheet: the only commands you need

All commands run **from the project folder** (the one containing `package.json`).

| What you want | Command | Then open |
|---|---|---|
| First time only: install dependencies | `npm install` | – |
| **Use the app normally** (build + start) | `npm run app` | http://localhost:4000 |
| Start again later (already built) | `npm start` | http://localhost:4000 |
| Work on the code (hot reload) | `npm run dev` | http://localhost:5173 |
| Only rebuild the React UI | `npm run build` | – |
| Make a backup copy of your data | `npm run backup` | – |
| Copy the data from / to the server PC | `npm run pull-data` / `npm run push-data` | – |
| Stop the server | press `Ctrl + C` in the terminal | – |

> **Rule of thumb:** changed the code? → `npm run build` then `npm start` (or just `npm run app`).
> Only *using* it? → `npm start`.

### Even easier: double-click starters
- **Linux:** `./start.sh` (run `chmod +x start.sh` once first)
- **Windows:** double-click `start.bat`

They install dependencies if they're missing, build the UI if it isn't built, and start the server.

---

## 🧠 What each command actually does

- `npm install` downloads everything listed in `package.json` into `node_modules/`.
  Run it again only if `package.json` changes or you delete `node_modules`.
- `npm run build` runs **Vite** and compiles the React code in `client/src` into
  plain HTML/JS/CSS in `client/dist/`.
- `npm start` runs `node server/index.js`. The Express server answers `/api/...`
  requests **and** serves the built UI from `client/dist`, so everything is on **one port (4000)**.
- `npm run dev` runs two processes side by side:
  - the Express API on port 4000 (`node --watch` restarts it when you edit server files)
  - the Vite dev server on port 5173 (instant hot reload for React; forwards `/api` to 4000)

  Use this while editing the code and open **5173**, not 4000.

### Change the port
```bash
# Linux
PORT=5000 npm start
# Windows (PowerShell)
$env:PORT=5000; npm start
# Windows (cmd)
set PORT=5000 && npm start
```

### "Port already in use"
Another copy is still running. Close that terminal, or:
```bash
# Linux
fuser -k 4000/tcp
# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 4000).OwningProcess | Stop-Process
```

---

## 📱 On your phone and other PCs (from anywhere)

**One PC is the server**: it runs the planner and holds the only copy of the data.
Every other device (phone, laptop) is a window onto it, over **Tailscale**, a private
encrypted network of your own devices that works across any Wi-Fi, 4G or double router.

```
phone / other PC ──Tailscale──► server PC: tailscale serve (HTTPS) ──► planner :4000 ──► server/data/db.json
```

1. Install Tailscale on every device with the **same account**:
   - Ubuntu: `curl -fsSL https://tailscale.com/install.sh | sh`, then `sudo tailscale up`
   - Windows: the installer from https://tailscale.com/download, then sign in from the tray icon
   - Android: Play Store
2. In the Tailscale admin console → **DNS**: enable **MagicDNS** and **HTTPS Certificates** (once per account).
3. On the **server PC**, once (it is remembered across reboots):
   - Ubuntu: `sudo tailscale serve --bg 4000`
   - Windows (in cmd or PowerShell): `tailscale serve --bg 4000`

   It prints the address: `https://<pc-name>.<tailnet>.ts.net`.
4. Open that address on any of your devices. On the phone, in Chrome: ⋮ → **Install app** (or *Add to home screen*).
5. In the installed app: **Settings → Notifications on this device → Turn on**, then *Send a test*.

The server PC must be on, awake and running the planner. Notifications come from it at each
prayer and at each task's exact time, even when the app is closed on the phone.

The server only accepts connections from the PC itself (Tailscale forwards the others in).
To open it to your local network instead (no password!): `HOST=0.0.0.0 npm start`.

> **The address is the server PC's name.** If you move the server to another PC, the address
> changes: uninstall the phone app, install it from the new address and turn notifications on again.
> Tip: rename the server machine in the Tailscale admin console (⋯ → *Edit machine name*), e.g. `nur`,
> to get a short address like `https://nur.<tailnet>.ts.net`.

---

## 🪟 Moving the server to a Windows PC

**Only one PC should run the planner.** Two running servers means two separate databases
that drift apart. Move it, then stop using the old one.

1. Install **Node.js LTS** from https://nodejs.org (v20 or newer; check with `node -v`) and **Git** from https://git-scm.com.
2. Get the code: `git clone <your GitHub repo>` (or copy the folder; skip `node_modules/` and `client/dist/`).
   Your data is **not** in Git: `server/data/` is ignored on purpose, so your personal data never goes to GitHub.
   There is no `.env` file: every setting (city, currency, name…) lives in the data.
3. Double-click `start.bat`. The first time it installs and builds (a minute), then opens the planner.
   If Windows Firewall asks about Node.js, you can click *Cancel*: the planner only listens on the PC itself.
4. Do the **Tailscale** steps above on the Windows PC (step 3), then install the phone app from the new address.
5. Bring your data: on the **old** PC, run `npm run push-data -- https://<windows-pc>.<tailnet>.ts.net`
   (see below). Or by hand: **Settings → Export backup** there, **Settings → Import backup** here.
   Phone notification subscriptions are not copied (they belong to the old address anyway).
6. Stop the old server, and on the old PC (Ubuntu) remove its forwarding: `sudo tailscale serve reset`.
   From then on, the old PC opens the new address in its browser like the phone does.

To keep it reachable: in Windows power settings set *Sleep* to **Never** while plugged in,
and in the Tailscale tray menu enable **Run unattended** (it stays connected even when you're logged out).

### Copying the data between PCs (free, over Tailscale)

Most of the time you don't need a copy: open the server PC's address in the browser and you use
the live data. When you do want the data on this PC (server PC off, or working on the code):

| What you want | Command (from the project folder) |
|---|---|
| Get the server PC's data here | `npm run pull-data` |
| Send this PC's data to the server PC | `npm run push-data` |

The first time, add the address: `npm run pull-data -- https://<server-pc>.<tailnet>.ts.net`. It is remembered.

- It works whether this PC's planner is running or not.
- Each side keeps a backup of what it had before being replaced (`server/data/backups/import-…`, last 10).
- **It never silently erases work.** A pull refuses if you changed data on this PC since the last pull/push,
  and a push refuses if the server PC changed since your last pull. A copy is a whole snapshot, not a merge:
  if both sides changed, choose which one wins and add `--force` (the other side's backup is kept).
- The server PC must be on with the planner running, and both PCs on Tailscale.

### Start automatically when Windows boots (optional)
Press `Win + R`, type `shell:startup`, press Enter, and put a **shortcut to `start.bat`** in that folder.

### Start automatically on Ubuntu (optional)
```bash
mkdir -p ~/.config/autostart
cat > ~/.config/autostart/nur-planner.desktop <<EOF
[Desktop Entry]
Type=Application
Name=Nur Planner
Exec=bash -c "cd $(pwd) && npm start"
X-GNOME-Autostart-enabled=true
EOF
```
Then bookmark http://localhost:4000 in your browser.

---

## 📚 The pages

| Page | What it's for |
|---|---|
| **Today** | The *one* main task with its next step and a "Start 5 minutes" button; tasks grouped by prayer block (After Fajr / Dhuhr / Asr / Maghrib → Isha / After Isha) with the current block highlighted; daily activity meter (dailies and today's tasks) and a weekly meter (weekly routines only); this week's weeklies; next-prayer countdown; prayer tracker; leftovers from previous days |
| **Routines** | **Dailies** (every day or chosen weekdays, in a block, optional exact time) and **weeklies** (in a window like *Thu Maghrib → Fri Maghrib*, or N× "anytime this week"). They appear in your day automatically, reset instead of piling up, keep a 🔥 streak, and give activity points. One-click templates (Kahf, Qur'an revision, adhkar, Mon/Thu fasting, typing, pet project…) |
| **Focus** | Timer (5/10/25/45 min) that keeps running while you switch pages. **"I'm avoiding something"** walks you through notice → name the reason → remove the distraction → 5 minutes → decide what's next |
| **Review** | Verify each task: ✓ done / ~ partly / ✗ not done, plus a remark. ✓ means *done on its day*: it counts for that day, and a Qur'an tier records that day's portion. Not done on its day? ✗ and carry **that one task** to the next day (➜ button; Qur'an portions included), or carry all unfinished one-offs at once. Muhasabah questions, mood/energy, shukr, tomorrow's first action (one click turns it into tomorrow's main task) |
| **Salah** | Search your city, choose the calculation method (or Auto), today's times in Arabic and English, monthly table with Hijri dates. Click a prayer to cycle its state (right-click / long-press for the menu): **On time** · **Late (still in its time)** · **Qada'** (prayed after its time) · **Missed** (still owed). Prayers whose time has come but aren't logged are flagged. **To make up** lists every missed prayer until you mark it made up. Streaks and a breakdown by state |
| **Qur'an (muraja'a)** | Revision in tiers stored per **thumun** (480 units): Tier 1 *solid*, Tier 2 *medium*, Tier 3 *read from the mushaf*, plus **Hifz** which moves thumun from Tier 3 to Tier 2 (≥ ⅛ hizb a week). Each tier's daily share = its size ÷ reading days per cycle, in thumun. Record all of it or **only part** (tap the thumun where you stopped, hizb by hizb, with surah names where they start). What a reading day doesn't cover becomes **debt**, added on top of the next days (never more than one full cycle). Points are proportional: your own share = 100%, paying debt on top up to 200%. Late? Record it in Review for the right day. A map of the 60 hizb moves any hizb or thumun between tiers |
| **Sleep** | Log every sleep (one tap "going to sleep" / "woke up", or times by hand). Each sleep is classified by the prayer times: night, after Fajr, qaylula, after Asr, evening. A 24-hour clock of the day with prayer times around it, a 7/14/30-day sleep diary (one row per day, midnight to midnight; a night that starts before midnight continues on the next row), hours per day vs your goal (a sleep counts for the day you wake up), a warning when a sleep was left running, usual bedtime and wake-up, sleep debt, nights you slept through Fajr, and how sleep changes your start rate |
| **Weekly summary** | Doing, salah, Qur'an, sleep, money and mind for any week, compared with the week before, a few plain-language highlights, objectives, and the weekly reflection. Printable |
| **Money** | Log what you spend and receive in seconds (amount, category, note). Monthly budget with an even-pace marker and **safe to spend per day**; spending per day vs daily budget; received vs spent over 6 months; where it went by category; sadaqa tracked on its own; no-spend days, biggest expense, the weekday you spend most. Currency is guessed from your city and can be changed (Algerian dinars are written `150 DA`). **Starting money**: the money you already had when you started counting (not income); from it, **In hand** shows what you have now: starting money + everything received − everything spent since. **Recurring** items (salary, subscriptions, rent…; monthly, weekly or yearly) are logged automatically on their date, with "still due this month" and what you'll have in hand at month end |
| **Week** | 1–3 weekly objectives with "why" (niyyah), progress and a verdict; a 7-day board with drag & drop; weekly reflection |
| **Ideas** | Brain dump with #tags, pin, search; turn an idea into a task or a weekly objective. `Ctrl + K` captures from any page |
| **14-Day Challenge** | The five daily habits over 14 days, with hints taken from your real activity |
| **Try New Things** | A list of unfamiliar games/skills/books; "Try for 5 minutes" and a verdict afterwards |
| **Insights** | Start rate, completion, focus minutes, salah on time, why you avoid (with the fix for your most common reason), balance across Deen / Duty / Growth / Rest |
| **Guide** | The principles from the conversation, condensed |
| **Settings** | Name, theme (dark/light), week start, default focus length, reminders & desktop notifications, daily activity goal, city/method, export/import backups |

**Tasks have steps.** Step 1 is the *first physical action*. Add as many as you need (Enter adds the next one), but a task only shows the **next unchecked step** so starting stays small. Ticking steps marks the task started; ticking all of them completes it.

**Reminders.** At a task's exact time and at each prayer (with its checkpoint message): an open tab plays a chime and shows a reminder, and every device where you turned on **Settings → Notifications on this device** gets a notification, even with the app closed. The server sends those itself, so they work as long as the server PC is on.

## 🔐 Data & privacy
- Everything is stored in `server/data/db.json` on the server PC. Other devices store nothing but the app itself.
- `server/data/` is in `.gitignore`: pushing the code to GitHub never includes your data.
- A backup is made automatically every day in `server/data/backups/`, before that day's first change, even if the server stays running for days (the last 14 are kept).
- Open the app in as many tabs or devices as you like: a tab you come back to reloads itself, and a Qur'an change made from an out-of-date tab is refused (the tab reloads and asks you to redo it) instead of overwriting newer data.
- The internet is used only for prayer times (api.aladhan.com), city search
  (open-meteo.com) and, if you turn them on, phone notifications (end-to-end encrypted; the push
  service only carries them). Times are cached, so the app keeps working offline once a month is loaded.

## 🗂️ Project structure
```
package.json        scripts + dependencies (one install for everything)
vite.config.js      Vite config (UI lives in client/, proxies /api in dev)
start.sh / start.bat one-click starters (Linux / Windows)
server/
  index.js          Express API + serves the built UI
  db.js             JSON-file storage, daily backups
  prayer.js         Aladhan + geocoding, with caching
  routines.js       creates each day's routine tasks
  recurring.js      logs recurring money on its date
  notify.js         sends prayer and task notifications on time
  push.js           Web Push (encrypted notifications to phones), no extra library
  sync.js           npm run pull-data / push-data
  data/             ← YOUR DATA (db.json, backups/) — not in Git
shared/             rules used by both server and UI (routines, recurring, reminders)
client/
  index.html
  public/           phone app: manifest, service worker (sw.js), icons
  src/
    App.jsx         sidebar + routes
    pages/          one file per page
    components/     shared UI (tasks, prayer, charts…)
    state/          data, prayer and focus-timer providers
    lib/            helpers and constants
```
