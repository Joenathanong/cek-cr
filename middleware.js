import { NextResponse } from 'next/server';
import { COOKIE, readSession } from './lib/session';

// Halaman/endpoint yang dibatasi per role (dicek lagi di API)
const PAGE_ROLES = [
  ['/users', ['admin']],
  ['/log/login', ['admin']],
  ['/log', ['admin', 'purchasing', 'admin_wh']],
  ['/master/armada', ['admin', 'purchasing', 'admin_wh']],
];

export async function middleware(req) {
  const { pathname, search } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');
  const s = await readSession(req.cookies.get(COOKIE)?.value);

  if (!s) {
    if (isApi) return NextResponse.json({ error: 'Sesi berakhir. Silakan login lagi.' }, { status: 401 });
    const url = new URL('/login', req.url);
    if (pathname !== '/') url.searchParams.set('next', pathname + search);
    return NextResponse.redirect(url);
  }
  if (s.mustChange && pathname !== '/akun' && !pathname.startsWith('/api/auth/')) {
    if (isApi) return NextResponse.json({ error: 'Ganti password terlebih dahulu.' }, { status: 403 });
    return NextResponse.redirect(new URL('/akun', req.url));
  }
  if (!isApi) {
    const rule = PAGE_ROLES.find(([p]) => pathname === p || pathname.startsWith(p + '/'));
    if (rule && !rule[1].includes(s.role)) return NextResponse.redirect(new URL('/', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!login|api/auth/login|api/auth/logout|_next/static|_next/image|favicon.ico|icon.svg).*)'],
};
