import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    nodeEnv: process.env.NODE_ENV,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasDirectUrl: !!process.env.DIRECT_URL,
    hasAdminPassword: !!process.env.ADMIN_PASSWORD,
  };

  try {
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    diagnostics.cloudflareContextAvailable = !!ctx;
    diagnostics.hyperdriveInContext = !!ctx?.env?.HYPERDRIVE;
    if (ctx?.env?.HYPERDRIVE?.connectionString) {
      diagnostics.hyperdriveConnectionString = ctx.env.HYPERDRIVE.connectionString.replace(/:[^:@]+@/, ':****@');
    }
  } catch (err: any) {
    diagnostics.cloudflareContextError = err?.message || String(err);
  }

  try {
    const folderCount = await prisma.folder.count();
    const itemCount = await prisma.item.count();
    diagnostics.databaseStatus = 'CONNECTED_SUCCESS';
    diagnostics.folderCount = folderCount;
    diagnostics.itemCount = itemCount;
  } catch (dbErr: any) {
    diagnostics.databaseStatus = 'CONNECTION_FAILED';
    diagnostics.databaseErrorName = dbErr?.name;
    diagnostics.databaseErrorMessage = dbErr?.message;
    diagnostics.databaseErrorStack = dbErr?.stack;
  }

  return NextResponse.json(diagnostics, { status: 200 });
}
