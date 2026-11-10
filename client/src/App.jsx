import { useEffect, useState } from 'react';
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  Sun, Timer, CalendarDays, Repeat, Wallet, BookMarked, BedDouble, CalendarCheck, Lightbulb, ClipboardCheck, Moon, Flame, Compass, BarChart3,
  BookOpen, Settings as SettingsIcon, Menu, X, Clock,
} from 'lucide-react';
import { useData } from './state/DataContext.jsx';
import { PrayerProvider, usePrayer } from './state/PrayerContext.jsx';
import { FocusProvider, useFocus } from './state/FocusContext.jsx';
import { fmtCountdown, fmtTimer, cx, todayStr, extractTags, onDay } from './lib/utils.js';
import { Modal } from './components/ui.jsx';
import Today from './pages/Today.jsx';
import Focus, { FinishedModal } from './pages/Focus.jsx';
import Week from './pages/Week.jsx';
import Ideas from './pages/Ideas.jsx';
import Review from './pages/Review.jsx';
import Salah from './pages/Salah.jsx';
import Challenge from './pages/Challenge.jsx';
import Explore from './pages/Explore.jsx';
import Insights from './pages/Insights.jsx';
import Guide from './pages/Guide.jsx';
import Settings from './pages/Settings.jsx';
import Routines from './pages/Routines.jsx';
import Money from './pages/Money.jsx';
import Quran from './pages/Quran.jsx';
import Sleep from './pages/Sleep.jsx';
import Summary from './pages/Summary.jsx';
import { durationMin, fmtDur, nowLocal, timeOf } from './lib/sleep.js';
import { Reminders } from './components/Reminders.jsx';
import { useQuranAutoRecord } from './state/useQuran.js';

const NAV = [
  { section: 'Daily' },
  { to: '/', label: 'Today', icon: Sun, end: true },
  { to: '/routines', label: 'Routines', icon: Repeat },
  { to: '/focus', label: 'Focus', icon: Timer },
  { to: '/review', label: 'Review', icon: ClipboardCheck },
  { to: '/salah', label: 'Salah', icon: Moon },
  { to: '/quran', label: "Qur'an", icon: BookMarked },
  { to: '/sleep', label: 'Sleep', icon: BedDouble },
  { section: 'Plan' },
  { to: '/week', label: 'Week', icon: CalendarDays },
  { to: '/ideas', label: 'Ideas', icon: Lightbulb, badge: 'ideas' },
  { to: '/money', label: 'Money', icon: Wallet },
  { to: '/challenge', label: '14-Day Challenge', icon: Flame },
  { to: '/explore', label: 'Try New Things', icon: Compass },
  { section: 'Reflect' },
  { to: '/summary', label: 'Weekly summary', icon: CalendarCheck },
  { to: '/insights', label: 'Insights', icon: BarChart3 },
  { to: '/guide', label: 'Guide', icon: BookOpen },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

function Sidebar({ open, onClose }) {
  const { ideas, tasks, sleeps, add, update } = useData();
  const prayer = usePrayer();
  const sleeping = sleeps.find((s) => !s.end);
  // After Isha (or after midnight, before Fajr) offer a one-tap "going to sleep".
  const night = prayer.current?.name === 'Isha' || (prayer.day && !prayer.current);
  const focus = useFocus();
  const nav = useNavigate();
  const todayOpen = tasks.filter((t) => onDay(t, todayStr()) && t.scope !== 'week' && t.status === 'todo').length;
  const badges = { ideas: ideas.filter((i) => !i.archived).length || null };

  return (
    <aside className={cx('sidebar', open && 'open')}>
      <div className="brand">
        <div className="brand-logo">ن</div>
        <div className="grow"><b>Nur Planner</b><small>Start first. Feel later.</small></div>
        <button className="icon-btn mobile-only" onClick={onClose} style={{ display: open ? 'grid' : 'none' }}><X size={18} /></button>
      </div>
      <nav className="nav">
        {NAV.map((n, i) =>
          n.section ? <div key={i} className="nav-section">{n.section}</div> : (
            <NavLink key={n.to} to={n.to} end={n.end} onClick={onClose}>
              <n.icon size={18} /> {n.label}
              {n.to === '/' && todayOpen > 0 && <span className="badge">{todayOpen}</span>}
              {n.badge && badges[n.badge] && <span className="badge">{badges[n.badge]}</span>}
            </NavLink>
          ),
        )}
      </nav>
      <div className="sidebar-foot">
        {sleeping ? (
          <div className="mini-card sleeping" onClick={() => nav('/sleep')}>
            <BedDouble size={18} />
            <div className="grow">
              <div className="tiny muted">Sleeping since {timeOf(sleeping.start)}</div>
              <div className="big">{fmtDur(durationMin(sleeping))}</div>
            </div>
            {durationMin(sleeping) <= 14 * 60 && <button className="btn sm gold" onClick={(e) => { e.stopPropagation(); update('sleeps', sleeping.id, { end: nowLocal() }); }}>Woke up</button>}
          </div>
        ) : night && (
          <button className="btn ghost sm" onClick={() => add('sleeps', { start: nowLocal(), end: null })}><Moon size={14} /> Going to sleep</button>
        )}
        {focus.session && (
          <div className="mini-card timer" onClick={() => nav('/focus')}>
            <Timer size={18} />
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="big">{fmtTimer(focus.remaining)} {focus.session.pausedLeft != null && '· paused'}</div>
              <div className="tiny muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{focus.session.label || 'Focus'}</div>
            </div>
          </div>
        )}
        {prayer.next ? (
          <div className="mini-card" onClick={() => nav('/salah')} style={{ cursor: 'pointer' }}>
            <Clock size={18} style={{ color: 'var(--gold)' }} />
            <div className="grow">
              <div className="tiny muted">Next: {prayer.next.name} · {prayer.next.time}</div>
              <div className="big">in {fmtCountdown(prayer.nextIn)}</div>
            </div>
          </div>
        ) : prayer.noLocation ? (
          <div className="mini-card" onClick={() => nav('/salah')} style={{ cursor: 'pointer' }}>
            <Moon size={18} /> <span className="small">Choose your city for salah times</span>
          </div>
        ) : null}
        <div className="tiny muted center"><span className="kbd">Ctrl</span> + <span className="kbd">K</span> quick capture</div>
      </div>
    </aside>
  );
}

// Ctrl/Cmd+K anywhere: dump a thought into Ideas without leaving the page.
function QuickCapture() {
  const { add } = useData();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const save = async () => {
    if (!text.trim()) return;
    await add('ideas', { text: text.trim(), tags: extractTags(text), pinned: false, archived: false });
    setText(''); setOpen(false);
  };
  return (
    <Modal open={open} onClose={() => setOpen(false)} title="Quick capture">
      <textarea className="textarea" autoFocus placeholder="Get it out of your head… use #tags if you like" value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save(); }} />
      <div className="row between mt-2">
        <span className="tiny muted"><span className="kbd">Ctrl</span> + <span className="kbd">Enter</span> to save</span>
        <button className="btn primary" onClick={save}>Save to Ideas</button>
      </div>
    </Modal>
  );
}

function Shell() {
  const { settings, error, clearError } = useData();
  const [menu, setMenu] = useState(false);
  const loc = useLocation();
  useQuranAutoRecord();
  useEffect(() => { document.documentElement.dataset.theme = settings.theme || 'dark'; }, [settings.theme]);
  useEffect(() => { window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="shell">
      <Sidebar open={menu} onClose={() => setMenu(false)} />
      <main className="main">
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setMenu(true)}><Menu size={20} /></button>
          <b>Nur Planner</b>
        </div>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/routines" element={<Routines />} />
          <Route path="/focus" element={<Focus />} />
          <Route path="/week" element={<Week />} />
          <Route path="/ideas" element={<Ideas />} />
          <Route path="/money" element={<Money />} />
          <Route path="/quran" element={<Quran />} />
          <Route path="/sleep" element={<Sleep />} />
          <Route path="/summary" element={<Summary />} />
          <Route path="/review" element={<Review />} />
          <Route path="/salah" element={<Salah />} />
          <Route path="/challenge" element={<Challenge />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
      <QuickCapture />
      <FinishedModal />
      <Reminders />
      {error && (
        <div className="toast">{error} <button className="icon-btn" style={{ color: 'white' }} onClick={clearError}><X size={16} /></button></div>
      )}
    </div>
  );
}

export default function App() {
  const { ready, error } = useData();
  if (!ready) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: '100vh', color: 'var(--muted)', textAlign: 'center', padding: 20 }}>
        {error ? (
          <div style={{ maxWidth: 380 }}>
            <b style={{ color: 'var(--text)' }}>Can’t reach your planner</b>
            <p className="small" style={{ lineHeight: 1.6 }}>
              {location.hostname === 'localhost' || location.hostname === '127.0.0.1'
                ? <>The server isn’t running. Start it with <code>./start.sh</code> (or <code>npm start</code>).</>
                : <>Your data lives on your PC. Check that the PC is on and awake, that the planner is running on it, and that Tailscale is switched on on this phone.</>}
            </p>
            <p className="tiny">({error})</p>
            <button className="btn primary" onClick={() => location.reload()}>Try again</button>
          </div>
        ) : 'Loading…'}
      </div>
    );
  }
  return (
    <PrayerProvider>
      <FocusProvider>
        <Shell />
      </FocusProvider>
    </PrayerProvider>
  );
}
