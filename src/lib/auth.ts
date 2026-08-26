import 'server-only';
import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { prisma } from './db';
import { ROLE_RANK, type Role } from './constants';

const COOKIE_NAME = 'icfo_session';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      'AUTH_SECRET is missing or shorter than 32 characters. Set it in .env — see .env.example.',
    );
  }
  return new TextEncoder().encode(value);
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(user: SessionUser): Promise<void> {
  const token = await new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/**
 * True when sign-in has been switched off with AUTH_DISABLED=true.
 *
 * For demos and testing only. Every visitor is treated as the owner, so a
 * publicly reachable deployment with this on is wide open to anyone holding
 * the link. It defaults to off and has to be turned on deliberately.
 */
export function authDisabled(): boolean {
  return process.env.AUTH_DISABLED === 'true';
}

/**
 * The identity everyone shares while AUTH_DISABLED is on: the existing owner
 * where there is one, otherwise any active user, otherwise a demo owner created
 * once so the app has someone to attribute work to.
 */
async function bypassUser(): Promise<SessionUser | null> {
  const existing =
    (await prisma.user.findFirst({
      where: { active: true, role: 'OWNER' },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true },
    })) ??
    (await prisma.user.findFirst({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true, email: true, name: true, role: true },
    }));

  if (existing) {
    return { id: existing.id, email: existing.email, name: existing.name, role: existing.role as Role };
  }

  // Empty database: create one owner so the app is usable, rather than failing
  // in a way that looks like the bypass itself is broken. The password hash is
  // random and never shown, so this account cannot be signed into once the
  // bypass is lifted — set a real password with `npm run set-password`.
  const created = await prisma.user.upsert({
    where: { email: 'demo@innovativecfo.local' },
    update: {},
    create: {
      email: 'demo@innovativecfo.local',
      name: 'Demo User',
      passwordHash: await hashPassword(crypto.randomBytes(32).toString('hex')),
      role: 'OWNER',
      jobTitle: 'Owner',
    },
    select: { id: true, email: true, name: true, role: true },
  });

  return { id: created.id, email: created.email, name: created.name, role: created.role as Role };
}

/** Returns the signed-in user, or null. Never throws. */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (authDisabled()) {
    try {
      return await bypassUser();
    } catch {
      return null;
    }
  }

  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;

    // Re-read the user so a deactivated account loses access immediately,
    // rather than at token expiry.
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, role: true, active: true },
    });
    if (!user || !user.active) return null;

    return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
  } catch {
    return null;
  }
}

/** Throws if not signed in. Use in server components and route handlers. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireRole(minimum: Role): Promise<SessionUser> {
  const user = await requireUser();
  if (ROLE_RANK[user.role] < ROLE_RANK[minimum]) throw new ForbiddenError();
  return user;
}

export function canManage(role: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK.MANAGER;
}

export class UnauthorizedError extends Error {
  status = 401;
  constructor() {
    super('Not signed in');
  }
}

export class ForbiddenError extends Error {
  status = 403;
  constructor() {
    super('You do not have permission to do that');
  }
}

/**
 * Page-level guard. Unlike requireUser() this redirects instead of throwing,
 * so an expired session lands on the login screen rather than an error page.
 */
export async function requirePageUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}
