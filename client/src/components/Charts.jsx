import { useRef, useState } from 'react';

// Vertical bar chart; each column is a stack (or, with `grouped`, side-by-side
// bars) of { key, value, color } segments. One y-axis, recessive grid, rounded
// data-ends, hover tooltip per column, optional dashed reference line.
export function BarChart({ columns, height = 200, format = (v) => v, axisFormat = format, emptyText = 'No data yet', grouped = false, refLine = null }) {
  const wrap = useRef(null);
  const [tip, setTip] = useState(null);
  const W = 640, H = height, padL = 44, padB = 22, padT = 8;
  const totals = columns.map((c) => c.segments.reduce((n, s) => n + s.value, 0));
  const peaks = grouped ? columns.map((c) => Math.max(0, ...c.segments.map((s) => s.value))) : totals;
  const max = Math.max(1, ...peaks, refLine?.value || 0);
  const nice = niceMax(max);
  const ticks = [0, nice / 2, nice];
  const innerW = W - padL;
  const nSeg = grouped ? Math.max(1, columns[0]?.segments.length || 1) : 1;
  const bw = Math.min(grouped ? 18 : 28, ((innerW / columns.length) * 0.62) / nSeg);
  const y = (v) => padT + (H - padB - padT) * (1 - v / nice);
  const allZero = totals.every((t) => t === 0);

  return (
    <div ref={wrap} style={{ position: 'relative' }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} onMouseLeave={() => setTip(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line className="gridline" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
            <text x={padL - 6} y={y(t) + 4} textAnchor="end">{axisFormat(Math.round(t))}</text>
          </g>
        ))}
        {columns.map((c, i) => {
          const cx = padL + (innerW / columns.length) * (i + 0.5);
          let acc = 0;
          const segs = c.segments.filter((s) => s.value > 0);
          return (
            <g key={i} className="col">
              <rect className="hl" x={cx - innerW / columns.length / 2} y={padT} width={innerW / columns.length} height={H - padB - padT} rx="6" />
              {grouped && c.segments.map((s, j) => {
                const x = cx - (bw * nSeg + 2 * (nSeg - 1)) / 2 + j * (bw + 2); // 2px gap between adjacent bars
                const h = y(0) - y(s.value);
                return s.value > 0 && <path key={s.key} d={roundedTop(x, y(s.value), bw, h, Math.min(4, h))} fill={s.color} />;
              })}
              {!grouped && segs.map((s, j) => {
                const y0 = y(acc), y1 = y(acc + s.value);
                acc += s.value;
                const top = j === segs.length - 1;
                const h = Math.max(0, y0 - y1 - (top ? 0 : 2)); // 2px surface gap between stacked fills
                return top
                  ? <path key={s.key} d={roundedTop(cx - bw / 2, y1, bw, h, Math.min(4, h))} fill={s.color} />
                  : <rect key={s.key} x={cx - bw / 2} y={y0 - h} width={bw} height={h} fill={s.color} />;
              })}
              {(i % Math.ceil(columns.length / 14) === 0) && <text x={cx} y={H - 6} textAnchor="middle">{c.label}</text>}
              <rect className="hit" x={cx - innerW / columns.length / 2} y={padT} width={innerW / columns.length} height={H - padT}
                onMouseMove={(e) => {
                  const r = wrap.current.getBoundingClientRect();
                  setTip({ x: e.clientX - r.left, y: e.clientY - r.top, c, total: totals[i] });
                }} />
            </g>
          );
        })}
        <line className="baseline" x1={padL} x2={W} y1={y(0)} y2={y(0)} />
        {refLine?.value > 0 && (
          <g style={{ pointerEvents: 'none' }}>
            <line x1={padL} x2={W} y1={y(refLine.value)} y2={y(refLine.value)} stroke="var(--gold)" strokeWidth="1.5" strokeDasharray="5 4" />
            <text x={W} y={y(refLine.value) - 5} textAnchor="end" style={{ fill: 'var(--gold)' }}>{refLine.label}</text>
          </g>
        )}
      </svg>
      {allZero && <div className="center small muted" style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>{emptyText}</div>}
      {tip && (
        <div className="tooltip" style={{ left: tip.x, top: tip.y }}>
          <b>{tip.c.title || tip.c.label}</b>
          {tip.c.segments.length > 1
            ? tip.c.segments.map((s) => (
              <div key={s.key} className="row" style={{ gap: 6 }}><span className="dot" style={{ background: s.color }} /> {s.name}: <b>{format(s.value)}</b></div>
            ))
            : <div>{format(tip.total)}</div>}
        </div>
      )}
    </div>
  );
}

function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}

function roundedTop(x, y, w, h, r) {
  if (h <= 0) return '';
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

export function Legend({ items }) {
  return (
    <div className="legend">
      {items.map((i) => <span key={i.name}><i style={{ background: i.color }} /> {i.name}</span>)}
    </div>
  );
}

export function HBars({ rows, color = 'var(--cat-1)', format = (v) => v }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div>
      {rows.map((r) => (
        <div key={r.label} className="hbar" title={`${r.label}: ${format(r.value)}`}>
          <span className="text-2" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {r.color && <span className="dot" style={{ background: r.color }} />}{r.label}
          </span>
          <div className="track"><div className="fill" style={{ width: `${(r.value / max) * 100}%`, background: r.color || color }} /></div>
          <span className="nums small">{format(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
