import bcrypt from 'bcryptjs';
import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query } from '@/lib/db';
import { ROLES } from '@/lib/entities';
import { cekKekuatan } from '@/lib/password';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireUser(['admin']);
  return json({ rows: await query(
    `SELECT id, username, nama, role, aktif, must_change_password, locked_until, last_login, updated_at, updated_by
       FROM users ORDER BY aktif DESC, role, username`) });
});

export const POST = handler(async (req) => {
  const u = await requireUser(['admin']);
  const b = await req.json();
  const username = String(b.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) throw new HttpError(400, 'Username 3-30 karakter: huruf kecil, angka, titik, - atau _.');
  if (!String(b.nama || '').trim()) throw new HttpError(400, 'Nama wajib diisi.');
  if (!ROLES[b.role]) throw new HttpError(400, 'Role tidak valid.');
  const err = cekKekuatan(b.password);
  if (err) throw new HttpError(400, err);
  const rows = await query(
    `INSERT INTO users (username, nama, role, password_hash, must_change_password, updated_by) VALUES ($1,$2,$3,$4,true,$5) RETURNING id`,
    [username, b.nama.trim(), b.role, await bcrypt.hash(b.password, 10), u.username]);
  await query(`INSERT INTO audit_log (tabel, record_id, aksi, keterangan, data_baru, user_id, username) VALUES ('users',$1,'USER',$2,$3,$4,$5)`,
    [String(rows[0].id), `Tambah user ${username}`, JSON.stringify({ username, nama: b.nama, role: b.role }), u.id, u.username]);
  return json({ id: rows[0].id });
});
