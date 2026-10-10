import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query, withUser } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireUser();
  return json({ rows: await query('SELECT id, nama, mode, urutan, updated_at, updated_by FROM prioritas_template ORDER BY mode, nama') });
});

// simpan (buat baru atau timpa template dengan nama & mode yang sama)
export const POST = handler(async (req) => {
  const u = await requireUser();
  const b = await req.json();
  const nama = String(b.nama || '').trim().slice(0, 80);
  if (!nama) throw new HttpError(400, 'Nama template wajib diisi.');
  if (!['AREA', 'KOTA'].includes(b.mode)) throw new HttpError(400, 'Mode harus AREA atau KOTA.');
  const urutan = (Array.isArray(b.urutan) ? b.urutan : []).map((x) => String(x).trim().toUpperCase()).filter(Boolean);
  if (!urutan.length) throw new HttpError(400, 'Daftar urutan kosong.');
  if (new Set(urutan).size !== urutan.length) throw new HttpError(400, 'Ada nama yang muncul dua kali di daftar.');
  const rows = await withUser(u, (q) => q(
    `INSERT INTO prioritas_template (nama, mode, urutan) VALUES ($1, $2, $3)
     ON CONFLICT (nama, mode) DO UPDATE SET urutan = EXCLUDED.urutan RETURNING id, nama, mode, urutan, updated_at, updated_by`,
    [nama, b.mode, JSON.stringify(urutan)]), `Simpan template prioritas ${nama}`);
  return json(rows[0]);
});
