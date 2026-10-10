import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query } from '@/lib/db';
import { getGudang, rateBerlaku } from '@/lib/rates';
import { batasCr } from '@/lib/pengaturan';

// Data untuk hitung ulang di browser: kota distributor, rate berlaku, dan batas CR.
export const POST = handler(async (req) => {
  await requireUser();
  const b = await req.json();
  const gudang = await getGudang(b.gudangId);
  if (!gudang) throw new HttpError(400, 'Gudang asal tidak ditemukan.');
  const kodes = (b.kodes || []).map(String);
  const dist = await query(
    `SELECT d.kode, d.kota_id, k.nama AS kota, k.batas_leadtime FROM distributor d JOIN kota k ON k.id = d.kota_id
      WHERE d.kode = ANY($1::text[])`, [kodes]);
  const rates = await rateBerlaku(gudang.id, [...new Set(dist.map((d) => d.kota_id))]);
  return json({ gudang: { kode: gudang.kode }, batas: await batasCr(), dist, rates });
});
