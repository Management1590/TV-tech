// ============================================================
// Server-Side RBAC Guard Helper
// ============================================================
// Enforces Phase 17 security rules server-side for Server Actions & API Routes.
// Never relies solely on UI restrictions.

import { hasPermission, Permission, UserRole } from './permissions';

export class UnauthorizedError extends Error {
  constructor(message = 'Access denied: Insufficient permissions for this action') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Asserts that a given user role possesses the required permission.
 * Throws UnauthorizedError if permission is denied.
 */
export function assertPermission(role: UserRole | undefined | null, permission: Permission): void {
  if (!role || !hasPermission(role, permission)) {
    throw new UnauthorizedError(
      `Access denied: Role "${role || 'GUEST'}" does not have permission "${permission}".`
    );
  }
}

/**
 * Helper for API Route Handlers to validate request headers / sessions.
 */
export function validateRolePermission(
  role: UserRole | undefined | null,
  permission: Permission
): { authorized: boolean; error?: string } {
  if (!role || !hasPermission(role, permission)) {
    return {
      authorized: false,
      error: `Access denied: Role "${role || 'GUEST'}" is missing permission "${permission}".`,
    };
  }
  return { authorized: true };
}
