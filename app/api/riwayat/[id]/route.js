import { handler, json, requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

// detail satu proses massal
export const GET = handler(async (req, { params }) => {
  await requireUser();
  const run = (await query('SELECT * FROM massal_run WHERE id = $1', [params.id]))[0];
  const rows = await query('SELECT * FROM cek_history WHERE run_id = $1 ORDER BY kota_nama, distributor_nama', [params.id]);
  return json({ run, rows });
});
