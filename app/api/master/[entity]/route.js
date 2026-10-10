import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { canView, canEdit } from '@/lib/entities';
import { listRows, saveRow } from '@/lib/master';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req, { params }) => {
  const u = await requireUser();
  if (!canView(params.entity, u.role)) throw new HttpError(403, 'Anda tidak punya akses ke data ini.');
  return json({ rows: await listRows(params.entity), canEdit: canEdit(params.entity, u.role) });
});

export const POST = handler(async (req, { params }) => {
  const u = await requireUser();
  if (!canEdit(params.entity, u.role)) throw new HttpError(403, 'Anda tidak punya akses mengubah data ini.');
  return json(await saveRow(u, params.entity, await req.json()));
});
