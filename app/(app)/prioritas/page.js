'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { tanggalWaktu } from '@/lib/format';
import PrioritasEditor, { dariApi } from '@/components/PrioritasEditor';

export default function Prioritas() {
  const [d, setD] = useState(null);
  const [v, setV] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { api('/api/prioritas').then((x) => { setD(x); setV(dariApi(x)); }).catch((e) => setErr(e.message)); }, []);

  async function simpan() {
    setBusy(true); setErr(''); setMsg('');
    try {
      const x = await api('/api/prioritas', { method: 'PUT', body: { mode: v.mode, area: v.area.map((a) => a.id), kota: v.kota.map((k) => k.id) } });
      setD({ ...d, ...x }); setV(dariApi(x)); setMsg('Prioritas alokasi disimpan. Cek massal berikutnya memakai pengaturan ini.');
    } catch (e) { setErr(e.message); }
    setBusy(false);
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Prioritas alokasi stok</h1>
          <p>Menentukan siapa yang didahulukan saat stok tidak cukup untuk semua SO. Pengaturan ini menjadi bawaan di cek massal, dan masih bisa diubah sementara saat proses.</p>
        </div>
      </div>
      {msg && <div className="alert ok" role="status">{msg}</div>}
      {err && <div className="alert err" role="alert">{err}</div>}
      {v && (
        <div className="panel">
          <PrioritasEditor value={v} onChange={setV} semuaKota={d.kota} readOnly={!d.canEdit} />
          {d.canEdit && (
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn" disabled={busy} onClick={simpan}>{busy ? 'Menyimpan…' : 'Simpan prioritas'}</button>
              <button className="btn ghost" onClick={() => setV(dariApi(d))}>Batalkan perubahan</button>
            </div>
          )}
          {d.info?.updated_by && <p className="small muted" style={{ marginTop: 12 }}>Dasar prioritas terakhir diubah {tanggalWaktu(d.info.updated_at)} oleh {d.info.updated_by}.</p>}
        </div>
      )}
    </div>
  );
}
