'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, catatExport } from '@/lib/client';
import { rupiah, angka, persen, tanggalWaktu } from '@/lib/format';
import { tulisExcel, FMT } from '@/lib/excel';
import Modal from '@/components/Modal';
import ResultView, { opsiDariRiwayat } from '@/components/ResultView';
import { useUser } from '@/components/Shell';
import CekCrView from '@/components/CekCrView';
import { susunGrup } from '@/lib/cekcr';
import { exportMassal } from '@/lib/massalExport';

function teksPrio(x) {
  if (!x?.urutan) return '';
  return `Prioritas alokasi berdasarkan ${x.mode === 'KOTA' ? 'kota' : 'area'}${x.template ? ` (template ${x.template})` : ''}: ${x.urutan.map((k, i) => `${i + 1}. ${k}`).join(', ')}`;
}

function hasilDariRow(r) {
  const x = r.hasil || {};
  const conv = (o) => o && { ...o, ...ltArr(o.lt) };
  return {
    kode: r.distributor_kode || '', nama: r.distributor_nama, kota: r.kota_nama, kg: r.kg, m3: r.m3, nilaiPo: r.nilai_po,
    utama: conv(x.utama), termurah: conv(x.termurah), tercepat: conv(x.tercepat), peringatan: x.peringatan || [],
    opsi: opsiDariRiwayat(x.opsi),
  };
}

const ltArr = (l) => (l ? { leadtime_min: l[0], leadtime_max: l[1] } : {});

function keView(h, asal, tujuan, dist) {
  const x = h.hasil || {};
  const conv = (o) => o && { ...o, ...ltArr(o.lt) };
  return {
    asal, tujuan, distributor: dist ? [{ nama: dist }] : [], kg: h.kg, m3: h.m3, nilaiPo: h.nilai_po,
    opsi: opsiDariRiwayat(x.opsi), utama: conv(x.utama), termurah: conv(x.termurah), tercepat: conv(x.tercepat), peringatan: x.peringatan,
  };
}

export default function Riwayat() {
  const user = useUser();
  const [tipe, setTipe] = useState('INDIVIDUAL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [lihat, setLihat] = useState(null);
  const [run, setRun] = useState(null);
  const [err, setErr] = useState('');
  const [arsip, setArsip] = useState('');

  const load = useCallback(() => {
    api(`/api/riwayat?tipe=${tipe}&page=${page}&q=${encodeURIComponent(q)}`).then(setData).catch((e) => setErr(e.message));
  }, [tipe, page, q]);
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function bukaRun(r) {
    const d = await api(`/api/riwayat/${r.id}`);
    setRun({ ...d, items: d.run.items || null });
  }

  function exportRun() {
    const hasil = run.rows.map(hasilDariRow);
    exportMassal({
      namaFile: `riwayat-massal-${run.run.id}.xlsx`,
      catatan: [`Proses massal #${run.run.id} oleh ${run.run.username}, ${tanggalWaktu(run.run.created_at)}`, run.run.keterangan || '',
        teksPrio(run.run.prioritas)].filter(Boolean),
      groups: run.items ? susunGrup(run.items, hasil) : null, hasil,
    });
    catatExport('cek_massal', `Export riwayat massal #${run.run.id}`);
  }

  async function hapusArsip() {
    if (!arsip || !confirm(`Hapus semua riwayat sebelum ${arsip}? Pastikan sudah diexport. Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const d = await api(`/api/riwayat?sebelum=${arsip}`, { method: 'DELETE' });
      alert(`Terhapus: ${d.individual} cek individual dan ${d.massal} proses massal.`);
      load();
    } catch (e) { setErr(e.message); }
  }

  const rows = data?.rows || [];
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Riwayat cek</h1><p>Semua cek yang pernah dilakukan beserta rekomendasi saat itu. Harga yang ditampilkan adalah harga pada waktu pengecekan.</p></div>
      </div>
      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tipe === 'INDIVIDUAL'} onClick={() => { setTipe('INDIVIDUAL'); setPage(1); }}>Individual</button>
        <button role="tab" aria-selected={tipe === 'MASSAL'} onClick={() => { setTipe('MASSAL'); setPage(1); }}>Massal</button>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="toolbar">
        <input className="input" type="search" placeholder={tipe === 'MASSAL' ? 'Cari keterangan / user' : 'Cari kota / user / ekspedisi'} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Cari riwayat" />
      </div>
      <div className="table-wrap">
        {tipe === 'INDIVIDUAL' ? (
          <table className="data">
            <thead><tr><th>Waktu</th><th>User</th><th>Rute</th><th className="num">KG</th><th className="num">Value PO</th><th>Rekomendasi</th><th className="num">Ongkir</th><th className="num">CR</th><th /></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={9} className="empty">Belum ada riwayat.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small">{tanggalWaktu(r.created_at)}</td><td>{r.username}</td>
                  <td>{r.gudang_kode} → {r.kota_nama}</td><td className="num">{angka(r.kg)}</td><td className="num">{rupiah(r.nilai_po)}</td>
                  <td>{r.rekom_ekspedisi || '-'}<div className="small muted">{r.rekom_layanan} {r.rekom_leadtime}</div></td>
                  <td className="num">{rupiah(r.rekom_ongkir)}</td><td className="num">{persen(r.rekom_cr)}</td>
                  <td><button className="btn ghost sm" onClick={() => setLihat(r)}>Detail</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="data">
            <thead><tr><th>Waktu</th><th>User</th><th>Gudang</th><th>Keterangan</th><th className="num">Kiriman</th><th className="num">Value PO</th><th className="num">Ongkir</th><th className="num">CR</th><th /></tr></thead>
            <tbody>
              {!rows.length && <tr><td colSpan={9} className="empty">Belum ada riwayat.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="small">{tanggalWaktu(r.created_at)}</td><td>{r.username}</td><td>{r.gudang_kode}</td>
                  <td className="small">{r.keterangan}</td><td className="num">{r.jumlah_distributor}</td>
                  <td className="num">{rupiah(r.total_nilai_po)}</td><td className="num">{rupiah(r.total_ongkir)}</td>
                  <td className="num">{r.total_nilai_po ? persen((r.total_ongkir / r.total_nilai_po) * 100) : '-'}</td>
                  <td><button className="btn ghost sm" onClick={() => bukaRun(r)}>Buka</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="pager">
        <span>Halaman {page}</span>
        <div className="actions">
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
          <button className="btn ghost sm" disabled={!data?.more} onClick={() => setPage(page + 1)}>Berikutnya</button>
        </div>
      </div>

      {user?.role === 'admin' && (
        <div className="panel" style={{ marginTop: 24 }}>
          <h3>Arsip riwayat</h3>
          <p className="small muted">Untuk menghemat kuota database, hapus riwayat lama setelah diexport. Hanya riwayat cek yang dihapus; master data dan log perubahan tidak tersentuh.</p>
          <div className="actions">
            <input type="date" className="input" style={{ width: 200 }} value={arsip} onChange={(e) => setArsip(e.target.value)} aria-label="Hapus sebelum tanggal" />
            <button className="btn danger" disabled={!arsip} onClick={hapusArsip}>Hapus riwayat sebelum tanggal ini</button>
          </div>
        </div>
      )}

      {lihat && (
        <Modal title={`${lihat.gudang_kode} → ${lihat.kota_nama}, ${tanggalWaktu(lihat.created_at)}`} onClose={() => setLihat(null)} wide>
          <ResultView data={keView(lihat, lihat.gudang_kode, lihat.kota_nama, lihat.distributor_nama)} />
        </Modal>
      )}
      {run && (
        <Modal title={`Proses massal #${run.run.id}`} onClose={() => setRun(null)} wide>
          <p className="small muted" style={{ marginTop: 0 }}>{run.run.keterangan} oleh {run.run.username}, {tanggalWaktu(run.run.created_at)}</p>
          {run.run.prioritas && <p className="small" style={{ marginTop: 0 }}>{teksPrio(run.run.prioritas)}</p>}
          {run.items ? (
            <CekCrView groups={susunGrup(run.items, run.rows.map(hasilDariRow))} toolbar={<button className="btn sm" onClick={exportRun}>Download Excel</button>} />
          ) : (
            <>
              <div className="toolbar"><div className="grow" /><button className="btn sm" onClick={exportRun}>Download Excel</button></div>
            <div className="table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
            <table className="data">
              <thead><tr><th>Distributor</th><th>Kota</th><th className="num">KG</th><th className="num">Value PO</th><th>Rekomendasi</th><th className="num">Ongkir</th><th className="num">CR</th></tr></thead>
              <tbody>{run.rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.distributor_nama}<div className="small muted">{r.distributor_kode}</div></td><td>{r.kota_nama}</td>
                  <td className="num">{angka(r.kg)}</td><td className="num">{rupiah(r.nilai_po)}</td>
                  <td>{r.rekom_ekspedisi || <span className="pill err">{r.hasil?.peringatan?.[0] || 'Tidak ada'}</span>}<div className="small muted">{r.rekom_layanan} {r.rekom_leadtime}</div></td>
                  <td className="num">{rupiah(r.rekom_ongkir)}</td><td className="num">{persen(r.rekom_cr)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
