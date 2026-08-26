/**
 * Diagnoses a local install that will not start.
 *
 *   npm run doctor
 *
 * Checks the things that actually go wrong — Node version, missing .env,
 * missing dependencies, an un-created database, a port already in use — and
 * prints the one command that fixes each.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = Number(process.env.PORT ?? 3000);

type Result = { ok: boolean; label: string; detail: string; fix?: string };
const results: Result[] = [];

function pass(label: string, detail: string) {
  results.push({ ok: true, label, detail });
}
function fail(label: string, detail: string, fix: string) {
  results.push({ ok: false, label, detail, fix });
}

function readEnvFile(): Record<string, string> | null {
  const file = path.join(ROOT, '.env');
  if (!fs.existsSync(file)) return null;
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
    if (match) out[match[1]!] = match[2]!;
  }
  return out;
}

function portInUse(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err: NodeJS.ErrnoException) => resolve(err.code === 'EADDRINUSE'));
    server.once('listening', () => server.close(() => resolve(false)));
    server.listen(port, '127.0.0.1');
  });
}

async function main() {
  // --- Node version ---
  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) {
    pass('Node', `v${process.versions.node}`);
  } else {
    fail(
      'Node',
      `v${process.versions.node} is too old — this app needs 20 or newer`,
      'Install Node 20+ from https://nodejs.org, then run npm install again',
    );
  }

  // --- Dependencies ---
  if (fs.existsSync(path.join(ROOT, 'node_modules', 'next'))) {
    pass('Dependencies', 'installed');
  } else {
    fail('Dependencies', 'node_modules is missing or incomplete', 'npm install');
  }

  // --- .env ---
  const env = readEnvFile();
  if (!env) {
    fail('.env', 'not found', 'npm run setup');
  } else {
    pass('.env', 'present');

    const authSecret = env.AUTH_SECRET ?? '';
    if (!authSecret || authSecret.startsWith('change-me') || authSecret.length < 32) {
      fail(
        'AUTH_SECRET',
        authSecret ? 'still a placeholder, or shorter than 32 characters' : 'not set',
        'npm run bootstrap',
      );
    } else {
      pass('AUTH_SECRET', 'set');
    }

    if (!env.DATABASE_URL) {
      fail('DATABASE_URL', 'not set', 'npm run setup');
    } else {
      pass('DATABASE_URL', env.DATABASE_URL.startsWith('file:') ? 'SQLite' : 'remote database');
    }

    const appUrl = env.APP_URL ?? '';
    if (appUrl.includes('localhost')) {
      pass('APP_URL', `${appUrl} — fine locally; set it to your real URL when you deploy`);
    } else if (appUrl) {
      pass('APP_URL', appUrl);
    } else {
      fail('APP_URL', 'not set — booking and proposal links will be wrong', 'npm run setup');
    }
  }

  // --- Prisma client ---
  if (fs.existsSync(path.join(ROOT, 'node_modules', '.prisma', 'client'))) {
    pass('Prisma client', 'generated');
  } else {
    fail('Prisma client', 'not generated', 'npx prisma generate');
  }

  // --- Database file (SQLite only) ---
  const url = env?.DATABASE_URL ?? '';
  if (url.startsWith('file:')) {
    const relative = url.replace(/^file:/, '');
    const dbPath = path.resolve(ROOT, 'prisma', relative);
    if (fs.existsSync(dbPath)) {
      const size = fs.statSync(dbPath).size;
      if (size > 0) pass('Database', `${path.relative(ROOT, dbPath)} (${Math.round(size / 1024)} KB)`);
      else fail('Database', 'the file exists but is empty', 'npx prisma db push && npm run db:seed');
    } else {
      fail('Database', 'not created yet', 'npm run setup');
    }
  }

  // --- Port ---
  if (await portInUse(PORT)) {
    fail(
      `Port ${PORT}`,
      'already in use by another process',
      `Stop whatever is on ${PORT}, or start on another port: npx next dev -p 3001`,
    );
  } else {
    pass(`Port ${PORT}`, 'free');
  }

  // --- Report ---
  const width = Math.max(...results.map((r) => r.label.length));
  console.log('');
  for (const r of results) {
    const mark = r.ok ? '✓' : '✗';
    console.log(`  ${mark} ${r.label.padEnd(width)}  ${r.detail}`);
  }

  const problems = results.filter((r) => !r.ok);
  console.log('');

  if (!problems.length) {
    console.log('  Everything checks out. Start the app with:');
    console.log('');
    console.log('      npm run dev');
    console.log('');
    console.log(`  Then open http://localhost:${PORT} and sign in as`);
    console.log('  admin@innovativecfo.co.za / ChangeMe123!');
    console.log('');
    return;
  }

  console.log(`  ${problems.length} thing${problems.length === 1 ? '' : 's'} to fix:`);
  console.log('');
  for (const p of problems) {
    console.log(`   ${p.label}: ${p.detail}`);
    console.log(`      → ${p.fix}`);
  }
  console.log('');
  process.exitCode = 1;
}

main();
