'use client';
import { useMemo, useRef, useState } from 'react';
import { formatRibuan } from '@/lib/format';

/** Input rupiah: 1000000 tampil 1.000.000 */
export function MoneyInput({ value, onChange, ...rest }) {
  return (
    <input {...rest} className="input num" inputMode="numeric" value={value}
      onChange={(e) => onChange(formatRibuan(e.target.value))} />
  );
}

/** Input angka desimal (boleh koma atau titik) */
export function DecimalInput({ value, onChange, ...rest }) {
  return (
    <input {...rest} className="input num" inputMode="decimal" value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))} />
  );
}

/**
 * Kombobox kota dengan saran dari database (nama, alias, nama distributor).
 * items: [{ value, label, sub }]
 */
export function Combobox({ id, value, onChange, items, placeholder, onPick }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const ref = useRef(null);
  const list = useMemo(() => {
    const t = value.trim().toUpperCase();
    if (!t) return items.slice(0, 50);
    const starts = [], has = [];
    for (const it of items) {
      const hay = (it.label + ' ' + (it.search || '')).toUpperCase();
      if (it.label.toUpperCase().startsWith(t)) starts.push(it);
      else if (hay.includes(t)) has.push(it);
    }
    return [...starts, ...has].slice(0, 50);
  }, [value, items]);

  function pick(it) {
    onChange(it.value); setOpen(false); onPick?.(it);
  }
  function key(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, list.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Enter' && open && list[hi]) { e.preventDefault(); pick(list[hi]); }
    else if (e.key === 'Escape') setOpen(false);
  }
  return (
    <div className="combo" ref={ref} onBlur={(e) => !ref.current.contains(e.relatedTarget) && setOpen(false)}>
      <input id={id} className="input" value={value} placeholder={placeholder} autoComplete="off" role="combobox"
        aria-expanded={open} aria-controls={id + '-list'} aria-autocomplete="list"
        onChange={(e) => { onChange(e.target.value.toUpperCase()); setOpen(true); setHi(0); }}
        onFocus={() => setOpen(true)} onKeyDown={key} />
      {open && list.length > 0 && (
        <ul id={id + '-list'} role="listbox">
          {list.map((it, i) => (
            <li key={it.key || it.value + i} role="option" aria-selected={i === hi} tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); pick(it); }} onMouseEnter={() => setHi(i)}>
              <span>{it.label}</span>{it.sub && <small>{it.sub}</small>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
