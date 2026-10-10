import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { withUser } from '@/lib/db';
import { MENU_ACCESS } from '@/lib/entities';
import { bacaPrioritas } from '@/lib/prioritas';

export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const u = await requireUser();
  return json({ ...(await bacaPrioritas()), canEdit: MENU_ACCESS.prioritasEdit.includes(u.role) });
});

/**
 * body: { mode: 'AREA'|'KOTA', area: [id urut], kota: [id urut] }
 * area: semua area dalam urutan baru. kota: hanya kota yang diprioritaskan (lainnya dikosongkan).
 */
export const PUT = handler(async (req) => {
  const u = await requireUser(MENU_ACCESS.prioritasEdit);
  const b = await req.json();
  if (!['AREA', 'KOTA'].includes(b.mode)) throw new HttpError(400, 'Dasar prioritas harus AREA atau KOTA.');
  const area = (b.area || []).map(Number).filter(Boolean);
  const kota = (b.kota || []).map(Number).filter(Boolean);
  if (new Set(kota).size !== kota.length) throw new HttpError(400, 'Ada kota yang dipilih dua kali.');
  await withUser(u, async (q) => {
    const old = await q(`SELECT nilai FROM pengaturan WHERE kunci = 'dasar_prioritas'`);
    if (old[0]?.nilai !== b.mode) {
      await q(`INSERT INTO pengaturan (kunci, nilai, updated_at, updated_by) VALUES ('dasar_prioritas', $1, now(), $2)
               ON CONFLICT (kunci) DO UPDATE SET nilai = $1, updated_at = now(), updated_by = $2`, [b.mode, u.username]);
      await q(`INSERT INTO audit_log (tabel, aksi, keterangan, data_lama, data_baru, user_id, username)
               VALUES ('pengaturan','UPDATE','Dasar prioritas alokasi',$1,$2,$3,$4)`,
        [JSON.stringify({ dasar_prioritas: old[0]?.nilai }), JSON.stringify({ dasar_prioritas: b.mode }), u.id, u.username]);
    }
    if (area.length) {
      await q(`UPDATE area a SET prioritas = x.ord FROM unnest($1::int[]) WITH ORDINALITY AS x(id, ord) WHERE a.id = x.id AND a.prioritas IS DISTINCT FROM x.ord`, [area]);
    }
    await q(`UPDATE kota SET prioritas = NULL WHERE prioritas IS NOT NULL AND NOT (id = ANY($1::int[]))`, [kota]);
    if (kota.length) {
      await q(`UPDATE kota k SET prioritas = x.ord FROM unnest($1::int[]) WITH ORDINALITY AS x(id, ord) WHERE k.id = x.id AND k.prioritas IS DISTINCT FROM x.ord`, [kota]);
    }
  }, 'Atur prioritas alokasi');
  return json(await bacaPrioritas());
});
