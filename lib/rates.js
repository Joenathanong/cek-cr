// Mengambil rate yang berlaku hari ini dan menjalankan perhitungan.
import { query } from './db';
import { normText } from './entities';
import { hitungKiriman } from './calc';

/** Rate berlaku: per kunci layanan, ambil versi dengan "berlaku mulai" terbaru yang sudah lewat. */
export async function rateBerlaku(gudangId, kotaIds) {
  if (!kotaIds.length) return [];
  return query(
    `SELECT * FROM (
       SELECT DISTINCT ON (r.ekspedisi_id, r.layanan, r.kota_id, r.jenis, COALESCE(r.armada_id, 0))
              r.*, e.nama AS ekspedisi, e.aktif AS ekspedisi_aktif,
              a.nama AS armada, a.kapasitas_kg, a.kapasitas_m3
         FROM rate r
         JOIN ekspedisi e ON e.id = r.ekspedisi_id
         LEFT JOIN armada a ON a.id = r.armada_id
        WHERE r.gudang_id = $1 AND r.kota_id = ANY($2::int[])
          AND r.berlaku_mulai <= (now() AT TIME ZONE 'Asia/Jakarta')::date
        ORDER BY r.ekspedisi_id, r.layanan, r.kota_id, r.jenis, COALESCE(r.armada_id, 0), r.berlaku_mulai DESC
     ) x WHERE x.aktif AND x.ekspedisi_aktif`,
    [gudangId, kotaIds]
  );
}

export async function cariKota(nama) {
  const t = normText(nama);
  if (!t) return null;
  const rows = await query(
    `SELECT id, nama, batas_leadtime FROM kota
      WHERE upper(nama) = $1
         OR $1 = ANY (SELECT upper(trim(a)) FROM unnest(string_to_array(coalesce(alias, ''), ',')) a)
      ORDER BY (upper(nama) = $1) DESC LIMIT 1`,
    [t]
  );
  return rows[0] || null;
}

export async function getGudang(id) {
  const rows = id
    ? await query('SELECT * FROM gudang WHERE id = $1', [id])
    : await query('SELECT * FROM gudang ORDER BY default_massal DESC, id LIMIT 1');
  return rows[0] || null;
}

/** Ringkas opsi untuk disimpan di riwayat (hemat ruang database). */
export function ringkas(h) {
  const pick = (o) => o && { ekspedisi: o.ekspedisi, layanan: o.layanan, ongkir: o.ongkir, cr: o.cr, lt: [o.leadtime_min, o.leadtime_max] };
  return {
    utama: pick(h.utama), termurah: pick(h.termurah), tercepat: pick(h.tercepat), peringatan: h.peringatan,
    opsi: h.opsi.map((o) => [o.ekspedisi, o.layanan, o.jenis, o.armada, o.ongkir, o.cr, o.leadtime_min, o.leadtime_max, o.dasar]),
  };
}

export { hitungKiriman };
