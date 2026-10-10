import { cookies } from 'next/headers';
import { json } from '@/lib/auth';
import { COOKIE } from '@/lib/session';

export async function POST() {
  cookies().delete(COOKIE);
  return json({ ok: true });
}
