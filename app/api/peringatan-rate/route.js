import { handler, json, requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { getGudang, rateBerlaku } from '@/lib/rates';
import { bacaPengaturan } from '@/lib/pengaturan';

export const dynamic = 'force-dynamic';

// Kota yang punya distributor aktif tetapi belum punya rate berlaku dari gudang default.
export const GET = handler(async () => {
  await requireUser();
  const gudang = await getGudang();
  const kota = await query(
    `SELECT k.id, k.nama, string_agg(d.nama, ', ' ORDER BY d.nama) AS distributor
       FROM distributor d JOIN kota k ON k.id = d.kota_id WHERE d.aktif GROUP BY k.id, k.nama ORDER BY k.nama`);
  const rates = await rateBerlaku(gudang.id, kota.map((k) => k.id));
  const ada = new Set(rates.map((r) => r.kota_id));
  const { nilai } = await bacaPengaturan();
  return json({
    gudang: gudang.kode, intervalJam: Number(nilai.interval_peringatan_jam) || 4,
    kota: kota.filter((k) => !ada.has(k.id)).map((k) => ({ nama: k.nama, distributor: k.distributor })),
  });
});
