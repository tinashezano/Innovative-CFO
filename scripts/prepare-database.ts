/**
 * Creates the database tables.
 *
 * Runs from `npm start` — at container start, not build. That distinction is
 * the whole point: on hosts like Railway the database sits on a private network
 * the build container cannot reach, so a build-time `db push` fails and the app
 * deploys with no tables. By start-up the network is there. Also runs during
 * `npm run build`, which is harmless when it works (Vercel) and warns when it
 * cannot connect.
 *
 * Deliberately conservative:
 *  - No --accept-data-loss and no --force-reset, so Prisma refuses anything
 *    destructive rather than quietly dropping a column.
 *  - A failure warns rather than aborting, so the app still comes up and
 *    /api/health can explain what went wrong. Never leave the server unable to
 *    boot over this.
 *  - `db push` against an already-current database is a no-op, so running it on
 *    every start costs nothing.
 */
import { execFileSync } from 'node:child_process';
import { providerForUrl, resolveDatabaseUrl } from '../src/lib/database-url';

const phase = process.env.NEXT_PHASE === 'phase-production-build' ? 'build' : 'startup';
const { url, source } = resolveDatabaseUrl();

if (!url) {
  console.log('[database] no database URL — skipping table creation');
  process.exit(0);
}

// Every provider gets its tables, SQLite included. Treating a file: URL as
// "must be a developer's laptop" was wrong: hosts like Railway run SQLite on a
// container disk, and skipping there left a deployment with no tables at all.
// `db push` against an already-current database is a no-op, so running it here
// is safe locally too.
const provider = providerForUrl(url);
console.log(`[database] ensuring ${provider} tables exist (from ${source}, at ${phase})`);

try {
  execFileSync('npx', ['prisma', 'db', 'push', '--skip-generate'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
  console.log('[database] tables are in sync');
} catch {
  if (phase === 'build') {
    // Expected on hosts whose database is only reachable at runtime; the start
    // command will do it. Not worth alarming anyone reading build logs.
    console.warn('[database] could not reach the database during build — will retry at startup.');
  } else {
    console.warn('[database] could not sync the tables — the app will still start.');
    console.warn('[database] open /api/health on the deployment to see what is wrong.');
  }
}
