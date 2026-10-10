import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { canEdit } from '@/lib/entities';
import { saveRow, deleteRow } from '@/lib/master';

export const PUT = handler(async (req, { params }) => {
  const u = await requireUser();
  if (!canEdit(params.entity, u.role)) throw new HttpError(403, 'Anda tidak punya akses mengubah data ini.');
  return json(await saveRow(u, params.entity, await req.json(), Number(params.id)));
});

export const DELETE = handler(async (req, { params }) => {
  const u = await requireUser();
  if (!canEdit(params.entity, u.role)) throw new HttpError(403, 'Anda tidak punya akses menghapus data ini.');
  await deleteRow(u, params.entity, Number(params.id));
  return json({ ok: true });
});
