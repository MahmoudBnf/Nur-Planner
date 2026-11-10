// "How much did I revise?" — the day's thumun laid out hizb by hizb.
import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { useQuran } from '../state/useQuran.js';
import { Modal } from './ui.jsx';
import { cx, fmtDate, todayStr } from '../lib/utils.js';
import {
  SURAH_STARTS, pointsSplit, TIER_INFO, fmtHizb, hizbOf, positionLabel, surahAt, surahName, takeUnits, thumunOf, unitsOfRanges,
} from '../lib/quran.js';

// Cells grouped by hizb: a complete hizb is a full row of 8; a partial one is
// drawn dashed with its fraction. Each group names the surah it starts in; up to
// hizb 50 it also names every surah that begins inside it (after that, surahs
// are short and many, so the hizb's first surah is enough — the rest is in the tooltip).
export function ThumunStrip({ units, value = 0, kind, onPick, compact }) {
  const groups = [];
  units.forEach((u, i) => {
    const g = groups[groups.length - 1];
    if (g && hizbOf(g.units[g.units.length - 1]) === hizbOf(u) && u === g.units[g.units.length - 1] + 1) g.units.push(u), g.idx.push(i);
    else groups.push({ units: [u], idx: [i] });
  });
  return (
    <div className={cx('tstrip', compact && 'compact')}>
      {groups.map((g) => {
        const h = hizbOf(g.units[0]);
        const whole = g.units.length === 8;
        const starts = g.units.flatMap((u) => SURAH_STARTS[u].map((s) => ({ s, u })));
        return (
          <div key={g.idx[0]} className={cx('tgroup', !whole && 'partial')}>
            {!compact && (
              <div className="tgroup-head">
                <b>Hizb {h}</b>{!whole && <span className="tiny muted"> · {fmtHizb(g.units.length)}</span>}
                <span className="ar">{surahName(surahAt(g.units[0]))}</span>
              </div>
            )}
            <div className="tcells">
              {g.units.map((u, j) => {
                const i = g.idx[j];
                return (
                  <button key={u} type="button" className={cx('tcell', kind?.(i), i < value && 'on', SURAH_STARTS[u].length && 'starts')}
                    onClick={onPick ? () => onPick(i + 1 === value ? i : i + 1) : undefined} disabled={!onPick}
                    title={`${positionLabel(u)}${SURAH_STARTS[u].length ? ` · ≈ start of ${SURAH_STARTS[u].map((s) => surahName(s, 'en')).join(', ')}` : ''}`}>
                    {!compact && thumunOf(u)}
                  </button>
                );
              })}
            </div>
            {!compact && starts.length > 0 && (
              <div className="tstarts tiny" title={starts.map(({ s, u }) => `${surahName(s, 'en')} · thumun ${thumunOf(u)}`).join('\n')}>
                {h <= 50
                  ? starts.map(({ s, u }) => <span key={s}>↦ <span className="ar">{surahName(s)}</span> <span className="muted">{thumunOf(u)}</span></span>)
                  : <span className="muted">{starts.length} surah{starts.length > 1 ? 's' : ''} begin here</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// The thumun of a tier for one day: what was already recorded, then what is due
// (debt first, then the day's own share), then a hizb ahead if you read more.
export function useDayUnits(tier, day) {
  const { quranLogs } = useData();
  const { q, plan } = useQuran();
  const p = plan(tier, day);
  const done = useMemo(() => quranLogs
    .filter((l) => l.kind === 'revise' && l.tier === tier && l.date === day)
    .sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
    .flatMap((l) => unitsOfRanges(l.ranges)), [quranLogs, tier, day]);
  const next = takeUnits(q, tier, p.left + 8).units.filter((u) => !done.includes(u));
  return { p, units: [...done, ...next], next };
}

export function RevisionPicker({ tier, day = todayStr(), open, onClose }) {
  const { setRevised } = useQuran();
  const { p, units } = useDayUnits(tier, day);
  const [value, setValue] = useState(p.done);
  const [err, setErr] = useState('');
  useEffect(() => { if (open) { setValue(p.done); setErr(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const kind = (i) => (i < p.debt ? 'debt' : i < p.total ? 'due' : 'ahead');
  const clamp = (v) => Math.max(0, Math.min(units.length, v));
  const last = value ? units[value - 1] : null;
  const pts = pointsSplit({ ...p, done: value });
  const save = async () => {
    const r = await setRevised(tier, day, value);
    if (!r.ok) return setErr(r.error);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title={`${TIER_INFO[tier].name} · ${day === todayStr() ? 'today' : fmtDate(day, { weekday: 'long', day: 'numeric', month: 'short' })}`}>
      <div className="stack" style={{ gap: 12 }}>
        <div className="row wrap" style={{ gap: 6 }}>
          {p.debt > 0 && <span className="chip warn">Debt {fmtHizb(p.debt)} hizb</span>}
          {p.daily > 0 ? <span className="chip on">This day {fmtHizb(p.daily)} hizb</span> : <span className="chip">Rest day — only debt</span>}
          <span className="chip">Due {fmtHizb(p.total)} hizb</span>
        </div>
        <p className="small muted">Tap the thumun where you stopped. Debt comes first (striped), then the day's own share; the faded hizb after it is extra.</p>
        <ThumunStrip units={units} value={value} kind={kind} onPick={setValue} />
        <div className="picker-sum">
          <div className="row" style={{ gap: 6 }}>
            <button className="icon-btn" onClick={() => setValue(clamp(value - 1))} title="One thumun less"><Minus size={15} /></button>
            <div className="grow">
              <b>{fmtHizb(value)} hizb</b> <span className="muted">of {fmtHizb(p.total)} due</span>
              <div className="tiny muted">{last != null ? <>up to {positionLabel(last)} · <span className="ar">{surahName(surahAt(last))}</span></> : 'nothing revised'}</div>
            </div>
            <button className="icon-btn" onClick={() => setValue(clamp(value + 1))} title="One thumun more"><Plus size={15} /></button>
          </div>
          <div className="tiny mt-1">
            {p.daily > 0 && <>Daily meter: <b>{Math.round(pts.daily * 100)}%</b> of this tier's points</>}
            {pts.catchUp > 0 && <>{p.daily > 0 && ' · '}weekly meter: <b>+{Math.round(pts.catchUp * 100)}%</b> catch-up (half rate)</>}
          </div>
        </div>
        <div className="row wrap">
          <button className="btn sm" onClick={() => setValue(0)}>Nothing</button>
          {p.debt > 0 && p.daily > 0 && <button className="btn sm" onClick={() => setValue(Math.min(units.length, p.debt))}>Debt only</button>}
          <button className="btn sm" onClick={() => setValue(Math.min(units.length, p.total))}>All due</button>
          <span className="grow" />
          <button className="btn primary" onClick={save}><Check size={15} /> Save</button>
        </div>
        {err && <div className="small" style={{ color: 'var(--bad)' }}>{err}</div>}
      </div>
    </Modal>
  );
}

// Done / debt left / day's share left, as one bar.
export function DueBar({ p }) {
  const total = Math.max(p.total, p.done) || 1;
  const debtLeft = p.debtLeft;
  const dueLeft = p.left - debtLeft;
  return (
    <div className="duebar" title={`${fmtHizb(p.done)} revised · ${fmtHizb(debtLeft)} debt left · ${fmtHizb(dueLeft)} of the day's share left`}>
      <i className="done" style={{ width: `${(p.done / total) * 100}%` }} />
      <i className="debt" style={{ width: `${(debtLeft / total) * 100}%` }} />
      <i className="due" style={{ width: `${(dueLeft / total) * 100}%` }} />
    </div>
  );
}
