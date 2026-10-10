import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { query } from '@/lib/db';
import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { COOKIE, signSession, cookieOptions } from '@/lib/session';
import { cekKekuatan } from '@/lib/password';

export const POST = handler(async (req) => {
  const u = await requireUser();
  const { lama, baru } = await req.json();
  const row = (await query('SELECT password_hash FROM users WHERE id = $1', [u.id]))[0];
  if (!(await bcrypt.compare(String(lama || ''), row.password_hash))) throw new HttpError(400, 'Password lama salah.');
  const err = cekKekuatan(baru);
  if (err) throw new HttpError(400, err);
  if (lama === baru) throw new HttpError(400, 'Password baru harus berbeda dari password lama.');
  await query('UPDATE users SET password_hash = $2, must_change_password = false, updated_at = now(), updated_by = $3 WHERE id = $1',
    [u.id, await bcrypt.hash(baru, 10), u.username]);
  await query(`INSERT INTO audit_log (tabel, record_id, aksi, keterangan, user_id, username)
               VALUES ('users', $1, 'USER', 'Ganti password sendiri', $2, $3)`, [String(u.id), u.id, u.username]);
  cookies().set(COOKIE, await signSession({ ...u, must_change_password: false }), cookieOptions());
  return json({ ok: true });
});
