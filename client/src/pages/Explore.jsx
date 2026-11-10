import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Play, Plus, Trash2, Shuffle } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { NEW_KINDS, NEW_STATUS } from '../lib/constants.js';
import { cx, daySeed } from '../lib/utils.js';
import { Empty, Seg } from '../components/ui.jsx';

export default function Explore() {
  const { newThings, add, update, remove } = useData();
  const nav = useNavigate();
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState('Game');
  const [filter, setFilter] = useState('all');
  const [shuffle, setShuffle] = useState(0);

  const waiting = newThings.filter((t) => t.status === 'waiting');
  const pick = waiting.length ? waiting[(daySeed() + shuffle) % waiting.length] : null;
  const list = newThings
    .filter((t) => filter === 'all' || t.status === filter)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    await add('newThings', { title: title.trim(), kind, status: 'waiting', note: '', minutes: 0 });
    setTitle('');
  };
  const tryIt = (t) => nav(`/focus?label=${encodeURIComponent(`Try: ${t.title}`)}&min=5&thing=${t.id}`);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Try new things</h1>
          <div className="sub">Practise starting the unfamiliar. You don’t have to love it — just give it a fair five minutes.</div>
        </div>
      </div>

      <div className="grid g-main">
        <div className="stack">
          <div className="card">
            <div className="card-head"><h2><Compass size={18} /> Your list</h2>
              <Seg value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, ...Object.entries(NEW_STATUS).map(([k, v]) => ({ value: k, label: v }))]} />
            </div>
            <form onSubmit={submit} className="row" style={{ marginBottom: 14 }}>
              <input className="input" placeholder="A new game, a skill, a book, a sport…" value={title} onChange={(e) => setTitle(e.target.value)} />
              <select className="select" style={{ width: 130 }} value={kind} onChange={(e) => setKind(e.target.value)}>
                {NEW_KINDS.map((k) => <option key={k}>{k}</option>)}
              </select>
              <button className="btn primary"><Plus size={16} /> Add</button>
            </form>
            {list.length === 0 ? <Empty icon={Compass}>Add things you’ve been putting off trying — even games count.</Empty> : (
              <div className="task-list">
                {list.map((t) => (
                  <div key={t.id} className="task" style={{ alignItems: 'center' }}>
                    <span className="chip">{t.kind}</span>
                    <div className="grow">
                      <div className="title">{t.title}</div>
                      <input className="input bare small" placeholder={t.status === 'waiting' ? 'What makes it feel hard to start?' : 'How was it? Verdict, remark…'} value={t.note || ''}
                        onChange={(e) => update('newThings', t.id, { note: e.target.value })} />
                    </div>
                    {t.minutes > 0 && <span className="tiny muted nums">{Math.round(t.minutes)} min</span>}
                    <select className="select" style={{ width: 140, padding: '5px 28px 5px 9px', fontSize: 12.5 }} value={t.status} onChange={(e) => update('newThings', t.id, { status: e.target.value })}>
                      {Object.entries(NEW_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    <button className="icon-btn" title="Try 5 minutes" onClick={() => tryIt(t)}><Play size={16} /></button>
                    <button className="icon-btn" onClick={() => remove('newThings', t.id)}><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack">
          <div className="card hero">
            <div className="card-head"><h2>Today’s unfamiliar thing</h2>
              {waiting.length > 1 && <button className="icon-btn" title="Another one" onClick={() => setShuffle((s) => s + 1)}><Shuffle size={16} /></button>}
            </div>
            {pick ? (
              <>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{pick.title}</div>
                <div className="chip mt-1">{pick.kind}</div>
                <p className="small text-2 mt-2">Launch it and do five minutes. Your goal is to learn: <i>“I can begin even when I don’t know exactly what I’m doing.”</i></p>
                <button className="btn gold lg mt-2" onClick={() => tryIt(pick)}><Play size={18} /> Try for 5 minutes</button>
              </>
            ) : <p className="muted">Add something you haven’t tried yet.</p>}
          </div>
          <div className="card">
            <div className="grid g-2">
              {Object.entries(NEW_STATUS).map(([k, v]) => (
                <div key={k} className="stat"><span className="label">{v}</span><span className="value">{newThings.filter((t) => t.status === k).length}</span></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
