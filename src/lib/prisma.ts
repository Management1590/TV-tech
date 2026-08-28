import { PrismaClient } from '@prisma/client/wasm';
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

function resetClient() {
  if (globalForPrisma.pool) {
    try {
      globalForPrisma.pool.end().catch(() => {});
    } catch {}
  }
  globalForPrisma.prisma = undefined;
  globalForPrisma.pool = undefined;
  globalForPrisma.currentConnStr = undefined;
}

function createFreshPrismaClient(connectionString: string): PrismaClient {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 1000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    console.warn('[PostgreSQL Pool Warning]:', err?.message);
    if (err?.message?.includes('closed') || err?.message?.includes('terminat')) {
      resetClient();
    }
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

function getOrCreatePrismaClient(): PrismaClient {
  const connectionString = getDatabaseConnectionString();

  if (globalForPrisma.prisma && globalForPrisma.currentConnStr === connectionString) {
    return globalForPrisma.prisma;
  }

  if (connectionString) {
    return createFreshPrismaClient(connectionString);
  }

  const defaultClient = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
  globalForPrisma.prisma = defaultClient;
  return defaultClient;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, modelOrProp: string | symbol) {
    const client = getOrCreatePrismaClient();
    const modelObj = (client as any)[modelOrProp];

    if (typeof modelObj === 'object' && modelObj !== null) {
      // Transparently retry on stale Hyperdrive connection drops
      return new Proxy(modelObj, {
        get(modelTarget, action: string | symbol) {
          const originalFn = (modelTarget as any)[action];
          if (typeof originalFn === 'function') {
            return async function (...args: any[]) {
              try {
                return await originalFn.apply(modelTarget, args);
              } catch (err: any) {
                const msg = err?.message || String(err);
                if (
                  msg.includes('closed') ||
                  msg.includes('terminat') ||
                  msg.includes('Connection closed') ||
                  msg.includes('ECONNRESET') ||
                  msg.includes('Connection terminated')
                ) {
                  console.warn('[Prisma Auto-Reconnect on Idle Drop]:', msg);
                  resetClient();
                  const freshClient = getOrCreatePrismaClient();
                  const freshModel = (freshClient as any)[modelOrProp];
                  return await freshModel[action](...args);
                }
                throw err;
              }
            };
          }
          return originalFn;
        },
      });
    }

    if (typeof modelObj === 'function') {
      return modelObj.bind(client);
    }
    return modelObj;
  },
});


