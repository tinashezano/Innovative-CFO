/**
 * Points the Prisma datasource at whatever DATABASE_URL actually is.
 *
 * Runs as part of `npm run build`. Prisma rejects env() for a datasource
 * provider, so a repository has to commit one — which means a deployment
 * handed a Postgres URL against a SQLite schema fails at runtime on every
 * query, with nothing in the build output to explain it.
 *
 * This removes that trap: the provider is derived from the URL scheme at build
 * time, so the same commit deploys correctly to Postgres and runs locally on
 * SQLite. `npm run use:postgres` / `use:sqlite` still set it explicitly when
 * you want to work against one on purpose.
 */
import fs from 'node:fs';
import path from 'node:path';
import { providerForUrl, resolveDatabaseUrl } from '../src/lib/database-url';

const SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');

const { url, source } = resolveDatabaseUrl();
const target = providerForUrl(url);

if (!target) {
  // No URL, or a scheme we do not map: leave the committed schema alone.
  console.log('[datasource] no recognised database URL — leaving the schema as committed');
  process.exit(0);
}

if (source && source !== 'DATABASE_URL') {
  console.log(`[datasource] using ${source} (DATABASE_URL is not set)`);
}

const schema = fs.readFileSync(SCHEMA, 'utf8');
const current = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1];

if (current === target) {
  console.log(`[datasource] schema already targets ${target}`);
  process.exit(0);
}

fs.writeFileSync(SCHEMA, schema.replace(`provider = "${current}"`, `provider = "${target}"`));
console.log(`[datasource] DATABASE_URL is ${target} — switched the schema from ${current}`);
