import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query, withUser } from '@/lib/db';
import { getGudang, rateBerlaku, hitungKiriman, ringkas } from '@/lib/rates';
import { leadtimeText } from '@/lib/format';
import { normText } from '@/lib/entities';

export const maxDuration = 60;

/**
 * body: { gudangId, keterangan, rows: [{ kode, nama, kg, m3, nilaiPo, jumlahSo }] }
 * rows sudah dialokasikan & dijumlahkan per distributor di browser.
 */
export const POST = handler(async (req) => {
  const u = await requireUser();
  const b = await req.json();
  if (!Array.isArray(b.rows) || !b.rows.length) throw new HttpError(400, 'Tidak ada data untuk dihitung.');
  if (b.rows.length > 3000) throw new HttpError(400, 'Maksimal 3.000 distributor per proses.');
  const gudang = await getGudang(b.gudangId);
  if (!gudang) throw new HttpError(400, 'Gudang asal tidak ditemukan.');

  const kodes = b.rows.filter((r) => r.kode).map((r) => String(r.kode));
  const kotaAll = await query('SELECT id, nama, alias, batas_leadtime FROM kota');
  const kMap = new Map();
  for (const k of kotaAll) for (const a of String(k.alias || '').split(',')) if (a.trim()) kMap.set(normText(a), k);
  for (const k of kotaAll) kMap.set(normText(k.nama), k);
  const dist = await query(
    `SELECT d.kode, d.nama, d.kota_id, k.nama AS kota, k.batas_leadtime, a.nama AS area, a.prioritas
       FROM distributor d JOIN kota k ON k.id = d.kota_id LEFT JOIN area a ON a.id = d.area_id
      WHERE d.kode = ANY($1::text[])`, [kodes]);
  const dMap = new Map(dist.map((d) => [d.kode, d]));
  // baris dari template boleh hanya berisi kota (tanpa kode distributor)
  const cari = (r) => {
    if (r.kode) return dMap.get(String(r.kode));
    const k = kMap.get(normText(r.kota));
    return k ? { kode: '', nama: r.nama || '', kota_id: k.id, kota: k.nama, batas_leadtime: k.batas_leadtime, area: null } : null;
  };
  const found = b.rows.map(cari);
  const rates = await rateBerlaku(gudang.id, [...new Set(found.filter(Boolean).map((d) => d.kota_id))]);
  const byKota = new Map();
  for (const r of rates) (byKota.get(r.kota_id) || byKota.set(r.kota_id, []).get(r.kota_id)).push(r);

  const hasil = b.rows.map((r, i) => {
    const d = found[i];
    const base = { kode: String(r.kode || ''), nama: d?.nama || r.nama || '', kota: d?.kota || r.kota || null, area: d?.area || null, ref: r.ref || null,
      kg: Number(r.kg) || 0, m3: Number(r.m3) || 0, nilaiPo: Number(r.nilaiPo) || 0, jumlahSo: r.jumlahSo || null };
    if (!d) return { ...base, opsi: [], ditolak: [], utama: null, termurah: null, tercepat: null,
      peringatan: [r.kode ? 'Kode distributor belum terdaftar di master distributor.' : `Kota "${r.kota || ''}" tidak ditemukan di master kota.`] };
    if (base.kg <= 0 && base.m3 <= 0) return { ...base, opsi: [], ditolak: [], utama: null, termurah: null, tercepat: null,
      peringatan: ['Berat & volume 0 (data berat/volume SAP tidak ditemukan).'] };
    return { ...base, ...hitungKiriman(byKota.get(d.kota_id) || [], { kg: base.kg, m3: base.m3, nilaiPo: base.nilaiPo, batasLeadtime: d.batas_leadtime }) };
  });

  const runId = await withUser(u, async (q) => {
    const run = await q(
      `INSERT INTO massal_run (user_id, username, gudang_kode, keterangan, jumlah_distributor, total_nilai_po, total_ongkir, dasar_prioritas, items)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [u.id, u.username, gudang.kode, String(b.keterangan || '').slice(0, 300), hasil.length,
        hasil.reduce((s, h) => s + h.nilaiPo, 0), hasil.reduce((s, h) => s + (h.utama?.ongkir || 0), 0),
        b.dasarPrioritas || null, Array.isArray(b.items) ? JSON.stringify(b.items.slice(0, 20000)) : null]);
    const id = run[0].id;
    const recs = hasil.map((h) => ({
      run_id: id, tipe: 'MASSAL', user_id: u.id, username: u.username, gudang_kode: gudang.kode, kota_nama: h.kota,
      distributor_kode: h.kode, distributor_nama: h.nama, kg: h.kg, m3: h.m3, nilai_po: h.nilaiPo,
      rekom_ekspedisi: h.utama?.ekspedisi ?? null, rekom_layanan: h.utama?.layanan ?? null, rekom_ongkir: h.utama?.ongkir ?? null,
      rekom_leadtime: h.utama ? leadtimeText(h.utama.leadtime_min, h.utama.leadtime_max) : null, rekom_cr: h.utama?.cr ?? null,
      hasil: ringkas(h),
    }));
    await q(`INSERT INTO cek_history (run_id, tipe, user_id, username, gudang_kode, kota_nama, distributor_kode, distributor_nama,
               kg, m3, nilai_po, rekom_ekspedisi, rekom_layanan, rekom_ongkir, rekom_leadtime, rekom_cr, hasil)
             SELECT run_id, tipe, user_id, username, gudang_kode, kota_nama, distributor_kode, distributor_nama,
               kg, m3, nilai_po, rekom_ekspedisi, rekom_layanan, rekom_ongkir, rekom_leadtime, rekom_cr, hasil
               FROM json_populate_recordset(NULL::cek_history, $1)`, [JSON.stringify(recs)]);
    return id;
  });
  return json({ runId, gudang: { kode: gudang.kode, nama: gudang.nama }, hasil });
});
