'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { tanggalWaktu } from '@/lib/format';

const MAKS_LOGO = 300 * 1024;

export default function Pengaturan() {
  const [v, setV] = useState(null);
  const [info, setInfo] = useState({});
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const muat = (d) => { setV({ ...d.nilai }); setInfo(d.info || {}); };
  useEffect(() => { api('/api/pengaturan').then(muat).catch((e) => setErr(e.message)); }, []);
  const set = (k, x) => setV((o) => ({ ...o, [k]: x }));

  function pilihLogo(f) {
    setErr('');
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(f.type)) { setErr('Logo harus PNG, JPG, WEBP, atau SVG.'); return; }
    if (f.size > MAKS_LOGO) { setErr('Ukuran logo maksimal 300 KB.'); return; }
    const r = new FileReader();
    r.onload = () => set('logo', r.result);
    r.readAsDataURL(f);
  }

  async function simpan(e) {
    e.preventDefault();
    setBusy(true); setErr(''); setMsg('');
    try {
      const d = await api('/api/pengaturan', { method: 'PUT', body: v });
      muat(d); setMsg('Pengaturan disimpan. Nama PT, logo, dan teks login langsung dipakai.');
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  const terakhir = (k) => info[k]?.updated_by ? <span className="hint">Terakhir diubah {tanggalWaktu(info[k].updated_at)} oleh {info[k].updated_by}</span> : null;
  if (!v) return <div className="page"><p className="muted">{err || 'Memuat…'}</p></div>;
  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="page-head"><div><h1>Pengaturan</h1><p>Identitas perusahaan, tampilan halaman login, dan aturan perhitungan. Hanya Admin yang bisa mengubah.</p></div></div>
      {msg && <div className="alert ok" role="status">{msg}</div>}
      {err && <div className="alert err" role="alert">{err}</div>}
      <form onSubmit={simpan}>
        <div className="panel">
          <h3 className="panel-title">Identitas & halaman login</h3>
          <div className="form-grid">
            <div className="field span-6"><label htmlFor="pt">Nama PT</label>
              <input id="pt" className="input" value={v.nama_pt || ''} onChange={(e) => set('nama_pt', e.target.value)} />{terakhir('nama_pt')}</div>
            <div className="field span-6"><span className="lbl">Logo</span>
              <div className="actions">
                <div className="logo-preview">{v.logo ? <img src={v.logo} alt="Pratinjau logo" /> : <span className="small" style={{ color: '#a9c196' }}>Belum ada logo</span>}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" aria-label="Pilih file logo" onChange={(e) => pilihLogo(e.target.files[0])} />
                  {v.logo && <button type="button" className="btn link" onClick={() => set('logo', null)}>Hapus logo</button>}
                </div>
              </div>
              <span className="hint">Ditampilkan di atas latar hijau gelap (login & sidebar). PNG transparan paling baik, maks. 300 KB.</span>{terakhir('logo')}</div>
            <div className="field span-12"><label htmlFor="jd">Judul halaman login</label>
              <input id="jd" className="input" value={v.login_judul || ''} onChange={(e) => set('login_judul', e.target.value)} />
              <span className="hint">Teks setelah koma pertama ditampilkan di baris kedua dengan warna hijau GOC.</span>{terakhir('login_judul')}</div>
            <div className="field span-12"><label htmlFor="sl">Slogan halaman login</label>
              <textarea id="sl" className="input" rows={3} value={v.login_slogan || ''} onChange={(e) => set('login_slogan', e.target.value)} />{terakhir('login_slogan')}</div>
          </div>
        </div>
        <div className="panel">
          <h3 className="panel-title">Aturan perhitungan & peringatan</h3>
          <div className="form-grid">
            <div className="field span-6"><label htmlFor="cr">Batas cost ratio cek massal (%)</label>
              <input id="cr" className="input num" inputMode="decimal" value={v.batas_cr ?? ''} onChange={(e) => set('batas_cr', e.target.value.replace(',', '.'))} />
              <span className="hint">Distributor dengan CR di atas batas tidak dikirim; material yang dibutuhkan dialihkan ke distributor lain.</span>{terakhir('batas_cr')}</div>
            <div className="field span-6"><label htmlFor="iv">Interval peringatan kota tanpa rate (jam)</label>
              <input id="iv" className="input num" inputMode="decimal" value={v.interval_peringatan_jam ?? ''} onChange={(e) => set('interval_peringatan_jam', e.target.value.replace(',', '.'))} />
              <span className="hint">Pop up muncul untuk Purchasing & Admin saat login, lalu setiap sekian jam.</span>{terakhir('interval_peringatan_jam')}</div>
          </div>
        </div>
        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan pengaturan'}</button>
        </div>
      </form>
    </div>
  );
}
