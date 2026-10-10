'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { tanggalWaktu } from '@/lib/format';

export default function LoginLog() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  useEffect(() => { api('/api/loginlog?page=' + page).then(setData).catch((e) => setErr(e.message)); }, [page]);
  return (
    <div className="page">
      <div className="page-head"><div><h1>Log login</h1><p>Percobaan masuk ke aplikasi, berhasil maupun gagal.</p></div></div>
      {err && <div className="alert err">{err}</div>}
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Waktu</th><th>Username</th><th>Hasil</th><th>Keterangan</th><th>IP</th><th>Perangkat</th></tr></thead>
          <tbody>
            {data?.rows.map((r) => (
              <tr key={r.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{tanggalWaktu(r.waktu)}</td><td>{r.username}</td>
                <td>{r.berhasil ? <span className="pill">Berhasil</span> : <span className="pill err">Gagal</span>}</td>
                <td>{r.keterangan}</td><td className="small">{r.ip || '-'}</td>
                <td className="small muted" style={{ maxWidth: 280 }}>{r.user_agent}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="pager"><span>Halaman {page}</span>
        <div className="actions">
          <button className="btn ghost sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</button>
          <button className="btn ghost sm" disabled={!data?.more} onClick={() => setPage(page + 1)}>Berikutnya</button>
        </div>
      </div>
    </div>
  );
}
