// ============================================================
// TV Tech OS — Server-Side Auth & User Resolution
// ============================================================
// Retrieves authenticated user from Supabase Auth & Prisma User table.
// Enforces Server-Side Role-Based Access Control (ADMIN vs STAFF).

import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { createClient } from '@/lib/supabase/server';
import { UserRole } from '@prisma/client';

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

/**
 * Get the current authenticated user from Supabase Auth session or session cookie.
 * Returns null if unauthenticated.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const cookieStore = await cookies();

    // 1. Check direct session cookie first for fast lookup
    const sessionCookie = cookieStore.get('tv-tech-session');
    if (sessionCookie?.value) {
      try {
        const sessionData = JSON.parse(sessionCookie.value);
        if (sessionData?.userId) {
          const user = await prisma.user.findUnique({
            where: { id: sessionData.userId },
            select: { id: true, email: true, fullName: true, role: true, isActive: true },
          });

          if (user && user.isActive) {
            return {
              id: user.id,
              email: user.email,
              fullName: user.fullName,
              role: sessionData.role === 'ADMIN' ? UserRole.ADMIN : user.role,
            };
          }
        }
      } catch {
        // Fall through to Supabase auth check
      }
    }

    // 2. Check Supabase Auth session
    const supabase = await createClient();
    const { data: { user: authUser } } = await supabase.auth.getUser();

    if (authUser?.email) {
      const user = await prisma.user.findUnique({
        where: { email: authUser.email.toLowerCase().trim() },
        select: { id: true, email: true, fullName: true, role: true, isActive: true },
      });

      if (user && user.isActive) {
        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: user.role,
        };
      }
    }

    return null;
  } catch (err) {
    console.error('getCurrentUser error:', err);
    return null;
  }
}

/**
 * Require authentication. Throws if not authenticated.
 */
export async function requireAuth(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('UNAUTHORIZED: Authentication required');
  }
  return user;
}

/**
 * Require admin role. Throws if not admin.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireAuth();
  if (user.role !== 'ADMIN') {
    throw new Error('FORBIDDEN: Admin access required');
  }
  return user;
}
