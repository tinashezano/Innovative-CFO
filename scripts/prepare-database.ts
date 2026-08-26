/**
 * Creates the database tables during deployment.
 *
 * Runs as part of `npm run build`. Without it, a fresh Postgres database has no
 * tables, every query fails, and the only symptom is a sign-in that will not
 * work — fixable solely by running Prisma from a laptop against the production
 * URL, which is a poor way to ship.
 *
 * Deliberately conservative:
 *  - Only runs against a remote database. Local SQLite is left to `npm run setup`.
 *  - No --accept-data-loss and no --force-reset, so Prisma refuses anything
 *    destructive rather than quietly dropping a column.
 *  - A failure warns instead of failing the build, so the deployment still comes
 *    up and /api/health can explain what went wrong.
 */
import { execFileSync } from 'node:child_process';
import { providerForUrl, resolveDatabaseUrl } from '../src/lib/database-url';

const { url, source } = resolveDatabaseUrl();

if (!url) {
  console.log('[database] no database URL — skipping table creation');
  process.exit(0);
}

if (providerForUrl(url) === 'sqlite') {
  console.log('[database] local SQLite — skipping (use npm run setup)');
  process.exit(0);
}

console.log(`[database] ensuring tables exist (from ${source})`);

try {
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  console.log('[database] tables are in sync');
} catch {
  console.warn('[database] could not sync the tables — the app will still deploy.');
  console.warn('[database] open /api/health on the deployment to see what is wrong.');
}
