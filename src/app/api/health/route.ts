import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { authDisabled } from '@/lib/auth';
import { DEMO_BYPASS_EMAIL, ensureBootstrapOwner } from '@/lib/bootstrap';
import { DATABASE_URL_VARS, resolveDatabaseUrl } from '@/lib/database-url';

export const dynamic = 'force-dynamic';

/**
 * Deployment diagnostics: open /api/health in a browser to see why the app is
 * not working before you can sign in.
 *
 * Deliberately reports only presence, shape and counts — never a secret value
 * or a connection string — so it is safe to hit on a public deployment.
 */
export async function GET() {
  const checks: { name: string; ok: boolean; detail: string; fix?: string }[] = [];

  // --- Sign-in bypass ---
  if (authDisabled()) {
    checks.push({
      name: 'Sign-in',
      ok: false,
      detail: 'SWITCHED OFF — anyone with this URL has full access as the owner',
      fix: 'Remove AUTH_DISABLED from your environment variables and redeploy once you are done testing.',
    });
  }

  // --- AUTH_SECRET ---
  const authSecret = process.env.AUTH_SECRET ?? '';
  if (authDisabled()) {
    // Sessions are not being signed while the bypass is on, so a missing
    // secret is not what is stopping anyone getting in.
    checks.push({
      name: 'AUTH_SECRET',
      ok: true,
      detail: authSecret ? `set (${authSecret.length} characters)` : 'not needed while sign-in is off',
    });
  } else if (!authSecret) {
    checks.push({
      name: 'AUTH_SECRET',
      ok: false,
      detail: 'not set — sign-in cannot sign a session cookie',
      fix: 'Add AUTH_SECRET (a long random string) to your environment variables and redeploy.',
    });
  } else if (authSecret.length < 32) {
    checks.push({
      name: 'AUTH_SECRET',
      ok: false,
      detail: `only ${authSecret.length} characters — needs at least 32`,
      fix: 'Replace AUTH_SECRET with a longer random string and redeploy.',
    });
  } else {
    checks.push({ name: 'AUTH_SECRET', ok: true, detail: `set (${authSecret.length} characters)` });
  }

  // --- Database URL, under whichever name the host injected it ---
  const resolved = resolveDatabaseUrl();
  const url = resolved.url ?? '';
  const scheme = url.split(':')[0] || '(none)';
  const via = resolved.source && resolved.source !== 'DATABASE_URL' ? ` (via ${resolved.source})` : '';
  if (!url) {
    checks.push({
      name: 'DATABASE_URL',
      ok: false,
      detail: `not set — looked for ${DATABASE_URL_VARS.join(', ')}`,
      fix: 'Add DATABASE_URL pointing at your database, or attach a Postgres store, then redeploy.',
    });
  } else if (url.startsWith('file:')) {
    // Fine locally. On a deployment the container disk is wiped on every
    // redeploy, so this silently loses every client, task and proposal —
    // report it as a problem rather than something merely worth knowing.
    const deployed = process.env.NODE_ENV === 'production';
    checks.push({
      name: 'DATABASE_URL',
      ok: !deployed,
      detail: deployed
        ? 'SQLite on the container disk — everything is erased on each redeploy'
        : 'SQLite (file-backed) — fine for local development',
      fix: deployed
        ? 'Add a Postgres database on your host and point DATABASE_URL at it, or mount a persistent volume.'
        : undefined,
    });
  } else {
    checks.push({ name: 'DATABASE_URL', ok: true, detail: `${scheme} connection configured${via}` });
  }

  // --- Can we actually reach the database, and are the tables there? ---
  let userCount: number | null = null;
  try {
    await ensureBootstrapOwner();
    userCount = await prisma.user.count();
    checks.push({ name: 'Database connection', ok: true, detail: 'reachable, schema present' });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const missingTables = /does not exist|no such table|relation .* does not exist/i.test(message);
    const providerMismatch = /provider|the URL must start with the protocol/i.test(message);

    checks.push({
      name: 'Database connection',
      ok: false,
      detail: missingTables
        ? 'reachable, but the tables have not been created'
        : providerMismatch
          ? 'the schema provider does not match DATABASE_URL'
          : `could not connect — ${message.split('\n')[0]?.slice(0, 160)}`,
      fix: missingTables
        ? 'Run: DATABASE_URL="<your url>" npx prisma db push'
        : providerMismatch
          ? 'Redeploy — the build now derives the provider from DATABASE_URL automatically.'
          : 'Check DATABASE_URL is correct and that the database accepts connections from your host.',
    });
  }

  // --- Are there any accounts, and which addresses do they use? ---
  if (userCount !== null) {
    // Listing the addresses is what turns "sign-in fails" into "I was typing
    // the wrong email". No password material is exposed.
    const accounts = await prisma.user.findMany({
      where: { active: true },
      select: { email: true, role: true },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    const usable = accounts.filter((a) => a.email !== DEMO_BYPASS_EMAIL);

    if (usable.length === 0) {
      checks.push({
        name: 'Accounts',
        ok: false,
        detail:
          accounts.length === 0
            ? 'no accounts yet — open the app and the setup screen will create one'
            : 'the only account is the AUTH_DISABLED demo user, which has no usable password',
        fix: 'Open / on this deployment to create an owner account, or set OWNER_EMAIL and OWNER_PASSWORD and redeploy.',
      });
    } else {
      checks.push({
        name: 'Accounts',
        ok: true,
        detail: `sign in as: ${usable.map((a) => `${a.email} (${a.role.toLowerCase()})`).join(', ')}`,
      });
    }
  }

  // --- Was an owner set from the environment? ---
  if (process.env.OWNER_EMAIL && process.env.OWNER_PASSWORD) {
    checks.push({
      name: 'OWNER_EMAIL',
      ok: true,
      detail: `${process.env.OWNER_EMAIL} — password re-applied from OWNER_PASSWORD on each deploy`,
    });
  }

  // --- APP_URL, which builds the links emailed to prospects ---
  const appUrl = process.env.APP_URL ?? '';
  if (!appUrl) {
    checks.push({
      name: 'APP_URL',
      ok: false,
      detail: 'not set — booking and proposal links will point at localhost',
      fix: 'Set APP_URL to this deployment’s address and redeploy.',
    });
  } else if (appUrl.includes('localhost')) {
    // Correct when you are running locally; a real problem once deployed,
    // because it is what builds the links emailed to prospects.
    const deployed = process.env.NODE_ENV === 'production';
    checks.push({
      name: 'APP_URL',
      ok: !deployed,
      detail: deployed
        ? `still ${appUrl} — booking and proposal links emailed to prospects will not work`
        : `${appUrl} — correct for local development`,
      fix: deployed ? 'Set APP_URL to this deployment’s address and redeploy.' : undefined,
    });
  } else {
    checks.push({ name: 'APP_URL', ok: true, detail: appUrl });
  }

  // --- Integration modes, so the demo/live state is never a surprise ---
  checks.push({
    name: 'Integrations',
    ok: true,
    detail: [
      `email ${process.env.EMAIL_MODE === 'smtp' ? 'live' : 'demo (logged, not sent)'}`,
      `DocuSign ${process.env.DOCUSIGN_MODE === 'live' ? 'live' : 'demo'}`,
      `Paystack ${process.env.PAYSTACK_MODE === 'live' ? 'live' : 'demo'}`,
    ].join(', '),
  });

  const problems = checks.filter((c) => !c.ok);
  const healthy = problems.length === 0;

  // The bypass is reported as a problem so it keeps nagging, but it is a
  // deliberate choice rather than a broken deployment — say so, and do not
  // return 503 for it alone.
  const bypassOnly = authDisabled() && problems.length === 1 && problems[0]?.name === 'Sign-in';

  return NextResponse.json(
    {
      status: healthy ? 'ok' : bypassOnly ? 'ok, but wide open' : 'needs attention',
      summary: healthy
        ? 'Everything checks out. You should be able to sign in.'
        : bypassOnly
          ? 'The app is working, but sign-in is switched off — anyone with this URL has full access.'
          : `${problems.length} thing${problems.length === 1 ? '' : 's'} to fix before the app will work.`,
      checks,
      nextSteps: problems.map((p) => p.fix).filter(Boolean),
    },
    { status: healthy || bypassOnly ? 200 : 503 },
  );
}
