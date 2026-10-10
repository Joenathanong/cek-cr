'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { ROLES } from '@/lib/entities';
import { tanggalWaktu } from '@/lib/format';
import Modal from '@/components/Modal';
import DataTable from '@/components/DataTable';

const AKSES = [
  ['Cek cost ratio individual & massal, riwayat', 'admin purchasing admin_wh warehouse'],
  ['Rate & ekspedisi: ubah, upload', 'admin purchasing'],
  ['Armada: ubah, upload', 'admin purchasing'],
  ['Distributor, kota, prioritas area: ubah, upload', 'admin admin_wh'],
  ['Gudang asal: ubah', 'admin'],
  ['Log perubahan', 'admin (semua user); purchasing & admin_wh (milik sendiri)'],
  ['Kelola user & log login', 'admin'],
];

export default function Users() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(null);
  const [reset, setReset] = useState(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(() => api('/api/users').then((d) => setRows(d.rows)).catch((e) => setErr(e.message)), []);
  useEffect(() => { load(); }, [load]);

  async function unlock(u) {
    try { await api(`/api/users/${u.id}`, { method: 'PUT', body: { aksi: 'unlock' } }); setMsg(`Kunci akun ${u.username} dibuka.`); load(); }
    catch (e) { setErr(e.message); }
  }

  const kolom = [
    { key: 'username', label: 'Username' },
    { key: 'nama', label: 'Nama' },
    { key: 'role', label: 'Role', render: (u) => ROLES[u.role] },
    { key: 'aktif', label: 'Status', render: (u) => (
      <>{u.aktif ? <span className="pill">Aktif</span> : <span className="pill off">Nonaktif</span>}{' '}
        {u.locked_until && new Date(u.locked_until) > new Date() && <span className="pill err">Terkunci</span>}{' '}
        {u.must_change_password && <span className="pill warn">Wajib ganti password</span>}</>
    ) },
    { key: 'last_login', label: 'Login terakhir', render: (u) => <span className="small">{tanggalWaktu(u.last_login)}</span> },
    { key: 'updated_at', label: 'Last change', render: (u) => <span className="small">{tanggalWaktu(u.updated_at)}<div className="muted">{u.updated_by || '-'}</div></span> },
    { key: '_a', label: '', sortable: false, render: (u) => (
      <div className="actions" style={{ flexWrap: 'nowrap' }}>
        <button className="btn ghost sm" onClick={() => setForm(u)}>Ubah</button>
        <button className="btn ghost sm" onClick={() => setReset(u)}>Reset password</button>
        {u.locked_until && new Date(u.locked_until) > new Date() && <button className="btn ghost sm" onClick={() => unlock(u)}>Buka kunci</button>}
      </div>
    ) },
  ];

  return (
    <div className="page">
      <div className="page-head"><div><h1>Kelola user</h1><p>Akun dibuat oleh admin. User baru wajib mengganti password saat login pertama.</p></div></div>
      {msg && <div className="alert ok">{msg}</div>}
      {err && <div className="alert err">{err}</div>}
      <DataTable columns={kolom} rows={rows} toolbar={<button className="btn sm" onClick={() => setForm({ aktif: true, role: 'warehouse' })}>Tambah user</button>} />

      <div className="panel" style={{ marginTop: 24 }}>
        <h3 style={{ marginBottom: 10 }}>Hak akses per role</h3>
        <div className="table-wrap">
          <table className="data"><thead><tr><th>Menu</th><th>Role</th></tr></thead>
            <tbody>{AKSES.map(([m, r]) => <tr key={m}><td>{m}</td><td className="small">{r.split(' ').map((x) => ROLES[x] || x).join(', ').replace(/, \(/g, ' (')}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      {form && <UserForm u={form} onClose={() => setForm(null)} onSaved={(t) => { setForm(null); setMsg(t); setErr(''); load(); }} />}
      {reset && <ResetForm u={reset} onClose={() => setReset(null)} onSaved={(t) => { setReset(null); setMsg(t); load(); }} />}
    </div>
  );
}

function UserForm({ u, onClose, onSaved }) {
  const baru = !u.id;
  const [v, setV] = useState({ username: u.username || '', nama: u.nama || '', role: u.role, aktif: u.aktif !== false, password: '' });
  const [err, setErr] = useState('');
  async function simpan(e) {
    e.preventDefault(); setErr('');
    try {
      if (baru) await api('/api/users', { method: 'POST', body: v });
      else await api(`/api/users/${u.id}`, { method: 'PUT', body: { nama: v.nama, role: v.role, aktif: v.aktif } });
      onSaved(baru ? `User ${v.username} dibuat. Berikan password awal kepada user tersebut.` : 'Perubahan user disimpan.');
    } catch (x) { setErr(x.message); }
  }
  return (
    <Modal title={baru ? 'Tambah user' : `Ubah ${u.username}`} onClose={onClose}>
      <form onSubmit={simpan} className="form-grid">
        <div className="field span-6"><label htmlFor="un">Username</label>
          <input id="un" className="input" value={v.username} disabled={!baru} onChange={(e) => setV({ ...v, username: e.target.value.toLowerCase() })} />
          {baru && <span className="hint">Huruf kecil, angka, titik, - atau _</span>}</div>
        <div className="field span-6"><label htmlFor="nm">Nama</label>
          <input id="nm" className="input" value={v.nama} onChange={(e) => setV({ ...v, nama: e.target.value })} /></div>
        <div className="field span-6"><label htmlFor="rl">Role</label>
          <select id="rl" className="input" value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
            {Object.entries(ROLES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        {baru ? (
          <div className="field span-6"><label htmlFor="pw">Password awal</label>
            <input id="pw" className="input" type="text" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
            <span className="hint">Min. 8 karakter, huruf dan angka</span></div>
        ) : (
          <div className="field span-6"><label className="check" style={{ marginTop: 26 }}>
            <input type="checkbox" checked={v.aktif} onChange={(e) => setV({ ...v, aktif: e.target.checked })} /> Akun aktif</label></div>
        )}
        {err && <div className="alert err span-12">{err}</div>}
        <div className="actions span-12"><button className="btn">Simpan</button><button type="button" className="btn ghost" onClick={onClose}>Batal</button></div>
      </form>
    </Modal>
  );
}

function ResetForm({ u, onClose, onSaved }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  async function simpan(e) {
    e.preventDefault(); setErr('');
    try { await api(`/api/users/${u.id}`, { method: 'PUT', body: { aksi: 'reset', password: pw } }); onSaved(`Password ${u.username} direset. User wajib menggantinya saat login.`); }
    catch (x) { setErr(x.message); }
  }
  return (
    <Modal title={`Reset password ${u.username}`} onClose={onClose}>
      <form onSubmit={simpan} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field"><label htmlFor="np">Password sementara</label>
          <input id="np" className="input" value={pw} onChange={(e) => setPw(e.target.value)} />
          <span className="hint">Min. 8 karakter, huruf dan angka. User wajib menggantinya saat login berikutnya.</span></div>
        {err && <div className="alert err">{err}</div>}
        <div className="actions"><button className="btn">Reset password</button><button type="button" className="btn ghost" onClick={onClose}>Batal</button></div>
      </form>
    </Modal>
  );
}
