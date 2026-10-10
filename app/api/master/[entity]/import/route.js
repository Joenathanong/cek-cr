import { handler, json, requireUser, HttpError } from '@/lib/auth';
import { canEdit } from '@/lib/entities';
import { importRows } from '@/lib/master';

export const maxDuration = 60;

export const POST = handler(async (req, { params }) => {
  const u = await requireUser();
  if (!canEdit(params.entity, u.role)) throw new HttpError(403, 'Anda tidak punya akses upload data ini.');
  const { rows, fileName } = await req.json();
  const res = await importRows(u, params.entity, rows, fileName);
  return json(res, res.ok ? 200 : 422);
});
