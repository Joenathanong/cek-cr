import { query } from './db';

export async function bacaPrioritas() {
  const [mode, area, kota] = await Promise.all([
    query(`SELECT nilai, updated_at, updated_by FROM pengaturan WHERE kunci = 'dasar_prioritas'`),
    query('SELECT id, nama, prioritas FROM area ORDER BY prioritas, nama'),
    query('SELECT id, nama, prioritas FROM kota ORDER BY prioritas NULLS LAST, nama'),
  ]);
  return { mode: mode[0]?.nilai || 'AREA', info: mode[0] || null, area, kota };
}

