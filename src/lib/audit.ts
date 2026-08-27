// ============================================================
// TV Tech OS — Universal Audit Logging Helper
// ============================================================
// Captures mandatory application actions (CREATE, UPDATE, DELETE, LINK,
// UNLINK, MOVE, RENAME, GENERATE_CODE) into the audit_logs table.

import { prisma } from '@/lib/prisma';
import { AuditAction } from '@prisma/client';

export interface RecordAuditLogInput {
  userId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  changes?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  try {
    // 1. Insert new audit log entry
    await prisma.auditLog.create({
      data: {
        userId: input.userId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        changes: input.changes ? (input.changes as any) : undefined,
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
      },
    });

    // 2. Automatically maintain a strict 10-entry rolling cap in Supabase
    const latestLogs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true },
    });

    if (latestLogs.length > 0) {
      const keepIds = latestLogs.map((log) => log.id);
      await prisma.auditLog.deleteMany({
        where: {
          id: { notIn: keepIds },
        },
      });
    }
  } catch (error) {
    console.error('[AUDIT LOG ERROR] Failed to record audit entry:', error);
    // Non-blocking for primary user operations
  }
}
