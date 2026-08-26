/**
 * Switches the Prisma datasource between SQLite and Postgres.
 *
 *   npm run use:sqlite     -> file-backed, zero infrastructure (the default)
 *   npm run use:postgres   -> for any deployment where the filesystem is not durable
 *
 * Prisma does not accept env() for a datasource provider, so the schema line
 * has to be rewritten. No model changes are needed either way: every status
 * field is a String backed by a TypeScript union rather than a Prisma enum.
 */
import fs from 'node:fs';
import path from 'node:path';

const SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');
const target = process.argv[2];

if (target !== 'sqlite' && target !== 'postgresql') {
  console.error('Usage: tsx scripts/use-database.ts <sqlite|postgresql>');
  process.exit(1);
}

const schema = fs.readFileSync(SCHEMA, 'utf8');
const current = schema.match(/provider\s*=\s*"(sqlite|postgresql)"/)?.[1];

if (!current) {
  console.error('[db] could not find the datasource provider in prisma/schema.prisma');
  process.exit(1);
}

if (current === target) {
  console.log(`[db] already using ${target}`);
  process.exit(0);
}

fs.writeFileSync(SCHEMA, schema.replace(`provider = "${current}"`, `provider = "${target}"`));
console.log(`[db] switched the datasource from ${current} to ${target}`);

if (target === 'postgresql') {
  console.log('[db] point DATABASE_URL at your Postgres instance, for example:');
  console.log('       DATABASE_URL="postgresql://user:password@host:5432/innovative_cfo?schema=public"');
  console.log('[db] then run: npx prisma db push');
} else {
  console.log('[db] set DATABASE_URL="file:./dev.db", then run: npx prisma db push');
}
