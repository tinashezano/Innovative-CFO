/**
 * Resolves the database connection string.
 *
 * Hosts name this variable differently: Vercel's Postgres integrations inject
 * POSTGRES_PRISMA_URL and POSTGRES_URL, Neon and Supabase templates often set
 * POSTGRES_URL_NON_POOLING, and everything else uses DATABASE_URL. Attaching a
 * store and finding the app still cannot see a database is a confusing failure,
 * so accept any of them.
 *
 * DATABASE_URL wins when set, so an explicit value always overrides whatever an
 * integration injected. POSTGRES_PRISMA_URL comes next because it is the pooled
 * connection, which is what a serverless deployment wants.
 */
export const DATABASE_URL_VARS = [
  'DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL',
  'POSTGRES_URL_NON_POOLING',
] as const;

export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): {
  url: string | null;
  source: string | null;
} {
  for (const name of DATABASE_URL_VARS) {
    const value = env[name];
    if (value && value.trim()) return { url: value.trim(), source: name };
  }
  return { url: null, source: null };
}

/** sqlite | postgresql | null, derived from the URL scheme. */
export function providerForUrl(url: string | null | undefined): 'sqlite' | 'postgresql' | null {
  if (!url) return null;
  if (url.startsWith('file:')) return 'sqlite';
  if (
    url.startsWith('postgres://') ||
    url.startsWith('postgresql://') ||
    url.startsWith('prisma://') ||
    url.startsWith('prisma+postgres://')
  ) {
    return 'postgresql';
  }
  return null;
}

/**
 * Copies the resolved URL into DATABASE_URL so Prisma — which only reads that
 * one name — picks it up. Returns which variable it came from.
 */
export function applyDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const { url, source } = resolveDatabaseUrl(env);
  if (url && source && source !== 'DATABASE_URL') env.DATABASE_URL = url;
  return source;
}
