import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = [
  '/',
  '/turfs',
  '/auth/login',
  '/auth/register',
  '/auth/phone',
  '/legal/terms',
  '/legal/privacy',
];

const ownerPaths = ['/owner'];
const adminPaths = ['/admin'];
const playerPaths = ['/dashboard', '/bookings', '/favorites', '/profile'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth-token')?.value;
  const userRole = request.cookies.get('user-role')?.value;

  // Allow public paths
  if (publicPaths.some((path) => pathname === path || pathname.startsWith('/turfs/'))) {
    return NextResponse.next();
  }

  // Check authentication
  if (!token) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // RBAC checks
  if (adminPaths.some((path) => pathname.startsWith(path))) {
    if (userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  if (ownerPaths.some((path) => pathname.startsWith(path))) {
    if (userRole !== 'OWNER' && userRole !== 'ADMIN') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|images).*)',
  ],
};
