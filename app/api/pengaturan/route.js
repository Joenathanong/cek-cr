import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { query, withUser } from '@/lib/db';
import { bacaPengaturan } from '@/lib/pengaturan';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  await requireUser();
  return json(await bacaPengaturan());
});

const ATURAN = {
  nama_pt: (v) => (String(v || '').trim().length >= 3 ? null : 'Nama PT minimal 3 karakter.'),
  login_judul: (v) => (String(v || '').length <= 120 ? null : 'Judul maksimal 120 karakter.'),
  login_slogan: (v) => (String(v || '').length <= 300 ? null : 'Slogan maksimal 300 karakter.'),
  batas_cr: (v) => (Number(v) > 0 && Number(v) <= 100 ? null : 'Batas CR harus antara 0 dan 100.'),
  interval_peringatan_jam: (v) => (Number(v) >= 0.25 && Number(v) <= 168 ? null : 'Interval peringatan 0,25 sampai 168 jam.'),
  logo: (v) => (v == null || v === '' || (/^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= 420000)
    ? null : 'Logo harus PNG, JPG, WEBP, atau SVG dengan ukuran maksimal 300 KB.'),
};

export const PUT = handler(async (req) => {
  const u = await requireUser(['admin']);
  const b = await req.json();
  const ubah = Object.entries(b).filter(([k]) => ATURAN[k]);
  for (const [k, v] of ubah) { const e = ATURAN[k](v); if (e) throw new HttpError(400, e); }
  const lama = (await bacaPengaturan()).nilai;
  await withUser(u, async (q) => {
    for (const [k, v] of ubah) {
      const nilai = v === '' || v == null ? null : String(v).trim();
      if ((lama[k] ?? null) === nilai) continue;
      await q(`INSERT INTO pengaturan (kunci, nilai, updated_at, updated_by) VALUES ($1,$2,now(),$3)
               ON CONFLICT (kunci) DO UPDATE SET nilai = $2, updated_at = now(), updated_by = $3`, [k, nilai, u.username]);
      await q(`INSERT INTO audit_log (tabel, record_id, aksi, data_lama, data_baru, keterangan, user_id, username)
               VALUES ('pengaturan',$1,'UPDATE',$2,$3,'Ubah pengaturan',$4,$5)`,
        [k, JSON.stringify({ [k]: k === 'logo' ? (lama[k] ? '(gambar)' : null) : lama[k] }),
          JSON.stringify({ [k]: k === 'logo' ? (nilai ? '(gambar baru)' : null) : nilai }), u.id, u.username]);
    }
  });
  return json(await bacaPengaturan());
});
