'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { ENTITIES, ROLES, MENU_ACCESS } from '@/lib/entities';
import { api } from '@/lib/client';
import Icon from './Icon';
import RateAlert from './RateAlert';

const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);

const MASTER_ICON = { rate: 'tag', ekspedisi: 'truck', armada: 'box', distributor: 'users', kota: 'pin', area: 'map', gudang: 'building' };
const MASTER_ORDER = ['rate', 'ekspedisi', 'armada', 'distributor', 'kota', 'area', 'gudang'];

function baca(key, def) { try { const v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch { return def; } }
function simpan(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch {} }

export default function Shell({ children }) {
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [brand, setBrand] = useState(null);
  const [open, setOpen] = useState(false);
  const [ringkas, setRingkas] = useState(false);
  const [tutup, setTutup] = useState({});
  const [tanpaRate, setTanpaRate] = useState(null);

  useEffect(() => {
    api('/api/auth/me').then((d) => setUser(d.user)).catch(() => {});
    fetch('/api/branding').then((r) => r.json()).then(setBrand).catch(() => {});
    setRingkas(baca('ccr.ringkas', false)); setTutup(baca('ccr.tutup', {}));
  }, []);
  useEffect(() => { setOpen(false); }, [path]);

  const muatRate = useCallback(() => api('/api/peringatan-rate').then(setTanpaRate).catch(() => {}), []);
  useEffect(() => {
    if (user && !user.mustChange && MENU_ACCESS.peringatanRate.includes(user.role)) muatRate();
  }, [user, muatRate]);

  async function logout() {
    try { sessionStorage.removeItem(`ccr.rateAlert.${user?.username}`); } catch {}
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  const toggleGrup = (g) => { const n = { ...tutup, [g]: !tutup[g] }; setTutup(n); simpan('ccr.tutup', n); };
  const toggleRingkas = () => { setRingkas(!ringkas); simpan('ccr.ringkas', !ringkas); };

  const role = user?.role;
  const link = (href, label, icon, badge) => (
    <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} title={ringkas ? label : undefined}>
      <Icon name={icon} /><span className="lbl">{label}</span>{badge ? <span className="badge">{badge}</span> : null}
    </Link>
  );
  const grup = (id, label, items) => {
    const isi = items.filter(Boolean);
    if (!isi.length) return null;
    const aktif = isi.some((x) => x.props.href === path);
    const tertutup = tutup[id] && !aktif && !ringkas;
    return (
      <nav className="nav-group" aria-label={label} key={id}>
        <button type="button" className="grp-btn" aria-expanded={!tertutup} onClick={() => toggleGrup(id)}>
          {label}<span style={{ transform: tertutup ? 'rotate(-90deg)' : 'none', display: 'inline-flex' }}><Icon name="chevron" size={14} /></span>
        </button>
        {!tertutup && isi}
      </nav>
    );
  };
  const jmlTanpaRate = tanpaRate?.kota?.length || 0;

  return (
    <UserCtx.Provider value={user}>
      <div className={'shell' + (ringkas ? ' ringkas' : '')}>
        <div className="topbar">
          <button onClick={() => setOpen(true)} aria-label="Buka menu">Menu</button>
          Cek Cost Ratio
        </div>
        <aside className={'sidebar' + (open ? ' open' : '')}>
          <div className="brand">
            {brand?.logo && <img src={brand.logo} alt={brand.namaPt || 'Logo'} />}
            <div className="nm">Cek Cost Ratio<span className="pt">{brand?.namaPt || ''}</span></div>
          </div>
          <div className="brand-mini" aria-hidden="true">CR</div>
          {user && !user.mustChange && (
            <>
              {grup('cek', 'Cek cost ratio', [
                link('/cek', 'Individual', 'truck'),
                link('/massal', 'Massal (file SAP)', 'list'),
                link('/riwayat', 'Riwayat', 'clock'),
              ])}
              {grup('master', 'Master data', MASTER_ORDER.filter((m) => ENTITIES[m].view.includes(role)).map((m) =>
                link(`/master/${m}`, ENTITIES[m].label, MASTER_ICON[m], m === 'rate' && jmlTanpaRate ? `${jmlTanpaRate} kota` : null)))}
              {grup('admin', 'Administrasi', [
                MENU_ACCESS.log.includes(role) && link('/log', 'Log perubahan', 'log'),
                MENU_ACCESS.loginlog.includes(role) && link('/log/login', 'Log login', 'key'),
                MENU_ACCESS.users.includes(role) && link('/users', 'Kelola user', 'user'),
                MENU_ACCESS.pengaturan.includes(role) && link('/pengaturan', 'Pengaturan', 'gear'),
              ])}
            </>
          )}
          {user && (
            <div className="me">
              <div className="det">
                <b>{user.nama}</b>{ROLES[user.role]} ({user.username})
                <div className="row">
                  <Link href="/akun">Ganti password</Link>
                  <button onClick={logout}>Keluar</button>
                </div>
              </div>
              <button type="button" className="collapse-btn" onClick={toggleRingkas} aria-label={ringkas ? 'Lebarkan menu' : 'Ringkas menu'}>
                {ringkas ? '»' : '« Ringkas menu'}
              </button>
            </div>
          )}
        </aside>
        <main className="main">{user ? children : <p className="muted">Memuat…</p>}</main>
      </div>
      {user && tanpaRate && jmlTanpaRate > 0 && MENU_ACCESS.peringatanRate.includes(role) && (
        <RateAlert data={tanpaRate} username={user.username} onRefresh={muatRate} />
      )}
    </UserCtx.Provider>
  );
}
