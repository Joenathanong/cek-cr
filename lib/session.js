// Token sesi (JWT) — bisa dipakai di middleware (edge) maupun API.
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'ccr_session';
export const SESSION_HOURS = 8;

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error('AUTH_SECRET belum diatur (minimal 32 karakter)');
  return new TextEncoder().encode(s);
}

export async function signSession(user) {
  return new SignJWT({ u: user.username, n: user.nama, r: user.role, m: !!user.must_change_password })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(key());
}

export async function readSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return { id: Number(payload.sub), username: payload.u, nama: payload.n, role: payload.r, mustChange: !!payload.m };
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_HOURS * 3600,
  };
}
