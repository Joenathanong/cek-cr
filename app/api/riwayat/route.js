import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1), size = 50, off = (page - 1) * size;
  const cari = `%${(sp.get('q') || '').trim()}%`;
  if (sp.get('tipe') === 'MASSAL') {
    const rows = await query(
      `SELECT id, user_id, username, gudang_kode, keterangan, jumlah_distributor, total_nilai_po, total_ongkir, dasar_prioritas, created_at FROM massal_run WHERE keterangan ILIKE $1 OR username ILIKE $1 ORDER BY created_at DESC LIMIT ${size + 1} OFFSET ${off}`, [cari]);
    return json({ rows: rows.slice(0, size), more: rows.length > size });
  }
  const rows = await query(
    `SELECT id, username, gudang_kode, kota_nama, distributor_nama, kg, m3, nilai_po, rekom_ekspedisi, rekom_layanan,
            rekom_ongkir, rekom_leadtime, rekom_cr, hasil, created_at
       FROM cek_history WHERE tipe = 'INDIVIDUAL' AND (kota_nama ILIKE $1 OR username ILIKE $1 OR coalesce(rekom_ekspedisi,'') ILIKE $1)
      ORDER BY created_at DESC LIMIT ${size + 1} OFFSET ${off}`, [cari]);
  return json({ rows: rows.slice(0, size), more: rows.length > size });
});

// Arsip: hapus riwayat sebelum tanggal tertentu (khusus admin, setelah diexport)
export const DELETE = handler(async (req) => {
  const u = await requireUser(['admin']);
  const sebelum = new URL(req.url).searchParams.get('sebelum');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(sebelum || '')) throw new HttpError(400, 'Tanggal tidak valid.');
  const a = await query(`DELETE FROM cek_history WHERE run_id IS NULL AND created_at < $1::date RETURNING id`, [sebelum]);
  const b = await query(`DELETE FROM massal_run WHERE created_at < $1::date RETURNING id`, [sebelum]);
  await query(`INSERT INTO audit_log (tabel, aksi, keterangan, user_id, username) VALUES ('cek_history','DELETE',$1,$2,$3)`,
    [`Arsip riwayat sebelum ${sebelum}: ${a.length} cek individual, ${b.length} proses massal`, u.id, u.username]);
  return json({ individual: a.length, massal: b.length });
});
