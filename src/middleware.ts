// ============================================================
// TV Tech OS — Next.js Middleware
// ============================================================
// Protects dashboard routes. Redirects unauthenticated users to /login.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get('tv-tech-session');

  if (!session?.value) {
    // Return 401 for unauthorized API calls (except auth endpoints)
    if (pathname.startsWith('/api')) {
      return NextResponse.json({ error: 'Unauthorized: Authentication required.' }, { status: 401 });
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Parse session user data to check role
  let userRole = 'STAFF';
  try {
    const sessionData = JSON.parse(session.value);
    userRole = sessionData.role || 'STAFF';
  } catch (e) {
    // Fallback to STAFF if parsing fails
    userRole = 'STAFF';
  }

  // Staff Route Protection: Dashboard, Purchase Manager, and Analytics are inaccessible for Staff
  if (userRole === 'STAFF') {
    if (
      pathname === '/' ||
      pathname === '' ||
      pathname.startsWith('/purchase-manager') ||
      pathname.startsWith('/analytics')
    ) {
      return NextResponse.redirect(new URL('/inventory', request.url));
    }
  }

  // If user is on /login but already authenticated, redirect appropriately
  if (pathname === '/login' && session?.value) {
    if (userRole === 'STAFF') {
      return NextResponse.redirect(new URL('/inventory', request.url));
    }
    const redirectParam = request.nextUrl.searchParams.get('redirect') || '/';
    return NextResponse.redirect(new URL(redirectParam, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
