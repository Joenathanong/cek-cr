import { handler, json, requireUser } from '@/lib/auth';
import { catatLog } from '@/lib/db';

// mencatat aktivitas export Excel
export const POST = handler(async (req) => {
  const u = await requireUser();
  const { tabel, keterangan } = await req.json();
  await catatLog(u, { tabel: String(tabel || '-').slice(0, 50), aksi: 'EXPORT', keterangan: String(keterangan || '').slice(0, 300) });
  return json({ ok: true });
});
