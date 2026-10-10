import { query } from './db';

export const DEFAULT = {
  nama_pt: 'PT Gloria Origita Cosmetics',
  logo: null,
  login_judul: 'Pilih armada dengan angka, bukan tebakan.',
  login_slogan: 'Bandingkan ongkir, leadtime, dan cost ratio semua ekspedisi untuk setiap kiriman.',
  batas_cr: '23',
  interval_peringatan_jam: '4',
};

export async function bacaPengaturan() {
  const rows = await query('SELECT kunci, nilai, updated_at, updated_by FROM pengaturan');
  const out = { ...DEFAULT }, info = {};
  for (const r of rows) { out[r.kunci] = r.nilai; info[r.kunci] = { updated_at: r.updated_at, updated_by: r.updated_by }; }
  return { nilai: out, info };
}

export async function batasCr() {
  const { nilai } = await bacaPengaturan();
  const n = Number(nilai.batas_cr);
  return isFinite(n) && n > 0 ? n : 23;
}
