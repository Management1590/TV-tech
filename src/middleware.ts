// ============================================================
// TV Tech OS — Next.js Middleware
// ============================================================
// Protects dashboard routes. Redirects unauthenticated users to /login.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, getSessionCookieOptions } from '@/lib/auth/session-config';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const session = request.cookies.get(SESSION_COOKIE_NAME);

  // If user is on /login but already authenticated, redirect appropriately and refresh cookie
  if (pathname === '/login' && session?.value) {
    let userRole = 'STAFF';
    try {
      const sessionData = JSON.parse(session.value);
      userRole = sessionData.role || 'STAFF';
    } catch {
      userRole = 'STAFF';
    }

    const redirectPath = userRole === 'STAFF' ? '/inventory' : (request.nextUrl.searchParams.get('redirect') || '/');
    const response = NextResponse.redirect(new URL(redirectPath, request.url));
    response.cookies.set(SESSION_COOKIE_NAME, session.value, getSessionCookieOptions());
    return response;
  }

  // Allow public paths (e.g. /login for unauthenticated users, /api/auth)
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

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
      const redirectResponse = NextResponse.redirect(new URL('/inventory', request.url));
      redirectResponse.cookies.set(SESSION_COOKIE_NAME, session.value, getSessionCookieOptions());
      return redirectResponse;
    }
  }

  // Sliding Session Renewal: Re-set infinite session cookie on every authenticated request
  // so that the 400-day browser expiration window is continuously rolled forward into the future.
  const response = NextResponse.next();
  response.cookies.set(SESSION_COOKIE_NAME, session.value, getSessionCookieOptions());
  return response;
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
