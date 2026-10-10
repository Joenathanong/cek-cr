'use client';
import { useCallback, useEffect, useState } from 'react';
import { api, catatExport } from '@/lib/client';
import { tanggalWaktu } from '@/lib/format';
import { ENTITIES } from '@/lib/entities';
import { tulisExcel } from '@/lib/excel';
import { useUser } from '@/components/Shell';

const TABEL = {
  ...Object.fromEntries(Object.values(ENTITIES).map((e) => [e.table, e.label])),
  users: 'User', cek_individual: 'Cek individual', cek_massal: 'Cek massal', cek_history: 'Riwayat cek',
};
const ABAI = ['updated_at', 'updated_by', 'id'];
const REF = { ekspedisi_id: 'ekspedisi', gudang_id: 'gudang', kota_id: 'kota', armada_id: 'armada', area_id: 'area' };

function labelField(tabel, k) {
  const e = Object.values(ENTITIES).find((x) => x.table === tabel);
  return e?.fields.find((f) => f.key === k)?.label || k;
}

export default function LogPage() {
  const user = useUser();
  const [f, setF] = useState({ tabel: '', aksi: '', user: '', dari: '', sampai: '' });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [lk, setLk] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    const p = new URLSearchParams({ ...f, page });
    api('/api/log?' + p).then(setData).catch((e) => setErr(e.message));
  }, [f, page]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api('/api/lookup').then(setLk).catch(() => {}); }, []);

  const nilai = (k, v) => {
    if (v == null || v === '') return '(kosong)';
    if (REF[k] && lk) {
      const x = lk[REF[k]]?.find((o) => o.id === v);
      if (x) return x.nama || x.kode;
    }
    if (typeof v === 'boolean') return v ? 'Ya' : 'Tidak';
    return String(v);
  };

  function ringkasData(r) {
    const o = r.data_baru || r.data_lama;
    if (!o) return null;
    const id = ['kode', 'nama', 'layanan', 'kota_id', 'ekspedisi_id', 'username'].filter((k) => o[k] != null).map((k) => nilai(k, o[k]));
    return id.join(' / ');
  }

  function perubahan(r) {
    if (r.aksi !== 'UPDATE' || !r.data_lama || !r.data_baru) return null;
    const keys = Object.keys(r.data_baru).filter((k) => !ABAI.includes(k) && JSON.stringify(r.data_lama[k]) !== JSON.stringify(r.data_baru[k]));
    return keys.map((k) => ({ k: labelField(r.tabel, k), lama: nilai(k, r.data_lama[k]), baru: nilai(k, r.data_baru[k]) }));
  }

  function exportExcel() {
    tulisExcel(`log-perubahan-${new Date().toISOString().slice(0, 10)}.xlsx`, [{
      nama: 'Log',
      kolom: [
        { label: 'Waktu', key: (r) => tanggalWaktu(r.waktu), width: 20 }, { label: 'User', key: 'username' },
        { label: 'Data', key: (r) => TABEL[r.tabel] || r.tabel, width: 16 }, { label: 'Aksi', key: 'aksi' },
        { label: 'Data yang diubah', key: (r) => ringkasData(r), width: 40 },
        { label: 'Perubahan', key: (r) => (perubahan(r) || []).map((c) => `${c.k}: ${c.lama} → ${c.baru}`).join('; '), width: 70 },
        { label: 'Keterangan', key: 'keterangan', width: 40 },
      ],
      data: data.rows,
    }]);
    catatExport('audit_log', 'Export log perubahan');
  }

  const set = (k, v) => { setF((o) => ({ ...o, [k]: v })); setPage(1); };
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Log perubahan</h1><p>{user?.role === 'admin' ? 'Siapa mengubah data apa, kapan, beserta nilai lama dan barunya.' : 'Riwayat perubahan yang Anda lakukan.'}</p></div>
      </div>
      {err && <div className="alert err">{err}</div>}
      <div className="toolbar">
        <select className="input" style={{ width: 180 }} value={f.tabel} onChange={(e) => set('tabel', e.target.value)} aria-label="Data">
          <option value="">Semua data</option>
          {Object.entries(TABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input" style={{ width: 150 }} value={f.aksi} onChange={(e) => set('aksi', e.target.value)} aria-label="Aksi">
          <option value="">Semua aksi</option>
          {['INSERT', 'UPDATE', 'DELETE', 'UPLOAD', 'EXPORT', 'USER'].map((a) => <option key={a}>{a}</option>)}
        </select>
        {user?.role === 'admin' && (
          <select className="input" style={{ width: 160 }} value={f.user} onChange={(e) => set('user', e.target.value)} aria-label="User">
            <option value="">Semua user</option>
            {data?.users.map((u) => <option key={u}>{u}</option>)}
          </select>
        )}
        <input type="date" className="input" style={{ width: 160 }} value={f.dari} onChange={(e) => set('dari', e.target.value)} aria-label="Dari tanggal" />
        <input type="date" className="input" style={{ width: 160 }} value={f.sampai} onChange={(e) => set('sampai', e.target.value)} aria-label="Sampai tanggal" />
        <div className="grow" />
        <button className="btn ghost sm" disabled={!data?.rows.length} onClick={exportExcel}>Export Excel</button>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Waktu</th><th>User</th><th>Data</th><th>Aksi</th><th>Rincian</th></tr></thead>
          <tbody>
            {data && !data.rows.length && <tr><td colSpan={5} className="empty">Tidak ada log untuk filter ini.</td></tr>}
            {data?.rows.map((r) => {
              const ch = perubahan(r);
              return (
                <tr key={r.id}>
                  <td className="small" style={{ whiteSpace: 'nowrap' }}>{tanggalWaktu(r.waktu)}</td>
                  <td>{r.username}</td>
                  <td>{TABEL[r.tabel] || r.tabel}</td>
                  <td><span className={'pill' + (r.aksi === 'DELETE' ? ' err' : r.aksi === 'UPDATE' ? ' warn' : '')}>{r.aksi}</span></td>
                  <td className="diff">
                    {ringkasData(r) && <div><b style={{ fontWeight: 600 }}>{ringkasData(r)}</b></div>}
                    {ch?.map((c) => <div key={c.k}>{c.k}: <del>{c.lama}</del> → <ins>{c.baru}</ins></div>)}
                    {r.keterangan && <div className="muted">{r.keterangan}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pager">
        <span>Halaman {page}</span>
        <div className="actions">
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
          <button className="btn ghost sm" disabled={!data?.more} onClick={() => setPage(page + 1)}>Berikutnya</button>
        </div>
      </div>
    </div>
  );
}
