import { json, handler } from '@/lib/auth';
import { bacaPengaturan } from '@/lib/pengaturan';

export const dynamic = 'force-dynamic';

// Dipakai halaman login (tanpa login): hanya data tampilan.
export const GET = handler(async () => {
  const { nilai } = await bacaPengaturan();
  return json({ namaPt: nilai.nama_pt, logo: nilai.logo, judul: nilai.login_judul, slogan: nilai.login_slogan },
    200);
});
