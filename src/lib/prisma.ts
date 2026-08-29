import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
  currentConnStr: string | undefined;
};

function getDatabaseConnectionString(): string | undefined {
  try {
    // Attempt retrieving Hyperdrive binding from Cloudflare request context
    const { getCloudflareContext } = require('@opennextjs/cloudflare');
    const ctx = getCloudflareContext();
    if (ctx?.env?.HYPERDRIVE?.connectionString) {
      return ctx.env.HYPERDRIVE.connectionString;
    }
  } catch {
    // Not running inside Cloudflare request context or running locally
  }

  const g = globalThis as any;
  const hyperdrive = (process.env as any).HYPERDRIVE || g.HYPERDRIVE || g.__env?.HYPERDRIVE;
  if (hyperdrive && typeof hyperdrive === 'object' && hyperdrive.connectionString) {
    return hyperdrive.connectionString;
  }
  return process.env.DATABASE_URL;
}

function getOrCreatePrismaClient(): PrismaClient {
  const connectionString = getDatabaseConnectionString();

  if (globalForPrisma.prisma && globalForPrisma.currentConnStr === connectionString) {
    return globalForPrisma.prisma;
  }

  if (connectionString) {
    const pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
    const adapter = new PrismaPg(pool);
    const client = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    globalForPrisma.prisma = client;
    globalForPrisma.pool = pool;
    globalForPrisma.currentConnStr = connectionString;
    return client;
  }

  const defaultClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  globalForPrisma.prisma = defaultClient;
  return defaultClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop: string | symbol) {
    const client = getOrCreatePrismaClient();
    const val = (client as any)[prop];
    if (prop === '$transaction') {
      return (arg1: any, arg2?: any) => {
        if (typeof arg1 === 'function') {
          // Interactive transaction: automatically inject generous timeout for cloud database resilience
          const opts = { timeout: 35000, maxWait: 15000, ...(arg2 || {}) };
          return client.$transaction(arg1, opts);
        }
        return client.$transaction(arg1, arg2);
      };
    }
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  },
});


