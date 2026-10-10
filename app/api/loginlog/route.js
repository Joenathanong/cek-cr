import { handler, json, requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  await requireUser(['admin']);
  const page = Math.max(1, Number(new URL(req.url).searchParams.get('page')) || 1), size = 50;
  const rows = await query(`SELECT * FROM login_log ORDER BY waktu DESC LIMIT ${size + 1} OFFSET ${(page - 1) * size}`);
  return json({ rows: rows.slice(0, size), more: rows.length > size });
});
