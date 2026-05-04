import { PrismaClient } from '@prisma/client';

// Reuse a single PrismaClient instance across hot-reloads in dev so we don't
// exhaust the database connection pool.
declare global {
  // eslint-disable-next-line no-var
  var __ensemble_prisma__: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__ensemble_prisma__ ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ensemble_prisma__ = prisma;
}

export * from '@prisma/client';
