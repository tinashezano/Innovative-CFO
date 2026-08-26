import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/auth';
import type { Role } from '@/lib/constants';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    return await signIn(request);
  } catch (err) {
    // A misconfigured deployment (no AUTH_SECRET, unreachable database) would
    // otherwise return an HTML error page, which the sign-in form can only
    // report as a generic failure. Answer in JSON and point at the diagnosis.
    console.error('[auth] sign-in failed:', err);
    return NextResponse.json(
      {
        error:
          'The server is not configured correctly, so sign-in cannot run. Open /api/health for details.',
      },
      { status: 500 },
    );
  }
}

async function signIn(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter an email address and password' }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase().trim() },
  });

  // Same message and roughly the same work either way, so the response does not
  // reveal whether an address is registered.
  const ok = user?.active ? await verifyPassword(parsed.data.password, user.passwordHash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: 'Those details do not match an account' }, { status: 401 });
  }

  await createSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  return NextResponse.json({ ok: true });
}
