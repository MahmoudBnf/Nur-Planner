import { useMemo, useState } from 'react';
import { Lightbulb, Pin, Trash2, ListPlus, Target, Archive, ArchiveRestore, Search } from 'lucide-react';
import { useData } from '../state/DataContext.jsx';
import { addDays, cx, extractTags, todayStr, weekStartOf } from '../lib/utils.js';
import { Empty, Modal, Seg } from '../components/ui.jsx';

function ConvertModal({ idea, onClose }) {
  const { add, update, settings } = useData();
  const [when, setWhen] = useState('today');
  const [firstAction, setFirstAction] = useState('');
  const title = idea.text.replace(/#[\p{L}\d_-]+/gu, '').trim().split('\n')[0].slice(0, 120);
  const date = when === 'today' ? todayStr() : when === 'tomorrow' ? addDays(todayStr(), 1) : null;

  const toTask = async () => {
    const t = await add('tasks', { title, firstAction, category: 'growth', anchor: 'any', date: date || todayStr(), status: 'todo', started: false, main: false, fromIdea: idea.id });
    update('ideas', idea.id, { convertedTo: { type: 'task', id: t.id }, archived: true });
    onClose();
  };
  const toGoal = async () => {
    await add('weeklyGoals', { weekStart: weekStartOf(todayStr(), settings.weekStartsOn ?? 1), title, why: '', category: 'growth', progress: 0, status: 'active' });
    update('ideas', idea.id, { convertedTo: { type: 'goal' }, archived: true });
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Turn this idea into action">
      <p className="text-2"><b>{title}</b></p>
      <div className="stack mt-2" style={{ gap: 12 }}>
        <label className="field">When?
          <Seg value={when} onChange={setWhen} options={[{ value: 'today', label: 'Today' }, { value: 'tomorrow', label: 'Tomorrow' }]} />
        </label>
        <label className="field">First physical action (makes starting easier)
          <input className="input" value={firstAction} onChange={(e) => setFirstAction(e.target.value)} placeholder='e.g. "open the docs and read the intro"' />
        </label>
        <div className="row">
          <button className="btn primary" onClick={toTask}><ListPlus size={16} /> Create task</button>
          <button className="btn" onClick={toGoal}><Target size={16} /> Make it a weekly objective</button>
        </div>
      </div>
    </Modal>
  );
}

export default function Ideas() {
  const { ideas, add, update, remove } = useData();
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  const [tag, setTag] = useState(null);
  const [view, setView] = useState('inbox');
  const [converting, setConverting] = useState(null);

  const allTags = useMemo(() => {
    const m = {};
    ideas.filter((i) => !i.archived).forEach((i) => (i.tags || []).forEach((t) => (m[t] = (m[t] || 0) + 1)));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [ideas]);

  const list = ideas
    .filter((i) => (view === 'inbox' ? !i.archived : i.archived))
    .filter((i) => !tag || (i.tags || []).includes(tag))
    .filter((i) => !q || i.text.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => (b.pinned - a.pinned) || b.createdAt.localeCompare(a.createdAt));

  const save = async () => {
    if (!text.trim()) return;
    await add('ideas', { text: text.trim(), tags: extractTags(text), pinned: false, archived: false });
    setText('');
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Ideas & brain dump</h1>
          <div className="sub">Empty your head here so it stops pulling at you. Sort it later, turn the good ones into action.</div>
        </div>
      </div>

      <div className="card hero">
        <div className="capture">
          <textarea className="textarea" style={{ minHeight: 70 }} placeholder="What’s on your mind? Thoughts, worries, project ideas, things to try… (#tags supported)"
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }} />
          <button className="btn primary" onClick={save}>Save</button>
        </div>
        <div className="tiny muted mt-1"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to save · <span className="kbd">Ctrl</span> + <span className="kbd">K</span> captures from any page</div>
      </div>

      <div className="row wrap between mt-3" style={{ marginBottom: 14 }}>
        <div className="row wrap">
          <Seg value={view} onChange={setView} options={[{ value: 'inbox', label: 'Inbox' }, { value: 'archive', label: 'Archive' }]} />
          <span className={cx('chip click', !tag && 'on')} onClick={() => setTag(null)}>All</span>
          {allTags.map(([t, n]) => (
            <span key={t} className={cx('chip click', tag === t && 'on')} onClick={() => setTag(tag === t ? null : t)}>#{t} <span className="muted">{n}</span></span>
          ))}
        </div>
        <div className="row" style={{ width: 260 }}>
          <Search size={16} className="muted" />
          <input className="input" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {list.length === 0 ? <div className="card flat"><Empty icon={Lightbulb}>{view === 'inbox' ? 'Inbox is empty — a clear mind.' : 'Nothing archived.'}</Empty></div> : (
        <div className="ideas-grid">
          {list.map((i) => (
            <div key={i.id} className={cx('idea', i.pinned && 'pinned')}>
              <div className="body">{i.text}</div>
              <div className="foot">
                <span className="tiny muted">{new Date(i.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  {i.convertedTo && <> · <span style={{ color: 'var(--accent)' }}>→ {i.convertedTo.type}</span></>}</span>
                <div className="row" style={{ gap: 0 }}>
                  {!i.archived && <button className="icon-btn" title="Turn into task / objective" onClick={() => setConverting(i)}><ListPlus size={15} /></button>}
                  <button className={cx('icon-btn', i.pinned && 'on')} title="Pin" onClick={() => update('ideas', i.id, { pinned: !i.pinned })}><Pin size={15} /></button>
                  <button className="icon-btn" title={i.archived ? 'Restore' : 'Archive'} onClick={() => update('ideas', i.id, { archived: !i.archived })}>
                    {i.archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                  </button>
                  <button className="icon-btn" title="Delete" onClick={() => remove('ideas', i.id)}><Trash2 size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {converting && <ConvertModal idea={converting} onClose={() => setConverting(null)} />}
    </>
  );
}
