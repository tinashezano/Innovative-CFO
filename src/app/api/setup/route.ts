import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, hashPassword } from '@/lib/auth';
import { nextReference } from '@/lib/db';

const schema = z.object({
  name: z.string().min(1, 'Enter your name'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(10, 'Use at least 10 characters'),
  firmName: z.string().min(1).optional(),
});

/**
 * Creates the first owner account on a fresh deployment.
 *
 * Only reachable while the database has no users at all — the check runs inside
 * a transaction that re-counts before inserting, so two simultaneous requests
 * cannot both succeed. Once an account exists this route is permanently closed,
 * which is what stops it becoming an open door onto a live system.
 */
export async function POST(request: Request) {
  try {
    const existing = await prisma.user.count();
    if (existing > 0) {
      return NextResponse.json(
        { error: 'This app is already set up. Sign in instead.' },
        { status: 403 },
      );
    }

    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0];
      return NextResponse.json({ error: first ?? 'Check the details you entered' }, { status: 422 });
    }

    const { name, email, password, firmName } = parsed.data;
    const passwordHash = await hashPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so a concurrent request cannot slip a
      // second owner in behind the first.
      if ((await tx.user.count()) > 0) throw new Error('ALREADY_SET_UP');

      return tx.user.create({
        data: {
          name,
          email: email.toLowerCase().trim(),
          passwordHash,
          role: 'OWNER',
          jobTitle: 'Owner',
        },
        select: { id: true, email: true, name: true, role: true },
      });
    });

    if (firmName?.trim()) {
      const { saveSettings } = await import('@/lib/settings');
      await saveSettings({ firmName: firmName.trim() });
    }

    await prisma.auditLog.create({
      data: { userId: user.id, action: 'app.setup', entityType: 'User', entityId: user.id },
    });

    await createSession({ id: user.id, email: user.email, name: user.name, role: 'OWNER' });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_SET_UP') {
      return NextResponse.json({ error: 'This app is already set up. Sign in instead.' }, { status: 403 });
    }
    console.error('[setup] failed:', err);
    return NextResponse.json(
      {
        error:
          'Could not create the account — the database may not be reachable. Open /api/health for details.',
      },
      { status: 500 },
    );
  }
}

/** Tells the setup page whether it should still be showing. */
export async function GET() {
  try {
    const count = await prisma.user.count();
    return NextResponse.json({ needsSetup: count === 0, users: count });
  } catch {
    return NextResponse.json({ needsSetup: false, error: 'database unreachable' }, { status: 503 });
  }
}
