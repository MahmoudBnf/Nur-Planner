import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Repeat, Pause, PlayCircle, Wallet, TrendingDown, TrendingUp, PiggyBank, Pencil, Trash2, Target, CalendarCheck2, HandHeart, ListOrdered, BarChart3 } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { BarChart, HBars, Legend } from '../components/Charts.jsx';
import { Empty, Modal, Seg, Progress } from '../components/ui.jsx';
import { CURRENCIES, CURRENCY_LABELS, EXPENSE_CATS, INCOME_CATS, WEEKDAYS, currencyOf } from '../lib/constants.js';
import { addDays, cx, fmtDate, parseDate, todayStr } from '../lib/utils.js';
import { isDue } from '../../../shared/recurring.js';

const monthOf = (d) => d.slice(0, 7);
const daysInMonth = (ym) => { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const shiftMonth = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const monthName = (ym, opts = { month: 'long', year: 'numeric' }) => parseDate(`${ym}-01`).toLocaleDateString('en-GB', opts);
const sum = (list) => list.reduce((n, t) => n + (Number(t.amount) || 0), 0);

export function useMoney() {
  const { settings } = useData();
  const currency = currencyOf(settings);
  return useMemo(() => {
    const label = CURRENCY_LABELS[currency];
    let full, short;
    try {
      full = new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 });
      short = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
      if (label) {
        const n = new Intl.NumberFormat('en', { maximumFractionDigits: 2 });
        full = { format: (v) => `${v < 0 ? '−' : ''}${n.format(Math.abs(v))} ${label}` };
      }
    } catch {
      full = { format: (v) => `${v.toFixed(2)} ${currency}` };
      short = { format: (v) => String(v) };
    }
    return { currency, label: label || currency, fmt: (v) => full.format(v || 0), short: (v) => short.format(v || 0) };
  }, [currency]);
}

function TxForm({ initial, onDone }) {
  const { add, update } = useData();
  const { label } = useMoney();
  const [f, setF] = useState(initial || { type: 'expense', amount: '', category: 'food', note: '', date: todayStr() });
  const cats = f.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;

  const submit = async (e) => {
    e.preventDefault();
    const amount = Math.round(Number(String(f.amount).replace(/\s/g, '').replace(',', '.')) * 100) / 100;
    if (!(amount > 0)) return;
    const data = { type: f.type, amount, category: cats[f.category] ? f.category : 'other', note: f.note.trim(), date: f.date };
    if (initial?.id) update('transactions', initial.id, data);
    else await add('transactions', data);
    if (!initial) setF({ ...f, amount: '', note: '' });
    onDone?.();
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <div className="row wrap">
        <Seg value={f.type} onChange={(type) => setF({ ...f, type, category: type === 'expense' ? 'food' : 'salary' })}
          options={[{ value: 'expense', label: '− Spent' }, { value: 'income', label: '+ Received' }]} />
        <div className="amount-input">
          <input className="input" inputMode="decimal" autoFocus={!initial} placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <span>{label}</span>
        </div>
        <input className="input grow" style={{ minWidth: 160 }} placeholder="Note (optional) — e.g. groceries for the week" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
        <input className="input" type="date" style={{ width: 160 }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
      </div>
      <div className="cat-pick">
        {Object.entries(cats).map(([k, c]) => (
          <button type="button" key={k} className={cx(f.category === k && 'on', k === 'sadaqa' && 'sadaqa')} onClick={() => setF({ ...f, category: k })}>
            <span>{c.icon}</span> {c.label}
          </button>
        ))}
      </div>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className={cx('btn', f.type === 'expense' ? 'primary' : 'gold')}><Plus size={16} /> {initial?.id ? 'Save' : f.type === 'expense' ? 'Add expense' : 'Add income'}</button>
      </div>
    </form>
  );
}

// The money you already had when you started counting: not income, the starting point.
// Stored as settings.startingMoney = { amount, date, note }; transactions before that date are inside it.
function StartingMoneyForm({ onDone }) {
  const { settings, saveSettings } = useData();
  const { label, fmt } = useMoney();
  const cur = settings.startingMoney;
  const [f, setF] = useState({ amount: cur?.amount ?? '', date: cur?.date || todayStr(), note: cur?.note || '' });
  const submit = (e) => {
    e.preventDefault();
    const amount = Math.round(Number(String(f.amount).replace(/\s/g, '').replace(',', '.')) * 100) / 100;
    if (!Number.isFinite(amount) || f.amount === '') return;
    saveSettings({ startingMoney: { amount, date: f.date, note: f.note.trim() } });
    onDone();
  };
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }}>
      <p className="small text-2">All the money you had on the day you started counting — cash, CCP, bank. It isn’t income: it’s your starting point. From that day on, only what you receive and spend changes it.</p>
      <div className="row wrap">
        <div className="amount-input">
          <input className="input" inputMode="decimal" autoFocus placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          <span>{label}</span>
        </div>
        <label className="row small">on <input className="input" type="date" style={{ width: 160 }} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
        <input className="input grow" style={{ minWidth: 160 }} placeholder="Note (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
      <div className="row between">
        {cur ? <button type="button" className="btn ghost sm" onClick={() => confirm(`Remove your starting money (${fmt(cur.amount)})?`) && (saveSettings({ startingMoney: null }), onDone())}><Trash2 size={14} /> Remove</button> : <span />}
        <button className="btn primary"><PiggyBank size={16} /> Save</button>
      </div>
    </form>
  );
}

function Budget({ ym, spent }) {
  const { settings, saveSettings } = useData();
  const { fmt } = useMoney();
  const [edit, setEdit] = useState(false);
  const [val, setVal] = useState(settings.monthlyBudget || '');
  const budget = Number(settings.monthlyBudget) || 0;
  const total = daysInMonth(ym);
  const today = todayStr();
  const isCurrent = monthOf(today) === ym;
  const dayN = isCurrent ? Number(today.slice(8)) : ym < monthOf(today) ? total : 0;
  const daysLeft = isCurrent ? total - dayN + 1 : 0;
  const pace = budget * (dayN / total);
  const left = budget - spent;
  const safe = daysLeft ? Math.max(0, left) / daysLeft : 0;

  const save = () => { saveSettings({ monthlyBudget: Number(val) || 0 }); setEdit(false); };

  return (
    <div className="card">
      <div className="card-head">
        <h2><Target size={18} /> Monthly budget</h2>
        <button className="btn ghost sm" onClick={() => setEdit(!edit)}>{budget ? 'Change' : 'Set budget'}</button>
      </div>
      {edit && (
        <div className="row" style={{ marginBottom: 12 }}>
          <input className="input" inputMode="decimal" autoFocus placeholder="How much do you allow yourself to spend per month?" value={val}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
          <button className="btn primary" onClick={save}>Save</button>
        </div>
      )}
      {!budget ? (
        <p className="small muted">Set a monthly spending limit to see how much is <b>safe to spend per day</b> and whether you’re on pace.</p>
      ) : (
        <>
          <div className="row between small"><span>{fmt(spent)} spent</span><span className="muted">of {fmt(budget)}</span></div>
          <div className="budget-bar mt-1">
            <div className={cx('fill', spent > budget && 'over')} style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} />
            {isCurrent && <i className="pace" style={{ left: `${Math.min(100, (pace / budget) * 100)}%` }} title="Where you'd be at an even pace" />}
          </div>
          <div className="grid g-2 mt-2" style={{ gap: 10 }}>
            <div className="stat"><span className="label">{left >= 0 ? 'Left this month' : 'Over budget'}</span>
              <span className="value" style={{ fontSize: 22, color: left < 0 ? 'var(--bad)' : undefined }}>{fmt(Math.abs(left))}</span></div>
            {isCurrent && (
              <div className="stat"><span className="label">Safe to spend / day</span>
                <span className="value" style={{ fontSize: 22, color: 'var(--accent)' }}>{fmt(safe)}</span>
                <span className="hint">for the {daysLeft} day{daysLeft > 1 ? 's' : ''} left</span></div>
            )}
          </div>
          {isCurrent && (
            <p className={cx('small mt-2', spent > pace ? 'warn-text' : 'good-text')}>
              {spent > pace ? `▲ ${fmt(spent - pace)} ahead of an even pace — slow down a little.` : `▼ ${fmt(pace - spent)} under an even pace — well done.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}

const ORD = (n) => `${n}${[, 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] || 'th'}`;
const MONTHS = Array.from({ length: 12 }, (_, i) => new Date(2026, i, 1).toLocaleDateString('en-GB', { month: 'long' }));
export const describeRecurring = (r) =>
  r.freq === 'weekly' ? `Every ${WEEKDAYS[r.day]}` : r.freq === 'yearly' ? `Every year on ${r.day} ${MONTHS[r.month - 1]}` : Number(r.day) >= 31 ? 'Every month, last day' : `Every month on the ${ORD(Number(r.day))}`;
const nextDue = (r, from) => {
  for (let d = from, i = 0; i < 400; i++, d = addDays(d, 1)) if (isDue(r, d)) return d;
  return null;
};

function RecurringForm({ initial, onDone }) {
  const { add, update, syncRoutines, settings } = useData();
  const { label } = useMoney();
  const [f, setF] = useState(initial || { type: 'expense', amount: '', category: 'subscriptions', note: '', freq: 'monthly', day: 1, month: 1, startDate: todayStr() });
  const cats = f.type === 'expense' ? EXPENSE_CATS : INCOME_CATS;
  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(String(f.amount).replace(/\s/g, '').replace(',', '.'));
    if (!(amount > 0)) return;
    const data = { ...f, amount, note: f.note.trim(), day: Number(f.day), month: Number(f.month), active: initial?.active ?? true };
    delete data.id; delete data.createdAt; delete data.updatedAt;
    if (initial?.id) update('recurring', initial.id, data);
    else await add('recurring', data);
    setTimeout(() => syncRoutines(settings.weekStartsOn ?? 1), 450);
    onDone?.();
  };
  return (
    <form className="stack" style={{ gap: 12 }} onSubmit={submit}>
      <div className="row wrap">
        <Seg value={f.type} onChange={(type) => setF({ ...f, type, category: type === 'expense' ? 'subscriptions' : 'salary' })}
          options={[{ value: 'expense', label: '− Expense' }, { value: 'income', label: '+ Income' }]} />
        <div className="amount-input"><input className="input" inputMode="decimal" autoFocus placeholder="0" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /><span>{label}</span></div>
        <input className="input grow" style={{ minWidth: 160 }} placeholder="Name — e.g. Salary, Netflix, Internet" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </div>
      <div className="cat-pick">
        {Object.entries(cats).map(([k, c]) => (
          <button type="button" key={k} className={cx(f.category === k && 'on')} onClick={() => setF({ ...f, category: k })}><span>{c.icon}</span> {c.label}</button>
        ))}
      </div>
      <div className="row wrap">
        <Seg value={f.freq} onChange={(freq) => setF({ ...f, freq, day: freq === 'weekly' ? 1 : 1 })} options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'yearly', label: 'Yearly' }]} />
        {f.freq === 'weekly' ? (
          <select className="select" style={{ width: 'auto' }} value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value) })}>
            {WEEKDAYS.map((w, i) => <option key={i} value={i}>{w}</option>)}
          </select>
        ) : (
          <>
            <select className="select" style={{ width: 'auto' }} value={f.day} onChange={(e) => setF({ ...f, day: Number(e.target.value) })}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d === 31 ? 'last day' : `on the ${ORD(d)}`}</option>)}
            </select>
            {f.freq === 'yearly' && (
              <select className="select" style={{ width: 'auto' }} value={f.month} onChange={(e) => setF({ ...f, month: Number(e.target.value) })}>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            )}
          </>
        )}
        <label className="row small">from <input className="input" type="date" style={{ width: 160 }} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></label>
      </div>
      <p className="tiny muted">It’s logged automatically on its date (and caught up if the app wasn’t open). Delete a single occurrence in the list if it didn’t happen that time.</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn primary"><Repeat size={15} /> {initial?.id ? 'Save' : 'Add recurring'}</button></div>
    </form>
  );
}

function RecurringCard({ ym, net, inHand }) {
  const { recurring, update, remove } = useData();
  const { fmt } = useMoney();
  const [editing, setEditing] = useState(null);
  const today = todayStr();
  const isCurrent = ym === monthOf(today);
  // What is still to come this month (after today).
  const rest = isCurrent ? Array.from({ length: daysInMonth(ym) - Number(today.slice(8)) }, (_, i) => addDays(today, i + 1)) : [];
  const upcoming = recurring.filter((r) => r.active).flatMap((r) => rest.filter((d) => d >= (r.startDate || '') && isDue(r, d)).map((d) => ({ r, d })));
  const upTotal = (type) => upcoming.filter((x) => x.r.type === type).reduce((n, x) => n + Number(x.r.amount), 0);
  const upIn = upTotal('income');
  const upOut = upTotal('expense');
  const fixedOut = sum(recurring.filter((r) => r.active && r.type === 'expense' && r.freq === 'monthly'));

  return (
    <div className="card">
      <div className="card-head"><h2><Repeat size={18} /> Recurring</h2><button className="btn sm" onClick={() => setEditing({})}><Plus size={14} /> Add</button></div>
      {recurring.length === 0 ? <p className="small muted">Salary, subscriptions, phone, rent… add them once and they’re logged automatically every time.</p> : (
        <div className="stack" style={{ gap: 4 }}>
          {recurring.map((r) => {
            const c = (r.type === 'expense' ? EXPENSE_CATS : INCOME_CATS)[r.category] || EXPENSE_CATS.other;
            const next = r.active ? nextDue(r, addDays(today, 1)) : null;
            return (
              <div key={r.id} className={cx('tx', !r.active && 'paused')}>
                <span className="tx-icon">{c.icon}</span>
                <div className="grow">
                  <div>{r.note || c.label}</div>
                  <div className="tiny muted">{describeRecurring(r)}{next ? ` · next ${fmtDate(next, { day: 'numeric', month: 'short' })}` : r.active ? '' : ' · paused'}</div>
                </div>
                <b className={cx('nums', r.type === 'income' && 'good-text')}>{r.type === 'income' ? '+' : '−'}{fmt(r.amount)}</b>
                <button className="icon-btn" title={r.active ? 'Pause' : 'Resume'} onClick={() => update('recurring', r.id, { active: !r.active })}>{r.active ? <Pause size={14} /> : <PlayCircle size={14} />}</button>
                <button className="icon-btn" onClick={() => setEditing(r)}><Pencil size={14} /></button>
                <button className="icon-btn" onClick={() => confirm('Delete this recurring item? Already-logged transactions stay.') && remove('recurring', r.id)}><Trash2 size={14} /></button>
              </div>
            );
          })}
          <div className="divider" />
          <div className="row between small"><span className="muted">Fixed monthly expenses</span><b>{fmt(fixedOut)}</b></div>
          {isCurrent && (
            <>
              <div className="row between small"><span className="muted">Still due this month</span><b className="nums">{upIn ? <span className="good-text">+{fmt(upIn)} </span> : null}{upOut ? `−${fmt(upOut)}` : upIn ? '' : '—'}</b></div>
              <div className="row between small"><span className="muted">{inHand == null ? 'Expected balance at month end' : 'Expected in hand at month end'}</span><b className={cx((inHand ?? net) + upIn - upOut < 0 ? 'warn-text' : 'good-text')}>{fmt((inHand ?? net) + upIn - upOut)}</b></div>
            </>
          )}
        </div>
      )}
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Edit recurring' : 'New recurring'} width={760}>
        {editing && <RecurringForm initial={editing.id ? editing : null} onDone={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}

export default function Money() {
  const { transactions, remove, settings, saveSettings } = useData();
  const { fmt, short, currency } = useMoney();
  const [ym, setYm] = useState(monthOf(todayStr()));
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null);
  const [editStart, setEditStart] = useState(false);
  const today = todayStr();

  const month = transactions.filter((t) => monthOf(t.date) === ym);
  const exp = month.filter((t) => t.type === 'expense');
  const inc = month.filter((t) => t.type === 'income');
  const spent = sum(exp), earned = sum(inc), net = earned - spent;
  const nDays = daysInMonth(ym);
  const isCurrent = ym === monthOf(today);
  const elapsed = isCurrent ? Number(today.slice(8)) : ym < monthOf(today) ? nDays : 0;
  const days = Array.from({ length: nDays }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`);
  const spentOn = (d) => sum(exp.filter((t) => t.date === d));
  const noSpend = days.slice(0, elapsed).filter((d) => spentOn(d) === 0).length;
  const todaySpent = sum(transactions.filter((t) => t.type === 'expense' && t.date === today));
  const sadaqa = sum(exp.filter((t) => t.category === 'sadaqa'));
  const biggest = [...exp].sort((a, b) => b.amount - a.amount)[0];
  const budget = Number(settings.monthlyBudget) || 0;
  // Money in hand at the end of this month (today for the current one): starting money ± everything since.
  const start = settings.startingMoney;
  const until = isCurrent ? today : `${ym}-${String(nDays).padStart(2, '0')}`;
  const sinceStart = start ? transactions.filter((t) => t.date >= start.date && t.date <= until) : [];
  const inHand = !start || until < start.date ? null
    : Number(start.amount) + sum(sinceStart.filter((t) => t.type === 'income')) - sum(sinceStart.filter((t) => t.type === 'expense'));

  const dailyCols = days.map((d) => ({
    label: String(Number(d.slice(8))), title: fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }),
    segments: [{ key: 'e', name: 'Spent', value: spentOn(d), color: 'var(--cat-2)' }],
  }));
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(ym, i - 5));
  const trendCols = months.map((m) => {
    const list = transactions.filter((t) => monthOf(t.date) === m);
    return {
      label: monthName(m, { month: 'short' }), title: monthName(m),
      segments: [
        { key: 'i', name: 'Received', value: sum(list.filter((t) => t.type === 'income')), color: 'var(--cat-1)' },
        { key: 'e', name: 'Spent', value: sum(list.filter((t) => t.type === 'expense')), color: 'var(--cat-2)' },
      ],
    };
  });
  const catRows = Object.entries(EXPENSE_CATS)
    .map(([k, c]) => ({ label: `${c.icon} ${c.label}`, value: sum(exp.filter((t) => t.category === k)) }))
    .filter((r) => r.value > 0).sort((a, b) => b.value - a.value);
  // Which weekday you tend to spend the most (last 90 days).
  const recent = transactions.filter((t) => t.type === 'expense' && t.date > addDays(today, -90));
  const byWeekday = WEEKDAYS.map((name, i) => ({ name, value: sum(recent.filter((t) => parseDate(t.date).getDay() === i)) }));
  const topWeekday = [...byWeekday].sort((a, b) => b.value - a.value)[0];

  const list = month
    .filter((t) => filter === 'all' || t.type === filter)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  const byDay = list.reduce((m, t) => ((m[t.date] ||= []).push(t), m), {});

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Money</h1>
          <div className="sub">Know where it goes. Spend on purpose — and remember sadaqa never decreases wealth.</div>
        </div>
        <div className="row">
          <select className="select" style={{ width: 96 }} value={currency} onChange={(e) => saveSettings({ currency: e.target.value })} title="Currency">
            {[...new Set([currency, ...CURRENCIES])].map((c) => <option key={c} value={c}>{CURRENCY_LABELS[c] || c}</option>)}
          </select>
          <button className="icon-btn" onClick={() => setYm(shiftMonth(ym, -1))}><ChevronLeft size={18} /></button>
          <b style={{ minWidth: 130, textAlign: 'center' }}>{monthName(ym)}</b>
          <button className="icon-btn" disabled={isCurrent} onClick={() => setYm(shiftMonth(ym, 1))}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="card hero" style={{ marginBottom: 18 }}>
        <TxForm key={ym} />
      </div>

      <div className="grid g-4" style={{ marginBottom: 18 }}>
        <div className="card"><div className="stat"><span className="label"><TrendingDown size={13} /> Spent</span><span className="value">{fmt(spent)}</span>
          <span className="hint">{elapsed ? `≈ ${fmt(Math.round(spent / elapsed))} per day` : '—'}</span></div></div>
        <div className="card"><div className="stat"><span className="label"><TrendingUp size={13} /> Received</span><span className="value">{fmt(earned)}</span>
          <span className="hint">{!earned ? `${inc.length} entr${inc.length === 1 ? 'y' : 'ies'}` : net >= 0 ? `${Math.round((net / earned) * 100)}% of it kept` : `${fmt(-net)} more went out`}</span></div></div>
        <div className="card"><div className="stat">
          <span className="label row between"><span><PiggyBank size={13} /> {start ? 'In hand' : 'Balance'}</span>
            <button className="icon-btn" style={{ width: 20, height: 18 }} title="Starting money" onClick={() => setEditStart(true)}><Pencil size={12} /></button></span>
          {start ? (
            <>
              <span className="value" style={{ color: inHand < 0 ? 'var(--bad)' : undefined }}>{inHand == null ? '—' : fmt(inHand)}</span>
              <span className="hint">{inHand == null ? `you started counting on ${fmtDate(start.date, { day: 'numeric', month: 'short' })}` : `started with ${fmt(start.amount)} on ${fmtDate(start.date, { day: 'numeric', month: 'short' })}`}</span>
            </>
          ) : (
            <>
              <span className="value" style={{ color: net < 0 ? 'var(--bad)' : net > 0 ? 'var(--good-text)' : undefined }}>{net > 0 ? '+' : ''}{fmt(net)}</span>
              <button className="btn ghost sm" style={{ alignSelf: 'flex-start', padding: '2px 0' }} onClick={() => setEditStart(true)}>Set the money you start with →</button>
            </>
          )}
        </div></div>
        <div className="card"><div className="stat"><span className="label"><Wallet size={13} /> Today</span><span className="value">{fmt(todaySpent)}</span>
          <span className="hint">{noSpend} no-spend day{noSpend === 1 ? '' : 's'} this month</span></div></div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2><BarChart3 size={18} /> Spending per day</h2><span className="small muted">{monthName(ym)}</span></div>
            <BarChart columns={dailyCols} format={fmt} axisFormat={short} emptyText="No expenses this month"
              refLine={budget ? { value: budget / nDays, label: `daily budget ${short(budget / nDays)}` } : null} />
          </div>
          <div className="card">
            <div className="card-head"><h2><TrendingUp size={18} /> Received vs spent</h2><span className="small muted">last 6 months</span></div>
            <Legend items={[{ name: 'Received', color: 'var(--cat-1)' }, { name: 'Spent', color: 'var(--cat-2)' }]} />
            <div className="mt-1"><BarChart grouped columns={trendCols} format={fmt} axisFormat={short} height={190} emptyText="Nothing logged yet" /></div>
          </div>
          <div className="card">
            <div className="card-head">
              <h2><ListOrdered size={18} /> Transactions</h2>
              <Seg value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Spent' }, { value: 'income', label: 'Received' }]} />
            </div>
            {list.length === 0 ? <Empty icon={Wallet}>Nothing logged for {monthName(ym)}. Log as you go — it takes 5 seconds.</Empty> : (
              <div className="stack" style={{ gap: 14 }}>
                {Object.entries(byDay).map(([d, txs]) => {
                  const dayNet = sum(txs.filter((t) => t.type === 'income')) - sum(txs.filter((t) => t.type === 'expense'));
                  return (
                    <div key={d}>
                      <div className="row between tx-day">
                        <span>{d === today ? 'Today' : fmtDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                        <span className={cx('nums', dayNet < 0 ? 'muted' : 'good-text')}>{dayNet > 0 ? '+' : ''}{fmt(dayNet)}</span>
                      </div>
                      {txs.map((t) => {
                        const c = (t.type === 'expense' ? EXPENSE_CATS : INCOME_CATS)[t.category] || EXPENSE_CATS.other;
                        return (
                          <div key={t.id} className="tx">
                            <span className="tx-icon">{c.icon}</span>
                            <div className="grow">
                              <div>{t.note || c.label}{t.recurringId && <Repeat size={12} className="muted" style={{ marginLeft: 6, verticalAlign: -1 }} />}</div>
                              {t.note && <div className="tiny muted">{c.label}</div>}
                            </div>
                            <b className={cx('nums', t.type === 'income' ? 'good-text' : '')}>{t.type === 'income' ? '+' : '−'}{fmt(t.amount)}</b>
                            <button className="icon-btn" onClick={() => setEditing(t)}><Pencil size={14} /></button>
                            <button className="icon-btn" onClick={() => remove('transactions', t.id)}><Trash2 size={14} /></button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <Budget ym={ym} spent={spent} />
          <RecurringCard ym={ym} net={net} inHand={inHand} />
          <div className="card">
            <div className="card-head"><h2>Where it went</h2><span className="small muted">{monthName(ym, { month: 'long' })}</span></div>
            {catRows.length === 0 ? <p className="small muted">No expenses yet.</p>
              : <HBars rows={catRows} color="var(--cat-2)" format={short} />}
            {catRows[0] && spent > 0 && (
              <p className="small text-2 mt-2"><b>{catRows[0].label}</b> is {Math.round((catRows[0].value / spent) * 100)}% of your spending this month.</p>
            )}
          </div>
          <div className="card gold">
            <div className="card-head"><h2><HandHeart size={18} style={{ color: 'var(--gold)' }} /> Sadaqa</h2></div>
            <div className="stat"><span className="value">{fmt(sadaqa)}</span>
              <span className="hint">{earned ? `${((sadaqa / earned) * 100).toFixed(1)}% of what you received this month` : 'this month'}</span></div>
            <p className="reminder small mt-2">“Charity does not decrease wealth.”<cite>— Sahih Muslim</cite></p>
          </div>
          <div className="card">
            <div className="card-head"><h2><CalendarCheck2 size={18} /> Patterns</h2></div>
            <div className="stack small" style={{ gap: 8 }}>
              <div className="row between"><span className="muted">No-spend days</span><b>{noSpend} / {elapsed}</b></div>
              <div className="row between"><span className="muted">Biggest expense</span><b>{biggest ? `${fmt(biggest.amount)}` : '—'}</b></div>
              {biggest && <div className="tiny muted" style={{ marginTop: -6 }}>{biggest.note || EXPENSE_CATS[biggest.category]?.label} · {fmtDate(biggest.date, { day: 'numeric', month: 'short' })}</div>}
              <div className="row between"><span className="muted">You spend most on</span><b>{topWeekday?.value ? `${topWeekday.name}s` : '—'}</b></div>
              <div className="row between"><span className="muted">Entries this month</span><b>{month.length}</b></div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={editStart} onClose={() => setEditStart(false)} title="Starting money" width={620}>
        {editStart && <StartingMoneyForm onDone={() => setEditStart(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit transaction" width={760}>
        {editing && <TxForm initial={editing} onDone={() => setEditing(null)} />}
      </Modal>
    </>
  );
}
