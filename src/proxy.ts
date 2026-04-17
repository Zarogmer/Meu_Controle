import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth/'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static files
  if (pathname.startsWith('/_next') || pathname.startsWith('/uploads') || pathname.includes('.')) {
    return NextResponse.next();
  }

  // Public paths — always allow
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check if user has a token (existence only, verification in route handlers)
  const hasToken = !!request.cookies.get('accessToken')?.value;

  // Protected API routes
  if (pathname.startsWith('/api/')) {
    if (!hasToken) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // Root redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL(hasToken ? '/dashboard' : '/login', request.url));
  }

  // Protected pages — redirect to login if no token
  if (!hasToken) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
