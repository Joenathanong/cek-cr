'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ENTITIES, MASTER_ORDER, ROLES, MENU_ACCESS } from '@/lib/entities';
import { api } from '@/lib/client';

const UserCtx = createContext(null);
export const useUser = () => useContext(UserCtx);

export default function Shell({ children }) {
  const path = usePathname();
  const [user, setUser] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => { api('/api/auth/me').then((d) => setUser(d.user)).catch(() => {}); }, []);
  useEffect(() => { setOpen(false); }, [path]);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  const role = user?.role;
  const link = (href, label) => (
    <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>{label}</Link>
  );
  const masters = MASTER_ORDER.filter((m) => role && ENTITIES[m].view.includes(role));

  return (
    <UserCtx.Provider value={user}>
      <div className="shell">
        <div className="topbar">
          <button onClick={() => setOpen(true)} aria-label="Buka menu">Menu</button>
          Cek Cost Ratio
        </div>
        <aside className={'sidebar' + (open ? ' open' : '')}>
          <div className="brand">Cek Cost Ratio<small>Ekspedisi &amp; armada</small></div>
          {user && !user.mustChange && (
            <>
              <nav className="nav-group" aria-label="Cek cost ratio">
                <span>Cek cost ratio</span>
                {link('/cek', 'Individual')}
                {link('/massal', 'Massal (upload SAP)')}
                {link('/riwayat', 'Riwayat')}
              </nav>
              <nav className="nav-group" aria-label="Master data">
                <span>Master data</span>
                {masters.map((m) => link(`/master/${m}`, ENTITIES[m].label))}
                {link('/prioritas', 'Prioritas Alokasi')}
              </nav>
              {(MENU_ACCESS.log.includes(role) || role === 'admin') && (
                <nav className="nav-group" aria-label="Administrasi">
                  <span>Administrasi</span>
                  {MENU_ACCESS.log.includes(role) && link('/log', 'Log perubahan')}
                  {MENU_ACCESS.loginlog.includes(role) && link('/log/login', 'Log login')}
                  {MENU_ACCESS.users.includes(role) && link('/users', 'Kelola user')}
                </nav>
              )}
            </>
          )}
          {user && (
            <div className="me">
              <b>{user.nama}</b>
              {ROLES[user.role]} ({user.username})
              <div className="row">
                <Link href="/akun">Ganti password</Link>
                <button onClick={logout}>Keluar</button>
              </div>
            </div>
          )}
        </aside>
        <main className="main">{user ? children : <p className="muted">Memuat…</p>}</main>
      </div>
    </UserCtx.Provider>
  );
}
