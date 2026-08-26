import { PrismaClient } from '@prisma/client';
import { applyDatabaseUrl } from './database-url';

// Prisma reads DATABASE_URL and nothing else, so map whatever the host injected
// onto that name before the client is created.
applyDatabaseUrl();

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

/**
 * Atomically increments a named counter and returns a padded reference,
 * e.g. nextReference('lead', 'LD') -> "LD-0007".
 */
export async function nextReference(name: string, prefix: string, pad = 4): Promise<string> {
  const counter = await prisma.counter.upsert({
    where: { name },
    create: { name, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${String(counter.value).padStart(pad, '0')}`;
}
