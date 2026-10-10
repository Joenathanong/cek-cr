import bcrypt from 'bcryptjs';
import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query } from '@/lib/db';
import { ROLES } from '@/lib/entities';
import { cekKekuatan } from '@/lib/password';

// aksi: ubah (nama, role, aktif), reset password, buka kunci
export const PUT = handler(async (req, { params }) => {
  const u = await requireUser(['admin']);
  const id = Number(params.id);
  const b = await req.json();
  const old = (await query('SELECT id, username, nama, role, aktif FROM users WHERE id = $1', [id]))[0];
  if (!old) throw new HttpError(404, 'User tidak ditemukan.');
  let ket;
  if (b.aksi === 'reset') {
    const err = cekKekuatan(b.password);
    if (err) throw new HttpError(400, err);
    await query(`UPDATE users SET password_hash = $2, must_change_password = true, failed_attempts = 0, locked_until = NULL,
                 updated_at = now(), updated_by = $3 WHERE id = $1`, [id, await bcrypt.hash(b.password, 10), u.username]);
    ket = `Reset password ${old.username}`;
  } else if (b.aksi === 'unlock') {
    await query('UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = now(), updated_by = $2 WHERE id = $1', [id, u.username]);
    ket = `Buka kunci ${old.username}`;
  } else {
    if (!ROLES[b.role]) throw new HttpError(400, 'Role tidak valid.');
    if (!String(b.nama || '').trim()) throw new HttpError(400, 'Nama wajib diisi.');
    if (id === u.id && (b.role !== 'admin' || b.aktif === false)) throw new HttpError(400, 'Anda tidak bisa menurunkan role atau menonaktifkan akun sendiri.');
    await query('UPDATE users SET nama = $2, role = $3, aktif = $4, updated_at = now(), updated_by = $5 WHERE id = $1',
      [id, b.nama.trim(), b.role, b.aktif !== false, u.username]);
    ket = `Ubah user ${old.username}`;
  }
  await query(`INSERT INTO audit_log (tabel, record_id, aksi, keterangan, data_lama, data_baru, user_id, username)
               VALUES ('users',$1,'USER',$2,$3,$4,$5,$6)`,
    [String(id), ket, JSON.stringify(old), b.aksi ? null : JSON.stringify({ nama: b.nama, role: b.role, aktif: b.aktif !== false }), u.id, u.username]);
  return json({ ok: true });
});
