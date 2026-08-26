import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from './db';

/**
 * The account AUTH_DISABLED falls back to on an empty database.
 *
 * Defined here rather than in ./auth so this module depends only on bcrypt and
 * Prisma. ./auth reaches into next/navigation, which cannot load outside a Next
 * runtime and would make this untestable on its own.
 */
export const DEMO_BYPASS_EMAIL = 'demo@innovativecfo.local';

/**
 * Creates or updates the owner account from environment variables.
 *
 * Set OWNER_EMAIL and OWNER_PASSWORD on the host and the account is guaranteed
 * to exist with that password on the next deploy. This is the reliable way in
 * on a platform where running Prisma against the production database by hand is
 * awkward — and the way back in if nobody knows the password any more.
 *
 * Idempotent, and re-applies the password on every boot, so changing the
 * variable and redeploying is a working password reset.
 *
 * Treat OWNER_PASSWORD as a bootstrap credential: it sits in your host's
 * environment in plain text, so remove it (or change the password in the app)
 * once you are in.
 */

let attempted = false;

export async function ensureBootstrapOwner(): Promise<
  { applied: false } | { applied: true; email: string; created: boolean }
> {
  // Once per process is enough — this runs on page loads, not just at startup.
  if (attempted) return { applied: false };
  attempted = true;

  const email = process.env.OWNER_EMAIL?.toLowerCase().trim();
  const password = process.env.OWNER_PASSWORD;

  if (!email || !password) return { applied: false };

  if (password.length < 8) {
    console.warn('[bootstrap] OWNER_PASSWORD is shorter than 8 characters — ignoring it');
    return { applied: false };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.upsert({
      where: { email },
      // Re-apply the password and make sure the account can actually be used:
      // a deactivated or demoted owner would otherwise stay locked out.
      update: { passwordHash, role: 'OWNER', active: true },
      create: {
        email,
        name: process.env.OWNER_NAME?.trim() || 'Owner',
        passwordHash,
        role: 'OWNER',
        jobTitle: 'Owner',
      },
    });

    console.log(
      `[bootstrap] ${existing ? 'updated' : 'created'} owner ${email} from OWNER_EMAIL/OWNER_PASSWORD`,
    );
    return { applied: true, email, created: !existing };
  } catch (err) {
    console.error('[bootstrap] could not apply OWNER_EMAIL/OWNER_PASSWORD:', err);
    return { applied: false };
  }
}

/**
 * Accounts a person could actually sign in as.
 *
 * Excludes the AUTH_DISABLED bypass account, whose password hash is random by
 * design. Counting it would make the app look set up while leaving nobody able
 * to get in — and would hide the first-run setup screen that is the way out.
 */
export async function usableAccountCount(): Promise<number> {
  return prisma.user.count({
    where: { active: true, email: { not: DEMO_BYPASS_EMAIL } },
  });
}
