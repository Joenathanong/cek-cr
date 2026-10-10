'use client';
import { useState } from 'react';
import { api } from '@/lib/client';
import { useUser } from '@/components/Shell';

export default function Akun() {
  const user = useUser();
  const [v, setV] = useState({ lama: '', baru: '', ulang: '' });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);

  async function simpan(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (v.baru !== v.ulang) { setErr('Ulangi password baru tidak sama.'); return; }
    setBusy(true);
    try {
      await api('/api/auth/password', { method: 'POST', body: { lama: v.lama, baru: v.baru } });
      setOk('Password berhasil diganti.');
      setV({ lama: '', baru: '', ulang: '' });
      if (user?.mustChange) setTimeout(() => { window.location.href = '/cek'; }, 800);
    } catch (x) { setErr(x.message); }
    setBusy(false);
  }

  return (
    <div className="page" style={{ maxWidth: 520 }}>
      <div className="page-head"><div><h1>Ganti password</h1>
        <p>{user?.mustChange ? 'Ini login pertama atau password Anda baru direset. Buat password baru sebelum melanjutkan.' : 'Minimal 8 karakter, berisi huruf dan angka.'}</p></div></div>
      <form className="panel" onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {['lama', 'baru', 'ulang'].map((k) => (
          <div className="field" key={k}>
            <label htmlFor={k}>{k === 'lama' ? 'Password saat ini' : k === 'baru' ? 'Password baru' : 'Ulangi password baru'}</label>
            <input id={k} type="password" className="input" autoComplete={k === 'lama' ? 'current-password' : 'new-password'}
              value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} required />
          </div>
        ))}
        {err && <div className="alert err" role="alert">{err}</div>}
        {ok && <div className="alert ok" role="status">{ok}</div>}
        <div><button className="btn" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan password'}</button></div>
      </form>
    </div>
  );
}
