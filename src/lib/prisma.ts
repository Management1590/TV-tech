import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

function getDatabaseConnectionString(): string | undefined {
  const g = globalThis as any;
  const hyperdrive = (process.env as any).HYPERDRIVE || g.HYPERDRIVE || g.__env?.HYPERDRIVE;
  if (hyperdrive && typeof hyperdrive === 'object' && hyperdrive.connectionString) {
    return hyperdrive.connectionString;
  }
  return process.env.DATABASE_URL;
}

function createPrismaClient(): PrismaClient {
  const connectionString = getDatabaseConnectionString();

  if (connectionString) {
    const pool = globalForPrisma.pool ?? new Pool({ connectionString });
    if (process.env.NODE_ENV !== 'production') globalForPrisma.pool = pool;
    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

