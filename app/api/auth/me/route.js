import { handler, json, requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const GET = handler(async () => {
  const u = await requireUser();
  return json({ user: { id: u.id, username: u.username, nama: u.nama, role: u.role, mustChange: u.must_change_password } });
});
