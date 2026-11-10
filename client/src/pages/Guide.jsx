import { BookOpen, RefreshCcw, Footprints, Layers, Moon, HandHeart, Key } from 'lucide-react';
import { AVOID_REASONS, DUA } from '../lib/constants.js';

export default function Guide() {
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Guide</h1>
          <div className="sub">The principles behind this app, in one place. Read it when you feel stuck.</div>
        </div>
      </div>

      <div className="card hero" style={{ marginBottom: 18 }}>
        <h2><Key size={18} style={{ color: 'var(--gold)', verticalAlign: -3 }} /> If you remember only three things</h2>
        <ol className="mt-2" style={{ paddingLeft: 20, fontSize: 15.5, lineHeight: 1.8 }}>
          <li>Don’t wait for motivation; make the first step <b>small enough to take without it</b>.</li>
          <li>Decide your priorities <b>before distractions decide them for you</b>.</li>
          <li>When you fall behind, return to <b>the next right action</b> instead of punishing yourself.</li>
        </ol>
      </div>

      <div className="grid g-2">
        <div className="card guide-card">
          <h3><RefreshCcw size={17} /> The avoidance cycle</h3>
          <div className="cycle">
            <div><b>1 · Think</b><span className="small muted">“I should study / try that game.”</span></div>
            <div><b>2 · Discomfort</b><span className="small muted">Uncertainty, effort, boredom, pressure.</span></div>
            <div><b>3 · Escape</b><span className="small muted">Instagram, YouTube, something familiar.</span></div>
            <div><b>4 · Relief → regret</b><span className="small muted">Avoiding feels better now, reinforcing it next time.</span></div>
          </div>
          <p className="small text-2 mt-2">The problem isn’t laziness. It’s tolerating the feeling that comes <i>just before</i> starting. That is a skill — and skills are trained.</p>
        </div>

        <div className="card guide-card">
          <h3><Footprints size={17} /> Four techniques</h3>
          <ul>
            <li><b>Five-minute entry</b> — you only have to do five minutes. Then you may stop.</li>
            <li><b>Define the first physical action</b> — not “study PostgreSQL” but “open my notes and explain one index type”.</li>
            <li><b>Make avoidance harder</b> — phone in another room, apps logged out, materials already open.</li>
            <li><b>Practise starting the unfamiliar</b> — one new thing a day for 5–10 minutes.</li>
          </ul>
        </div>

        <div className="card guide-card">
          <h3><Layers size={17} /> Name what you feel</h3>
          <div className="stack" style={{ gap: 6 }}>
            {Object.values(AVOID_REASONS).map((r) => (
              <div key={r.label} className="small"><b>{r.label}</b> <span className="muted">— {r.feel}.</span><br /><span className="text-2">→ {r.fix}</span></div>
            ))}
          </div>
        </div>

        <div className="card guide-card">
          <h3><Moon size={17} /> Order of priorities</h3>
          <ol>
            <li><b>Obligations to Allah</b> — guard the five prayers in their times; let them structure the day.</li>
            <li><b>Rights & responsibilities</b> — parents, family, studies/work, promises, deadlines.</li>
            <li><b>Beneficial development</b> — study, craft, projects, beneficial knowledge.</li>
            <li><b>Rest & recreation</b> — games and anime have a place (the After Isha block is made for it), without displacing the above or sleep.</li>
          </ol>
          <p className="small muted mt-2">Not a rigid ranking — a principle for deciding, so the easiest activity doesn’t win by default.</p>
        </div>

        <div className="card guide-card gold">
          <h3><HandHeart size={17} /> Intention, effort, reliance</h3>
          <p className="reminder">“And that there is not for man except that [good] for which he strives.”<cite>— Qur’an 53:39</cite></p>
          <p className="reminder mt-2">“So when you have decided, then rely upon Allah.”<cite>— Qur’an 3:159</cite></p>
          <p className="small text-2 mt-2">Decide, take the means, then trust Allah. Tawakkul is not passively waiting for motivation to arrive.</p>
        </div>

        <div className="card guide-card dua">
          <h3><BookOpen size={17} /> A du‘a before starting</h3>
          <div className="ar">{DUA.ar}</div>
          <p className="small muted"><i>{DUA.tr}</i></p>
          <p className="text-2 mt-1">{DUA.en}</p>
          <div className="divider" />
          <p className="small text-2">Instead of “I’m wasting my life, I’m lazy” → <b>“I have time and abilities I want to use well. I haven’t started yet, so I’ll begin with what I can do now.”</b></p>
        </div>
      </div>

      <p className="small muted mt-3">If difficulty starting has affected many areas of life for years despite reasonable changes, it can be worth talking with a qualified health professional (sleep, anxiety, low mood or attention difficulties can play a part). It isn’t a character flaw.</p>
    </>
  );
}
