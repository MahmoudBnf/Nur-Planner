import { useMemo, useState } from 'react';
import { BookOpen, Check, RotateCcw, Moon, Map as MapIcon, History, SlidersHorizontal, ArrowUpCircle } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { useQuran } from '../state/useQuran.js';
import { Modal, Ring, Seg } from '../components/ui.jsx';
import { ANCHORS, ANCHOR_KEYS } from '../lib/constants.js';
import { addDays, cx, diffDays, fmtDate, parseDate, todayStr, weekStartOf } from '../lib/utils.js';
import {
  DEFAULTS, SURAH_STARTS, UNITS, TIER_INFO, cycleDaysOf, dailyAmount, describeUnits, fmtHizb, hifzNext,
  initialLevels, khatmProgress, levelOf, positionLabel, restsFriday, surahLabel, surahName, takeUnits, toRuns, unitsOf, unitsOfRanges,
} from '../lib/quran.js';
import { DueBar, RevisionPicker, ThumunStrip } from '../components/QuranPicker.jsx';

const EIGHTHS = Array.from({ length: 481 }, (_, i) => i / 8); // tier ends, by thumun
const isFriday = (d) => parseDate(d).getDay() === 5;
const QURAN_RE = /qur|quran|ahzab|hizb|7izb|muraja|حزب|قرآن/i;

// Where the leading runs of Tier 1 and Tier 2 end, in hizb (eighths).
function tierEnds(levels) {
  let u = 0;
  while (u < UNITS && levels[u] === '1') u++;
  const t1 = u;
  while (u < UNITS && levels[u] === '2') u++;
  return [t1 / 8, u / 8];
}

// ---------------- setup ----------------
// First time: builds the tiers. Afterwards it EDITS them: moving a tier end only
// moves the thumun in between (like the map), your place in each cycle and all
// history are kept, and a new rhythm starts with the tier's next cycle.
function Setup({ onDone }) {
  const { routines, add, update, quran, saveQuran, syncRoutines, settings } = useData();
  const editing = !!quran?.setup;
  const [ends0] = useState(() => (editing ? tierEnds(quran.levels || '') : [20.5, 34]));
  const [t1, setT1] = useState(ends0[0]);
  const [t2, setT2] = useState(ends0[1]);
  const [cycle, setCycle] = useState({ ...DEFAULTS.cycleDays, ...(quran?.cycleDays || {}), ...(quran?.pendingCycleDays || {}) });
  const [rest, setRest] = useState({ ...DEFAULTS.restFriday, ...(quran?.restFriday || {}) });
  const routineOf = (tier) => routines.find((r) => r.quranTier === tier);
  const [anchor, setAnchor] = useState(() => ({ 1: 'fajr', 2: 'maghrib', 3: 'any', 4: 'any', ...Object.fromEntries([1, 2, 3, 4].filter(routineOf).map((t) => [t, routineOf(t).anchor || 'any'])) }));
  const [pos, setPos] = useState({}); // only tiers whose position you change
  const old = routines.filter((r) => r.active && !r.quranTier && QURAN_RE.test(r.title) && !/kahf/i.test(r.title));
  const [pause, setPause] = useState(() => Object.fromEntries(old.map((r) => [r.id, true])));
  const [busy, setBusy] = useState(false);

  // Editing: only the thumun between the old and new tier ends change tier.
  const editedLevels = () => {
    if (!editing) return initialLevels(t1, t2);
    const arr = quran.levels.split('');
    const [o1, o2] = ends0.map((h) => h * 8);
    const n1 = t1 * 8, n2 = t2 * 8;
    for (let u = Math.min(o1, n1); u < Math.max(o1, n1); u++) arr[u] = u < n1 ? '1' : u < n2 ? '2' : '3';
    for (let u = Math.min(o2, n2); u < Math.max(o2, n2); u++) if (u >= n1) arr[u] = u < n2 ? '2' : '3';
    return arr.join('');
  };
  const preview = { levels: editedLevels(), cycleDays: cycle };
  const stops = (tier) => unitsOf(preview, tier);
  const currentPos = (tier) => {
    const list = stops(tier);
    const ptr = quran?.pointers?.[tier];
    return editing && ptr != null ? list.find((u) => u >= ptr) ?? list[0] : list[0];
  };

  const finish = async () => {
    setBusy(true);
    if (editing) {
      // Only the thumun between old and new tier ends move (logged in History).
      const levels = editedLevels();
      // New rhythm waits for the end of the tier's current cycle.
      const pending = {};
      for (const tier of [1, 2, 3]) if (cycle[tier] !== cycleDaysOf(quran, tier)) pending[tier] = cycle[tier];
      if (!await saveQuran({ levels, restFriday: rest, pendingCycleDays: pending, ...(Object.keys(pos).length && { pointers: { ...(quran.pointers || {}), ...pos } }) })) return setBusy(false);
      for (const tier of [1, 2, 3]) {
        const moved = [];
        for (let u = 0; u < UNITS; u++) if (levels[u] !== quran.levels[u] && levels[u] === String(tier)) moved.push(u);
        if (moved.length) await add('quranLogs', { date: todayStr(), tier, kind: 'move', ranges: toRuns(moved), units: moved.length });
      }
      const notFriday = [0, 1, 2, 3, 4, 6];
      for (const tier of [1, 2, 3, 4]) {
        const r = routineOf(tier);
        if (r) update('routines', r.id, { anchor: anchor[tier], ...(tier < 4 && { days: rest[tier] ? notFriday : [0, 1, 2, 3, 4, 5, 6] }) });
      }
      setTimeout(() => syncRoutines(settings.weekStartsOn ?? 1), 500);
      setBusy(false);
      onDone?.();
      return;
    }
    const today = todayStr();
    const levels = initialLevels(t1, t2);
    const pointers = {};
    for (const tier of [1, 2, 3]) pointers[tier] = pos[tier] ?? unitsOf({ levels }, tier)[0];
    if (!await saveQuran({ setup: true, levels, pointers, cycleDays: cycle, restFriday: rest, cycles: quran?.cycles || {}, revisedAt: quran?.revisedAt || {}, khatm: quran?.khatm || { count: 0, start: today } })) return setBusy(false);
    // Revision routines (Tier 1–3 daily, Hifz weekly). Existing ones are updated, not duplicated.
    const notFriday = [0, 1, 2, 3, 4, 6];
    const defs = [
      { quranTier: 1, title: "Muraja'a · Tier 1 (solid)", kind: 'daily', days: rest[1] ? notFriday : undefined, anchor: anchor[1], points: 20 },
      { quranTier: 2, title: "Muraja'a · Tier 2 (medium)", kind: 'daily', days: rest[2] ? notFriday : undefined, anchor: anchor[2], points: 20 },
      { quranTier: 3, title: "Muraja'a · Tier 3 (mushaf)", kind: 'daily', days: rest[3] ? notFriday : undefined, anchor: anchor[3], points: 15 },
      { quranTier: 4, title: 'Hifz · memorize ⅛ hizb (Tier 3 → 2)', kind: 'weekly', mode: 'open', target: 1, anchor: 'any', points: 30 },
    ];
    for (const d of defs) {
      const existing = routines.find((r) => r.quranTier === d.quranTier);
      const data = { category: 'deen', steps: [], time: '', ...d, days: d.days || [0, 1, 2, 3, 4, 5, 6], active: true };
      if (existing) update('routines', existing.id, data);
      else await add('routines', { ...data, startDate: today });
    }
    old.filter((r) => pause[r.id]).forEach((r) => update('routines', r.id, { active: false }));
    setTimeout(() => syncRoutines(settings.weekStartsOn ?? 1), 500);
    setBusy(false);
    onDone?.();
  };

  const hizbSelect = (value, set, min = 0) => (
    <select className="select" value={value} onChange={(e) => set(Number(e.target.value))}>
      {EIGHTHS.filter((h) => h >= min).map((h) => <option key={h} value={h}>{fmtHizb(h * 8)}</option>)}
    </select>
  );

  return (
    <div className="stack">
      <div className="card hero">
        <h2>{editing ? "Edit your muraja'a" : "Set up your muraja'a"}</h2>
        <p className="text-2 mt-1">{editing
          ? 'Changes keep everything you revised and your place in each cycle. Moving a tier end only moves the thumun in between; a new rhythm starts with that tier\'s next cycle.'
          : 'Tell me where each tier starts and ends. Later, tiers change on their own: memorized thumuns move from Tier 3 to Tier 2, and you can promote any hizb from the map.'}</p>
        <div className="grid g-3 mt-3">
          <div className="tier-setup" style={{ '--tier': TIER_INFO[1].color }}>
            <b>{TIER_INFO[1].name}</b><span className="small muted">{TIER_INFO[1].hint}</span>
            <label className="field mt-1">From the start to hizb {hizbSelect(t1, (v) => { setT1(v); if (t2 < v) setT2(v); })}</label>
          </div>
          <div className="tier-setup" style={{ '--tier': TIER_INFO[2].color }}>
            <b>{TIER_INFO[2].name}</b><span className="small muted">{TIER_INFO[2].hint}</span>
            <label className="field mt-1">From {fmtHizb(t1 * 8)} to hizb {hizbSelect(t2, setT2, t1)}</label>
          </div>
          <div className="tier-setup" style={{ '--tier': TIER_INFO[3].color }}>
            <b>{TIER_INFO[3].name}</b><span className="small muted">{TIER_INFO[3].hint}</span>
            <p className="field mt-1">From {fmtHizb(t2 * 8)} to the end (60)</p>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Rhythm</h2>
        <div className="grid g-3 mt-2">
          {[1, 2, 3].map((tier) => {
            const n = unitsOf(preview, tier).length;
            return (
              <div key={tier} className="tier-setup" style={{ '--tier': TIER_INFO[tier].color }}>
                <b>{TIER_INFO[tier].short} · {fmtHizb(n)} hizb</b>
                <label className="field">Reading days per cycle
                  <Seg value={cycle[tier]} onChange={(v) => setCycle({ ...cycle, [tier]: v })} options={[2, 3, 4, 5, 6, 7].map((d) => ({ value: d, label: String(d) }))} />
                </label>
                <div className="small"><b>{n ? fmtHizb(dailyAmount(preview, tier)) : 0} hizb</b> <span className="muted">per day</span></div>
                {editing && cycle[tier] !== cycleDaysOf(quran, tier) && <div className="tiny" style={{ color: 'var(--warn)' }}>From cycle #{(quran.cycles?.[tier] || 0) + 2} — the current cycle keeps {cycleDaysOf(quran, tier)} days</div>}
                <label className="row small mt-1" style={{ cursor: 'pointer' }}>
                  <input type="checkbox" checked={rest[tier]} onChange={(e) => setRest({ ...rest, [tier]: e.target.checked })} /> Rest on Friday
                </label>
                <label className="field mt-1">Block
                  <select className="select" value={anchor[tier]} onChange={(e) => setAnchor({ ...anchor, [tier]: e.target.value })}>
                    {ANCHOR_KEYS.map((k) => <option key={k} value={k}>{ANCHORS[k].label}</option>)}
                  </select>
                </label>
                {n > 0 && (
                  <label className="field mt-1">Where are you now in this cycle?
                    <select className="select" value={pos[tier] ?? currentPos(tier)} onChange={(e) => setPos({ ...pos, [tier]: Number(e.target.value) })}>
                      {stops(tier).map((u) => <option key={u} value={u}>{positionLabel(u)}</option>)}
                    </select>
                  </label>
                )}
              </div>
            );
          })}
        </div>
        <p className="small muted mt-2">Hifz: at least ⅛ hizb per week, any day, as a weekly routine. Each memorized thumun leaves Tier 3 and joins Tier 2.</p>
      </div>

      {!editing && old.length > 0 && (
        <div className="card">
          <h2>Replace your current Qur'an routines</h2>
          <p className="small muted mt-1">These will be paused (their history stays) since the new revision routines replace them.</p>
          <div className="stack mt-2" style={{ gap: 6 }}>
            {old.map((r) => (
              <label key={r.id} className="row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={!!pause[r.id]} onChange={(e) => setPause({ ...pause, [r.id]: e.target.checked })} /> {r.title}
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn gold lg" disabled={busy} onClick={finish}><BookOpen size={18} /> {quran?.setup ? 'Save setup' : 'Start my muraja\'a'}</button>
      </div>
    </div>
  );
}

// ---------------- today's portion per tier ----------------
function TierCard({ tier }) {
  const { q, plan, setRevised } = useQuran();
  const today = todayStr();
  const [picking, setPicking] = useState(false);
  const list = unitsOf(q, tier);
  const total = list.length;
  const daily = dailyAmount(q, tier);
  const p = plan(tier, today);
  const left = takeUnits(q, tier, p.left).units;
  const rest = restsFriday(q, tier) && isFriday(today) && !p.task;
  const cycleNo = (q.cycles?.[tier] || 0) + 1;
  const ptr = q.pointers?.[tier] ?? list[0];
  const index = Math.max(0, list.findIndex((u) => u >= ptr));
  const daysLeft = daily ? Math.ceil((total - index) / daily) : 0;

  if (!total) {
    return (
      <div className="card tier-card" style={{ '--tier': TIER_INFO[tier].color }}>
        <div className="tier-title"><b>{TIER_INFO[tier].name}</b></div>
        <p className="small muted mt-1">Empty — nothing in this tier right now.</p>
      </div>
    );
  }

  return (
    <div className={cx('card tier-card', p.total > 0 && p.left === 0 && 'done')} style={{ '--tier': TIER_INFO[tier].color }}>
      <div className="row between">
        <div className="tier-title"><b>{TIER_INFO[tier].name}</b></div>
        <span className="chip">{fmtHizb(total)} hizb · {fmtHizb(daily)}/day · {cycleDaysOf(q, tier)}-day cycle</span>
      </div>
      <div className="small muted">{TIER_INFO[tier].hint}</div>

      {(p.total > 0 || p.done > 0) && (
        <div className="quran-due mt-2">
          <DueBar p={p} />
          <span className="tiny muted">
            {fmtHizb(p.done)} / {fmtHizb(p.total)} hizb
            {p.debt > 0 && <span style={{ color: 'var(--warn)' }}> · debt {fmtHizb(p.debt)}</span>}
            {p.daily > 0 && p.done >= p.daily && ' · today\'s share ✓'}
          </span>
        </div>
      )}

      {rest && p.left === 0 ? (
        <div className="rest-day mt-2"><Moon size={16} /> Friday — rest day for this tier. Jumu'a mubaraka.</div>
      ) : p.left === 0 ? (
        <div className="fix small mt-2" style={{ background: 'var(--good-soft)', borderColor: 'rgba(12,163,12,.4)' }}>
          ✓ All due revised today. Read more? <button className="btn ghost sm" onClick={() => setPicking(true)}>Record extra</button>
        </div>
      ) : (
        <div className="portion mt-2">
          <div className="small muted">
            {rest ? 'Rest day — only debt, if you want to pay some' : p.done ? 'Still due' : 'Today'} · <b>{fmtHizb(left.length)} hizb</b>
            {p.debtLeft > 0 && p.daily > 0 && <> ({fmtHizb(p.debtLeft)} debt + {fmtHizb(left.length - p.debtLeft)} today)</>}
          </div>
          <div className="portion-range">{describeUnits(left)}</div>
          <div className="ar portion-surahs">{surahLabel(left)}</div>
          <div className="tiny muted">{surahLabel(left, 'en')}</div>
          <div className="row wrap mt-2">
            <button className="btn primary" onClick={() => setRevised(tier, today, p.total)}><Check size={16} /> Revised all {fmtHizb(left.length)} hizb</button>
            <button className="btn" onClick={() => setPicking(true)}><SlidersHorizontal size={15} /> Only part of it…</button>
          </div>
        </div>
      )}

      <div className="mt-2">
        <div className="row between tiny muted"><span>Cycle #{cycleNo}</span><span>{fmtHizb(index)} / {fmtHizb(total)} · ~{daysLeft} reading day{daysLeft === 1 ? '' : 's'} left</span></div>
        <div className="mt-1"><ThumunStrip units={list} value={index} compact /></div>
      </div>
      <RevisionPicker tier={tier} day={today} open={picking} onClose={() => setPicking(false)} />
    </div>
  );
}

function HifzCard() {
  const { quranLogs, settings, saveQuran } = useData();
  const { q, memorizeToday, undo, todayTask } = useQuran();
  const next = hifzNext(q);
  const ws = weekStartOf(todayStr(), settings.weekStartsOn ?? 1);
  const thisWeek = quranLogs.filter((l) => l.kind === 'memorize' && l.date >= ws);
  const totalMoved = quranLogs.filter((l) => l.kind === 'memorize').length;
  const goal = q.hifzPerWeek || DEFAULTS.hifzPerWeek;
  const t3 = unitsOf(q, 3);
  const task = todayTask(4);
  const lastSnap = task?.quranSnaps?.[task.quranSnaps.length - 1];

  return (
    <div className="card tier-card" style={{ '--tier': TIER_INFO[4].color }}>
      <div className="row between">
        <div className="tier-title"><b>{TIER_INFO[4].name}</b></div>
        <span className={cx('chip', thisWeek.length >= goal ? 'good' : 'gold')}>{thisWeek.length}/{goal} thumun this week</span>
      </div>
      <div className="small muted">{TIER_INFO[4].hint}. Any day — the week is the deadline.</div>
      {next == null ? <p className="mt-2">Tier 3 is empty — everything is memorized. Allahumma barik!</p> : (
        <div className="portion mt-2">
          <div className="small muted">Next thumun</div>
          <div className="portion-range">{positionLabel(next)}</div>
          <div className="ar portion-surahs">{surahLabel([next])}</div>
          <div className="row wrap mt-2">
            <button className="btn gold" onClick={() => memorizeToday(next)}><ArrowUpCircle size={16} /> Memorized — move to Tier 2</button>
            <select className="select" style={{ width: 'auto' }} value={next} onChange={(e) => saveQuran({ hifzNext: Number(e.target.value) })} title="Memorize a different thumun">
              {t3.map((u) => <option key={u} value={u}>{positionLabel(u)}</option>)}
            </select>
            {lastSnap && <button className="btn ghost sm" onClick={() => undo(lastSnap)}><RotateCcw size={13} /> undo</button>}
          </div>
        </div>
      )}
      <p className="tiny muted mt-2">{totalMoved} thumun moved to Tier 2 so far ({fmtHizb(totalMoved)} hizb).</p>
    </div>
  );
}

// ---------------- the map of 60 hizb ----------------
function QuranMap() {
  const { q, move } = useQuran();
  const [open, setOpen] = useState(null); // hizb number
  const today = todayStr();
  const fresh = (u) => {
    const d = q.revisedAt?.[u];
    if (!d) return 0.18;
    const age = diffDays(d, today);
    const tier = levelOf(q, u);
    const window = tier === 3 ? 7 : cycleDaysOf(q, tier) + 2;
    return age <= window ? 1 : age <= window * 2 ? 0.55 : 0.3;
  };
  const hizbUnits = (h) => Array.from({ length: 8 }, (_, i) => (h - 1) * 8 + i);

  return (
    <div className="card">
      <div className="card-head">
        <h2><MapIcon size={18} /> Your mushaf</h2>
        <div className="legend">
          {[1, 2, 3].map((t) => <span key={t}><i style={{ background: TIER_INFO[t].color }} /> {TIER_INFO[t].short}</span>)}
          <span className="muted">bright = revised this cycle · tap a hizb to move it</span>
        </div>
      </div>
      <div className="qmap">
        {Array.from({ length: 60 }, (_, i) => i + 1).map((h) => (
          <button key={h} className="qhizb" onClick={() => setOpen(h)} title={`Hizb ${h} · ${surahLabel(hizbUnits(h), 'en')}`}>
            <span className="qn">{h}</span>
            <span className="qcells">
              {hizbUnits(h).map((u) => <i key={u} style={{ background: TIER_INFO[levelOf(q, u)].color, opacity: fresh(u) }} />)}
            </span>
          </button>
        ))}
      </div>
      <Modal open={open != null} onClose={() => setOpen(null)} title={open ? `Hizb ${open}` : ''}>
        {open && (
          <div className="stack" style={{ gap: 12 }}>
            <div><div className="ar" style={{ fontSize: 20, color: 'var(--gold)' }}>{surahLabel(hizbUnits(open))}</div><div className="small muted">{surahLabel(hizbUnits(open), 'en')}</div></div>
            <div className="thumun-list">
              {hizbUnits(open).map((u) => (
                <div key={u} className="thumun-row">
                  <span className="small">Thumun {(u % 8) + 1}{SURAH_STARTS[u].length > 0 && <span className="ar tiny" style={{ color: 'var(--gold)' }}> ↦ {SURAH_STARTS[u].map((n) => surahName(n)).join(' · ')}</span>}</span>
                  <Seg value={levelOf(q, u)} onChange={(t) => move([u], t)} options={[1, 2, 3].map((t) => ({ value: t, label: TIER_INFO[t].short }))} />
                  <span className="tiny muted">{q.revisedAt?.[u] ? `revised ${fmtDate(q.revisedAt[u], { day: 'numeric', month: 'short' })}` : 'not yet'}</span>
                </div>
              ))}
            </div>
            <div className="row wrap">
              <span className="small muted">Whole hizb →</span>
              {[1, 2, 3].map((t) => <button key={t} className="btn sm" onClick={() => move(hizbUnits(open), t)} style={{ borderColor: TIER_INFO[t].color }}>{TIER_INFO[t].short}</button>)}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Log() {
  const { quranLogs } = useData();
  const recent = [...quranLogs].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 12);
  const label = { revise: 'Revised', memorize: 'Memorized', move: 'Moved to' };
  return (
    <div className="card">
      <div className="card-head"><h2><History size={18} /> History</h2></div>
      {recent.length === 0 ? <p className="small muted">Nothing yet.</p> : (
        <div className="stack" style={{ gap: 6 }}>
          {recent.map((l) => (
            <div key={l.id} className="row small" style={{ alignItems: 'flex-start' }}>
              <span className="dot" style={{ background: TIER_INFO[l.tier]?.color, marginTop: 6 }} />
              <div className="grow">
                <b>{label[l.kind]} {l.kind === 'move' ? TIER_INFO[l.tier].short : ''}</b> {fmtHizb(l.units)} hizb · {describeUnits(unitsOfRanges(l.ranges))}
                <div className="tiny muted">{fmtDate(l.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {TIER_INFO[l.tier]?.short}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Quran() {
  const { quran, quranLogs } = useData();
  const [setup, setSetup] = useState(false);
  const q = quran || {};
  const khatm = khatmProgress(q);
  const weekUnits = useMemo(() => {
    const from = addDays(todayStr(), -6);
    return quranLogs.filter((l) => l.kind === 'revise' && l.date >= from).reduce((n, l) => n + l.units, 0);
  }, [quranLogs]);

  if (!q.setup || setup) {
    return (
      <>
        <div className="page-head"><div><h1>Muraja'a</h1><div className="sub">Revision of the Qur'an in tiers — every surah, on a rhythm that fits how well you hold it.</div></div>
          {q.setup && <button className="btn" onClick={() => setSetup(false)}>Cancel</button>}</div>
        <Setup onDone={() => setSetup(false)} />
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Muraja'a</h1>
          <div className="sub">“Keep refreshing your knowledge of the Qur'an, for it escapes faster than camels from their ropes.” — Bukhari & Muslim</div>
        </div>
        <div className="row">
          <div className="khatm">
            <Ring value={khatm} size={54} stroke={6} color="var(--gold)">{Math.round(khatm * 100)}%</Ring>
            <div><b>Full revision #{(q.khatm?.count || 0) + 1}</b><div className="tiny muted">{q.khatm?.count ? `${q.khatm.count} completed` : 'every thumun at least once'} · {fmtHizb(weekUnits)} hizb in 7 days</div></div>
          </div>
          <button className="icon-btn" title="Setup & rhythm" onClick={() => setSetup(true)}><SlidersHorizontal size={18} /></button>
        </div>
      </div>
      <div className="grid g-2">
        <TierCard tier={1} />
        <TierCard tier={2} />
        <TierCard tier={3} />
        <HifzCard />
      </div>
      <div className="grid g-main mt-3">
        <QuranMap />
        <Log />
      </div>
      <p className="tiny muted mt-2">Hizb & thumun numbering follows the usual 60-hizb division; surah names come from the hizb-quarter table and may differ by a few ayat at some boundaries in the Warsh mushaf.</p>
    </>
  );
}
