import { handler, json, requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Data kecil untuk isian form, auto-suggest kota, dan proses massal.
export const GET = handler(async () => {
  await requireUser();
  const [gudang, kota, area, ekspedisi, armada, distributor, peng] = await Promise.all([
    query('SELECT id, kode, nama, plant, default_massal FROM gudang ORDER BY default_massal DESC, kode'),
    query('SELECT id, nama, alias, batas_leadtime, prioritas FROM kota ORDER BY nama'),
    query('SELECT id, nama, prioritas FROM area ORDER BY prioritas, nama'),
    query('SELECT id, nama, aktif FROM ekspedisi ORDER BY nama'),
    query('SELECT id, nama, kapasitas_kg, kapasitas_m3 FROM armada ORDER BY nama'),
    query(`SELECT d.id, d.kode, d.nama, d.asm, d.kota_id, k.nama AS kota, k.prioritas AS prioritas_kota, a.nama AS area, a.prioritas
             FROM distributor d JOIN kota k ON k.id = d.kota_id LEFT JOIN area a ON a.id = d.area_id
            WHERE d.aktif ORDER BY k.nama, d.nama`),
    query(`SELECT nilai FROM pengaturan WHERE kunci = 'dasar_prioritas'`),
  ]);
  return json({ gudang, kota, area, ekspedisi, armada, distributor, dasarPrioritas: peng[0]?.nilai || 'AREA' });
});
