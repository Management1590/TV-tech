// ============================================================
// TV Tech OS — Infinite Session Configuration
// ============================================================

export const SESSION_COOKIE_NAME = 'tv-tech-session';

/**
 * 100 years in seconds (effectively infinite session lifetime).
 * Chromium browsers cap Max-Age to 400 days; Next.js middleware
 * applies sliding-window renewal on every request to ensure the
 * session never expires.
 */
const parsedEnvMaxAge = process.env.SESSION_MAX_AGE_SECONDS
  ? parseInt(process.env.SESSION_MAX_AGE_SECONDS, 10)
  : NaN;

export const INFINITE_SESSION_MAX_AGE =
  !isNaN(parsedEnvMaxAge) && parsedEnvMaxAge > 0
    ? parsedEnvMaxAge
    : 100 * 365 * 24 * 60 * 60; // 3,153,600,000 seconds (~100 years)

/**
 * Returns standardized cookie options for permanent / infinite session persistence.
 */
export function getSessionCookieOptions(maxAge: number = INFINITE_SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    expires: new Date(Date.now() + maxAge * 1000),
    path: '/',
  };
}
