import { handler, json, requireUser } from '@/lib/auth';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = handler(async (req) => {
  const u = await requireUser(['admin', 'purchasing', 'admin_wh']);
  const sp = new URL(req.url).searchParams;
  const page = Math.max(1, Number(sp.get('page')) || 1), size = 50;
  const where = [], p = [];
  const add = (sql, v) => { p.push(v); where.push(sql.replace('?', `$${p.length}`)); };
  if (u.role !== 'admin') add('username = ?', u.username);
  else if (sp.get('user')) add('username = ?', sp.get('user'));
  if (sp.get('tabel')) add('tabel = ?', sp.get('tabel'));
  if (sp.get('aksi')) add('aksi = ?', sp.get('aksi'));
  if (sp.get('dari')) add(`waktu >= ?::date`, sp.get('dari'));
  if (sp.get('sampai')) add(`waktu < ?::date + 1`, sp.get('sampai'));
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = await query(`SELECT * FROM audit_log ${w} ORDER BY waktu DESC, id DESC LIMIT ${size + 1} OFFSET ${(page - 1) * size}`, p);
  const users = u.role === 'admin' ? await query('SELECT DISTINCT username FROM audit_log ORDER BY 1') : [{ username: u.username }];
  return json({ rows: rows.slice(0, size), more: rows.length > size, users: users.map((x) => x.username) });
});
