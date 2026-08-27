import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireUser } from '@/lib/auth';
import { googleAuthUrl, googleConfigured } from '@/lib/google-calendar';
import { appUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Starts the Google Calendar connection for the signed-in user.
 *
 * The `state` parameter carries a random nonce that is also written to a
 * short-lived httpOnly cookie. The callback refuses anything whose state does
 * not match, which is what stops someone else's authorization code being
 * planted into this user's account.
 */
export async function GET() {
  const user = await requireUser();

  if (!googleConfigured()) {
    return NextResponse.redirect(appUrl('/settings?google=not-configured'));
  }

  const nonce = crypto.randomBytes(24).toString('base64url');
  const state = `${user.id}:${nonce}`;

  const store = await cookies();
  store.set('google_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600, // ten minutes is ample for a consent screen
  });

  return NextResponse.redirect(googleAuthUrl(state));
}
