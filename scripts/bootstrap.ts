/**
 * Creates a working .env on a fresh clone.
 *
 * Copies .env.example and fills in real, randomly generated values for the two
 * secrets that must never ship as defaults. Anything already in .env is left
 * alone, so this is safe to re-run.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENV = path.join(ROOT, '.env');
const EXAMPLE = path.join(ROOT, '.env.example');

function secret(bytes = 48): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/** Replaces KEY="..." in place, preserving the surrounding comments. */
function setValue(contents: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}="${value}"`;
  return pattern.test(contents) ? contents.replace(pattern, line) : `${contents}\n${line}\n`;
}

function readValue(contents: string, key: string): string | null {
  const match = contents.match(new RegExp(`^${key}="?([^"\\n]*)"?$`, 'm'));
  return match?.[1] ?? null;
}

function main() {
  if (!fs.existsSync(EXAMPLE)) {
    console.error('[bootstrap] .env.example is missing — cannot generate .env.');
    process.exit(1);
  }

  const existed = fs.existsSync(ENV);
  let contents = existed ? fs.readFileSync(ENV, 'utf8') : fs.readFileSync(EXAMPLE, 'utf8');
  const generated: string[] = [];

  // A placeholder or missing secret gets a real one. An operator's own value
  // is never overwritten.
  const authSecret = readValue(contents, 'AUTH_SECRET');
  if (!authSecret || authSecret.startsWith('change-me') || authSecret.length < 32) {
    contents = setValue(contents, 'AUTH_SECRET', secret());
    generated.push('AUTH_SECRET');
  }

  const cronSecret = readValue(contents, 'CRON_SECRET');
  if (!cronSecret || cronSecret.startsWith('change-me')) {
    contents = setValue(contents, 'CRON_SECRET', secret(24));
    generated.push('CRON_SECRET');
  }

  fs.writeFileSync(ENV, contents);

  if (!existed) {
    console.log('[bootstrap] created .env from .env.example');
  }
  if (generated.length) {
    console.log(`[bootstrap] generated a random ${generated.join(' and ')}`);
  }
  if (existed && !generated.length) {
    console.log('[bootstrap] .env already looks good — nothing changed');
  }
}

main();
