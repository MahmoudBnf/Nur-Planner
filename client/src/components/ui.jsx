import { useEffect } from 'react';
import { X } from 'lucide-react';
import { cx } from '../lib/utils.js';
import { CATEGORIES } from '../lib/constants.js';

export function Modal({ open, onClose, title, children, width }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={width ? { width: `min(${width}px, 100%)` } : undefined}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Empty({ icon: Icon, children }) {
  return (
    <div className="empty">
      {Icon && <Icon size={32} />}
      <div>{children}</div>
    </div>
  );
}

export function Seg({ value, onChange, options }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={String(o.value)} className={cx(value === o.value && 'on')} onClick={() => onChange(o.value)} type="button">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function CatChip({ cat }) {
  const c = CATEGORIES[cat];
  if (!c) return null;
  return (
    <span className="chip" title={c.long}>
      <span className="dot" style={{ background: c.color }} /> {c.label}
    </span>
  );
}

export function Progress({ value }) {
  return (
    <div className="progress"><div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
  );
}

export function Ring({ value, size = 64, stroke = 7, children, color = 'var(--accent)' }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-3)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.max(0, Math.min(1, value)))} style={{ transition: 'stroke-dashoffset 0.4s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: size / 4.2 }}>
        {children}
      </div>
    </div>
  );
}
