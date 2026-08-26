import path from 'node:path';
import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Replaces the deprecated `prisma` key in package.json (removed in Prisma 7).
//
// A Prisma config file turns off the CLI's own .env loading, so dotenv is
// imported above to keep DATABASE_URL available to `prisma db push` etc.
//
// --conditions=react-server resolves the `server-only` marker package to its
// empty build, which the seed's shared modules need outside Next's runtime.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    seed: 'tsx --conditions=react-server prisma/seed.ts',
  },
});
