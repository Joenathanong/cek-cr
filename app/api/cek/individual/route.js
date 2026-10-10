import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query } from '@/lib/db';
import { cariKota, getGudang, rateBerlaku, hitungKiriman, ringkas } from '@/lib/rates';
import { leadtimeText } from '@/lib/format';

export const POST = handler(async (req) => {
  const u = await requireUser();
  const b = await req.json();
  const kg = Number(b.kg) || 0, m3 = Number(b.m3) || 0, nilaiPo = Number(b.nilaiPo) || 0;
  if (kg <= 0 && m3 <= 0) throw new HttpError(400, 'Isi berat (kg) atau volume (m³).');
  if (kg < 0 || m3 < 0 || nilaiPo < 0) throw new HttpError(400, 'Angka tidak boleh negatif.');
  const gudang = await getGudang(b.gudangId);
  if (!gudang) throw new HttpError(400, 'Gudang asal tidak ditemukan.');
  const kota = await cariKota(b.kota);
  if (!kota) throw new HttpError(404, `Kota "${b.kota}" belum ada di master kota. Pilih dari daftar saran.`);

  const [rates, distributor] = await Promise.all([
    rateBerlaku(gudang.id, [kota.id]),
    query('SELECT kode, nama FROM distributor WHERE kota_id = $1 AND aktif ORDER BY nama', [kota.id]),
  ]);
  const h = hitungKiriman(rates, { kg, m3, nilaiPo, batasLeadtime: kota.batas_leadtime });
  const ut = h.utama;
  await query(
    `INSERT INTO cek_history (tipe, user_id, username, gudang_kode, kota_nama, distributor_kode, distributor_nama, kg, m3, nilai_po,
       rekom_ekspedisi, rekom_layanan, rekom_ongkir, rekom_leadtime, rekom_cr, hasil)
     VALUES ('INDIVIDUAL',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [u.id, u.username, gudang.kode, kota.nama, distributor.map((d) => d.kode).join(', ') || null,
      distributor.map((d) => d.nama).join(', ') || null, kg, m3, nilaiPo, ut?.ekspedisi ?? null, ut?.layanan ?? null,
      ut?.ongkir ?? null, ut ? leadtimeText(ut.leadtime_min, ut.leadtime_max) : null, ut?.cr ?? null, JSON.stringify(ringkas(h))]
  );
  return json({ gudang: { kode: gudang.kode, nama: gudang.nama }, kota, distributor, kg, m3, nilaiPo, ...h });
});
