'use client';
import { useMemo, useState } from 'react';

/**
 * Tabel dengan pencarian, urut kolom, dan halaman.
 * columns: [{ key, label, num?, render?(row), value?(row) }]
 */
export default function DataTable({
  columns, rows, pageSizes = [10, 25, 50, 100], defaultSize = 25, search = true, rowClass, toolbar, initialSort, empty = 'Belum ada data.', nowrap,
}) {
  const [q, setQ] = useState('');
  const [size, setSize] = useState(defaultSize);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(initialSort || null);

  const val = (c, r) => (c.value ? c.value(r) : r[c.key]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    let out = rows;
    if (t) out = rows.filter((r) => columns.some((c) => String(val(c, r) ?? '').toLowerCase().includes(t)));
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      if (c) {
        out = [...out].sort((a, b) => {
          const x = val(c, a), y = val(c, b);
          if (x == null && y == null) return 0;
          if (x == null) return 1;
          if (y == null) return -1;
          const r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'id', { numeric: true });
          return sort.dir === 'asc' ? r : -r;
        });
      }
    }
    return out;
  }, [rows, q, sort, columns]);

  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * size, cur * size);

  const toggle = (k) => setSort((s) => (s?.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' }));

  return (
    <div>
      <div className="toolbar">
        {search && (
          <input className="input" type="search" placeholder="Cari…" aria-label="Cari di tabel" value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        )}
        <label className="small muted">
          Tampilkan{' '}
          <select className="input" style={{ width: 'auto', height: 32, display: 'inline-block' }} value={size}
            onChange={(e) => { setSize(Number(e.target.value)); setPage(1); }}>
            {pageSizes.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>{' '}baris
        </label>
        <div className="grow" />
        {toolbar}
      </div>
      <div className="table-wrap">
        <table className={'data' + (nowrap ? ' nowrap' : '')}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={c.num ? 'num' : undefined}
                  aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                  {c.sortable === false ? c.label : (
                    <button onClick={() => toggle(c.key)}>
                      {c.label}<span aria-hidden="true" className="muted">{sort?.key === c.key ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={columns.length} className="empty">{q ? 'Tidak ada data yang cocok dengan pencarian.' : empty}</td></tr>}
            {shown.map((r, i) => (
              <tr key={r.id ?? r.rate_id ?? i} className={rowClass ? rowClass(r) : undefined}>
                {columns.map((c) => <td key={c.key} className={c.num ? 'num' : undefined}>{c.render ? c.render(r) : val(c, r) ?? '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>Menampilkan {filtered.length ? (cur - 1) * size + 1 : 0} sampai {Math.min(cur * size, filtered.length)} dari {filtered.length} baris</span>
        <div className="actions">
          <button className="btn ghost sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Sebelumnya</button>
          <span>Hal. {cur} / {pages}</span>
          <button className="btn ghost sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Berikutnya</button>
        </div>
      </div>
    </div>
  );
}
