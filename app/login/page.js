'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const sp = useSearchParams();
  const [username, setU] = useState('');
  const [password, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login gagal');
      const next = sp.get('next');
      window.location.href = data.user.mustChange ? '/akun' : next && next.startsWith('/') ? next : '/cek';
    } catch (e2) {
      setErr(e2.message); setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <div>
        <h1>Masuk</h1>
        <p className="muted" style={{ margin: '4px 0 0' }}>Gunakan akun yang dibuat oleh admin.</p>
      </div>
      {err && <div className="alert err" role="alert">{err}</div>}
      <div className="field">
        <label htmlFor="u">Username</label>
        <input id="u" className="input" autoComplete="username" value={username} onChange={(e) => setU(e.target.value)} autoFocus required />
      </div>
      <div className="field">
        <label htmlFor="p">Password</label>
        <input id="p" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setP(e.target.value)} required />
      </div>
      <button className="btn" disabled={busy || !username || !password}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  );
}

export default function LoginPage() {
  const [b, setB] = useState(null);
  useEffect(() => { fetch('/api/branding').then((r) => r.json()).then(setB).catch(() => setB({})); }, []);
  const judul = b?.judul || '';
  const [j1, ...j2] = judul.split(',');
  return (
    <div className="login-wrap">
      <div className="login-side">
        {b?.logo ? <img className="logo" src={b.logo} alt={b.namaPt || 'Logo'} />
          : <div style={{ fontFamily: 'var(--font-cond)', fontSize: 22, color: '#fff' }}>Cek Cost Ratio Ekspedisi</div>}
        <div>
          {judul && <div className="big">{j2.length ? <>{j1},<span>{j2.join(',').trim()}</span></> : judul}</div>}
          {b?.slogan && <p>{b.slogan}</p>}
        </div>
        <div className="small" style={{ color: '#a9c196' }}>Warehouse{b?.namaPt ? ` - ${b.namaPt}` : ''}</div>
      </div>
      <div className="login-form">
        <Suspense fallback={null}><LoginForm /></Suspense>
      </div>
    </div>
  );
}
