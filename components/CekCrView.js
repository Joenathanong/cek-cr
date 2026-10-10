'use client';
import { Fragment, useMemo, useState } from 'react';
import { rupiah, angka, persen, leadtimeText } from '@/lib/format';
import { ketTotal } from '@/lib/cekcr';
import { STATUS } from '@/lib/sap';
import StatusPill from './StatusPill';

const PER_HAL = 15;
const pillStatus = (s) => (s === STATUS.KOSONG ? 'pill err' : s === STATUS.TIPIS ? 'pill warn' : 'pill');

/** Tampilan seperti sheet "Cek CR": item SO per distributor, lalu baris total dengan rekomendasi & status kirim. */
export default function CekCrView({ groups, onDetail, toolbar }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('alokasi');
  const [hal, setHal] = useState(1);

  const tampil = useMemo(() => {
    const t = q.trim().toLowerCase();
    const cocokItem = (d) => {
      if (filter === 'semua') return true;
      if (filter === 'dikirim') return (d.dikirim ?? d.alokasi) > 0;
      if (filter === 'alokasi') return (d.alokasiAwal ?? d.alokasi) > 0 || (d.dikirim ?? d.alokasi) > 0;
      if (filter === 'dialihkan') return !!d.pengalihan;
      if (filter === 'batal') return d.statusKirim === 'Tidak dikirim' && d.alokasi > 0;
      return d.status === filter;
    };
    return groups
      .filter((g) => !t || [g.kode, g.nama, g.kotaLabel, g.area, g.asm, g.hasil?.meta?.status, ...g.items.map((d) => d.material + ' ' + d.deskripsi + ' ' + d.doc)]
        .some((x) => String(x || '').toLowerCase().includes(t)))
      .map((g) => ({ ...g, itemsTampil: g.items.filter(cocokItem) }))
      .filter((g) => g.itemsTampil.length || filter === 'semua');
  }, [groups, q, filter]);
  const pages = Math.max(1, Math.ceil(tampil.length / PER_HAL));
  const cur = Math.min(hal, pages);
  const shown = tampil.slice((cur - 1) * PER_HAL, cur * PER_HAL);

  return (
    <div>
      <div className="toolbar">
        <input className="input" type="search" placeholder="Cari distributor, kota, material, no. SO, status" aria-label="Cari"
          value={q} onChange={(e) => { setQ(e.target.value); setHal(1); }} />
        <select className="input" style={{ width: 'auto' }} value={filter} onChange={(e) => { setFilter(e.target.value); setHal(1); }} aria-label="Filter item">
          <option value="alokasi">Item yang dapat stok (termasuk tidak dikirim)</option>
          <option value="dikirim">Hanya item yang dikirim</option>
          <option value="dialihkan">Item yang dialihkan</option>
          <option value="batal">Item tidak dikirim (CR di atas batas)</option>
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
              <th>No. SO</th><th>Customer reference</th><th>Material</th><th>Status stok</th>
              <th className="num">Outstanding</th><th className="num">Alokasi awal</th><th className="num">Dikirim</th>
              <th className="num">Value VA05</th><th className="num">KG</th><th className="num">M³</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={10} className="empty">Tidak ada data untuk filter ini.</td></tr>}
            {shown.map((g) => {
              const u = g.hasil?.utama;
              const meta = g.hasil?.meta;
              const ket = ketTotal(g);
              const batal = meta && !meta.dikirim;
              return (
                <Fragment key={g.kode}>
                  <tr className="grp">
                    <td colSpan={10}>
                      <span className="prio-no">{g.prioritas && g.prioritas !== 9999 ? `#${g.prioritas}` : '–'}</span>
                      <b>{g.nama || g.kode}</b>{' '}
                      <span className="muted">{[g.kode, g.kotaLabel, g.area, g.asm].filter(Boolean).join(', ')}</span>
                      {meta && <span style={{ marginLeft: 10 }}><StatusPill status={meta.status} /></span>}
                    </td>
                  </tr>
                  {g.itemsTampil.map((d, i) => (
                    <tr key={g.kode + i} className={(d.dikirim ?? d.alokasi) <= 0 ? 'dim' : undefined}>
                      <td>{d.doc}<div className="small muted">{d.tanggal || ''}</div></td>
                      <td className="small">{d.ref}<div className="muted">{d.tipe}</div></td>
                      <td>{d.material}<div className="small muted">{d.deskripsi}</div></td>
                      <td><span className={pillStatus(d.status)}>{d.status}</span></td>
                      <td className="num">{angka(d.qty, 0)}</td>
                      <td className="num">{angka(d.alokasiAwal ?? d.alokasi, 0)}</td>
                      <td className="num"><b style={{ fontWeight: 600 }}>{angka(d.dikirim ?? d.alokasi, 0)}</b>
                        {d.pengalihan && <div className="small alih">{d.pengalihan}</div>}</td>
                      <td className="num">{rupiah(d.nilai)}</td>
                      <td className="num">{angka(d.kg, 3)}</td>
                      <td className="num">{angka(d.m3, 4)}</td>
                    </tr>
                  ))}
                  <tr className={'tot' + (batal ? ' batal' : '')}>
                    <td colSpan={4}>
                      <div className="tot-line">
                        <span>Total {g.kotaLabel || g.nama}</span>
                        {u && !batal ? (
                          <span className="rek">
                            {u.ekspedisi} ({u.layanan}{u.armada ? ' ' + u.armada : ''}), {rupiah(u.ongkir)}, {leadtimeText(u.leadtime_min, u.leadtime_max)}
                            <span className="cr">CR {persen(u.cr)}</span>
                            {meta?.crAwal != null && meta.crAwal !== u.cr && <span className="small muted" style={{ marginLeft: 8 }}>awal {persen(meta.crAwal)}</span>}
                          </span>
                        ) : <span className={'pill ' + (batal ? 'err' : 'warn')}>{ket || 'Tidak ada rekomendasi'}{batal && u ? `, CR ${persen(u.cr)}` : ''}</span>}
                        {onDetail && g.hasil && <button className="btn ghost sm" onClick={() => onDetail(g)}>Bandingkan ekspedisi</button>}
                      </div>
                      {meta?.alasan && <div className="alasan">{meta.alasan}</div>}
                    </td>
                    <td className="num">{angka(g.total.qty, 0)}</td>
                    <td className="num">{angka(g.total.alokasiAwal, 0)}</td>
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
