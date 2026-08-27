import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth';
import { exchangeCodeForTokens, saveGoogleConnection } from '@/lib/google-calendar';
import { audit } from '@/lib/notify';
import { appUrl } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Constant-time compare, so a mismatched state cannot be probed by timing. */
function sameState(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Where Google returns after consent.
 *
 * Three things have to line up before any token is stored: the caller is signed
 * in, the state matches the cookie set when the flow started, and the user id
 * inside that state is the signed-in user. Any mismatch is treated as an attempt
 * to graft someone else's calendar onto this account and is refused.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const store = await cookies();
  const expected = store.get('google_oauth_state')?.value;
  store.delete('google_oauth_state');

  if (error) {
    // The usual one is access_denied — someone changed their mind at consent.
    return NextResponse.redirect(appUrl(`/settings?google=${encodeURIComponent(error)}`));
  }

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(appUrl('/login'));

  if (!code || !state || !expected || !sameState(state, expected)) {
    return NextResponse.redirect(appUrl('/settings?google=state-mismatch'));
  }

  // The state embeds the user it was issued to; it must be this one.
  if (state.split(':')[0] !== user.id) {
    return NextResponse.redirect(appUrl('/settings?google=state-mismatch'));
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    if (!tokens.refreshToken) {
      // Without a refresh token the connection dies in an hour. Google only
      // withholds it when a previous grant is still active, so revoking at
      // myaccount.google.com/permissions and reconnecting fixes it.
      const existing = await import('@/lib/google-calendar').then((m) =>
        m.googleConnectionFor(user.id),
      );
      if (!existing.connected) {
        return NextResponse.redirect(appUrl('/settings?google=no-refresh-token'));
      }
    }

    await saveGoogleConnection({ userId: user.id, ...tokens });

    await audit({
      userId: user.id,
      action: 'google.connected',
      entityType: 'User',
      entityId: user.id,
      meta: { email: tokens.email },
    });

    return NextResponse.redirect(appUrl('/settings?google=connected'));
  } catch (err) {
    console.error('[google] callback failed:', err);
    return NextResponse.redirect(appUrl('/settings?google=failed'));
  }
}
