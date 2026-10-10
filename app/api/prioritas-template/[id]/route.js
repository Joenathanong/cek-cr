import { handler, json, requireUser } from '@/lib/auth';
import { withUser } from '@/lib/db';

export const DELETE = handler(async (req, { params }) => {
  const u = await requireUser();
  await withUser(u, (q) => q('DELETE FROM prioritas_template WHERE id = $1', [Number(params.id)]), 'Hapus template prioritas');
  return json({ ok: true });
});
