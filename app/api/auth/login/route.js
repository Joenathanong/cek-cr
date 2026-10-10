import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { handler, json } from '@/lib/auth';
import { COOKIE, signSession, cookieOptions } from '@/lib/session';

const MAX_GAGAL = 5;
const KUNCI_MENIT = 15;

export const POST = handler(async (req) => {
  const { username, password } = await req.json().catch(() => ({}));
  const uname = String(username || '').trim().toLowerCase();
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null;
  const ua = (req.headers.get('user-agent') || '').slice(0, 300);
  const log = (u, ok, ket) =>
    query('INSERT INTO login_log (user_id, username, berhasil, keterangan, ip, user_agent) VALUES ($1,$2,$3,$4,$5,$6)',
      [u?.id ?? null, uname || '-', ok, ket, ip, ua]);

  if (!uname || !password) return json({ error: 'Isi username dan password.' }, 400);
  const u = (await query('SELECT * FROM users WHERE lower(username) = $1', [uname]))[0];
  if (!u) { await log(null, false, 'Username tidak terdaftar'); return json({ error: 'Username atau password salah.' }, 401); }
  if (!u.aktif) { await log(u, false, 'Akun nonaktif'); return json({ error: 'Akun dinonaktifkan. Hubungi admin.' }, 403); }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    await log(u, false, 'Akun terkunci');
    const jam = new Date(u.locked_until).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });
    return json({ error: `Akun terkunci karena terlalu banyak percobaan. Coba lagi setelah pukul ${jam} WIB.` }, 423);
  }
  const ok = await bcrypt.compare(String(password), u.password_hash);
  if (!ok) {
    const gagal = u.failed_attempts + 1;
    const kunci = gagal >= MAX_GAGAL;
    await query(
      `UPDATE users SET failed_attempts = $2,
         locked_until = CASE WHEN $3 THEN now() + interval '${KUNCI_MENIT} minutes' ELSE locked_until END WHERE id = $1`,
      [u.id, kunci ? 0 : gagal, kunci]
    );
    await log(u, false, kunci ? 'Password salah, akun dikunci' : 'Password salah');
    return json({ error: kunci ? `Password salah ${MAX_GAGAL} kali. Akun dikunci ${KUNCI_MENIT} menit.` : 'Username atau password salah.' }, 401);
  }
  await query('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login = now() WHERE id = $1', [u.id]);
  await log(u, true, 'Login berhasil');
  cookies().set(COOKIE, await signSession(u), cookieOptions());
  return json({ user: { username: u.username, nama: u.nama, role: u.role, mustChange: u.must_change_password } });
});
