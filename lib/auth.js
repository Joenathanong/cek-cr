// Pemeriksaan login & hak akses di API (server).
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { COOKIE, readSession } from './session';
import { query } from './db';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/** Ambil user dari cookie dan pastikan masih aktif di database. */
export async function requireUser(roles) {
  const s = await readSession(cookies().get(COOKIE)?.value);
  if (!s) throw new HttpError(401, 'Sesi berakhir. Silakan login lagi.');
  const rows = await query('SELECT id, username, nama, role, aktif, must_change_password FROM users WHERE id=$1', [s.id]);
  const u = rows[0];
  if (!u || !u.aktif) throw new HttpError(401, 'Akun tidak aktif. Hubungi admin.');
  if (roles && !roles.includes(u.role)) throw new HttpError(403, 'Anda tidak punya akses untuk aksi ini.');
  return u;
}

export function handler(fn) {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e?.code === '23505') return NextResponse.json({ error: 'Data dengan kunci yang sama sudah ada.' }, { status: 409 });
      if (e?.code === '23503') return NextResponse.json({ error: 'Data masih dipakai oleh data lain, tidak bisa dihapus.' }, { status: 409 });
      if (e?.code === '23514') return NextResponse.json({ error: 'Isian tidak memenuhi aturan (cek jenis & armada).' }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: 'Terjadi kesalahan di server: ' + (e?.message || e) }, { status: 500 });
    }
  };
}

export const json = (data, status = 200) => NextResponse.json(data, { status });
