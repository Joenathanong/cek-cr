'use client';
import { Fragment, useMemo, useState } from 'react';
import { rupiah, angka, persen, leadtimeText } from '@/lib/format';
import { ketTotal } from '@/lib/cekcr';
import { STATUS } from '@/lib/sap';

const PER_HAL = 15;
const pillStatus = (s) => (s === STATUS.KOSONG ? 'pill err' : s === STATUS.TIPIS ? 'pill warn' : 'pill');

/** Tampilan seperti sheet "Cek CR": item SO per distributor, lalu baris total dengan rekomendasi ekspedisi. */
export default function CekCrView({ groups, onDetail, toolbar }) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('dikirim');
  const [hal, setHal] = useState(1);

  const tampil = useMemo(() => {
    const t = q.trim().toLowerCase();
    return groups
      .filter((g) => !t || [g.kode, g.nama, g.kota, g.area, g.asm, ...g.items.map((d) => d.material + ' ' + d.deskripsi + ' ' + d.doc)]
        .some((x) => String(x || '').toLowerCase().includes(t)))
      .filter((g) => status !== 'dikirim' || g.total.alokasi > 0)
      .map((g) => ({ ...g, itemsTampil: g.items.filter((d) => status === 'semua' || (status === 'dikirim' ? d.alokasi > 0 : d.status === status)) }))
      .filter((g) => g.itemsTampil.length || status === 'semua');
  }, [groups, q, status]);
  const pages = Math.max(1, Math.ceil(tampil.length / PER_HAL));
  const cur = Math.min(hal, pages);
  const shown = tampil.slice((cur - 1) * PER_HAL, cur * PER_HAL);

  return (
    <div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Cari distributor, kota, material, no. SO" aria-label="Cari"
          value={q} onChange={(e) => { setQ(e.target.value); setHal(1); }} />
        <select className="input" style={{ width: 'auto' }} value={status} onChange={(e) => { setStatus(e.target.value); setHal(1); }} aria-label="Filter item">
          <option value="dikirim">Item yang dikirim saja</option>
          <option value="semua">Semua item outstanding</option>
          <option value={STATUS.READY}>Hanya stock ready</option>
          <option value={STATUS.TIPIS}>Hanya stock tipis</option>
          <option value={STATUS.KOSONG}>Hanya stock kosong</option>
        </select>
        <div className="grow" />
        {toolbar}
      </div>
      <div className="table-wrap">
        <table className="data cekcr">
          <thead>
            <tr>
              <th>No. SO</th><th>Customer reference</th><th>Material</th><th>Status</th>
              <th className="num">Outstanding</th><th className="num">Dikirim</th><th className="num">Value VA05</th>
              <th className="num">KG</th><th className="num">M³</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={9} className="empty">Tidak ada data untuk filter ini.</td></tr>}
            {shown.map((g) => {
              const u = g.hasil?.utama;
              const ket = ketTotal(g);
              return (
                <Fragment key={g.kode}>
                  <tr className="grp">
                    <td colSpan={9}>
                      <span className="prio-no">{g.prioritas && g.prioritas !== 9999 ? `#${g.prioritas}` : '–'}</span>
                      <b>{g.nama || g.kode}</b>{' '}
                      <span className="muted">{[g.kode, g.kota, g.area, g.asm].filter(Boolean).join(', ')}</span>
                    </td>
                  </tr>
                  {g.itemsTampil.map((d, i) => (
                    <tr key={g.kode + i} className={d.alokasi <= 0 ? 'dim' : undefined}>
                      <td>{d.doc}<div className="small muted">{d.tanggal || ''}</div></td>
                      <td className="small">{d.ref}<div className="muted">{d.tipe}</div></td>
                      <td>{d.material}<div className="small muted">{d.deskripsi}</div></td>
                      <td><span className={pillStatus(d.status)}>{d.status}</span></td>
                      <td className="num">{angka(d.qty, 0)}</td>
                      <td className="num"><b style={{ fontWeight: 600 }}>{angka(d.alokasi, 0)}</b></td>
                      <td className="num">{rupiah(d.nilai)}</td>
                      <td className="num">{angka(d.kg, 3)}</td>
                      <td className="num">{angka(d.m3, 4)}</td>
                    </tr>
                  ))}
                  <tr className="tot">
                    <td colSpan={4}>
                      <div className="tot-line">
                        <span>Total {g.kota || g.nama}</span>
                        {u ? (
                          <span className="rek">
                            {u.ekspedisi} ({u.layanan}{u.armada ? ' ' + u.armada : ''}), {rupiah(u.ongkir)}, {leadtimeText(u.leadtime_min, u.leadtime_max)}
                            <span className="cr">CR {persen(u.cr)}</span>
                          </span>
                        ) : <span className="pill err">{ket || 'Tidak ada rekomendasi'}</span>}
                        {onDetail && g.hasil && <button className="btn ghost sm" onClick={() => onDetail(g)}>Bandingkan ekspedisi</button>}
                      </div>
                    </td>
                    <td className="num">{angka(g.total.qty, 0)}</td>
                    <td className="num">{angka(g.total.alokasi, 0)}</td>
                    <td className="num">{rupiah(g.total.nilai)}</td>
                    <td className="num">{angka(g.total.kg, 3)}</td>
                    <td className="num">{angka(g.total.m3, 4)}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>{tampil.length} distributor, halaman {cur} dari {pages}</span>
        <div className="actions">
          <button className="btn ghost sm" disabled={cur <= 1} onClick={() => setHal(cur - 1)}>Sebelumnya</button>
          <button className="btn ghost sm" disabled={cur >= pages} onClick={() => setHal(cur + 1)}>Berikutnya</button>
        </div>
      </div>
    </div>
  );
}
