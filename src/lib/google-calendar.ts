import 'server-only';
import { prisma } from './db';
import { appUrl } from './utils';
import { decryptSecret, encryptSecret } from './secrets';

/**
 * Google Calendar for the discovery-call module.
 *
 * Connected per person: the lead's owner is whose calendar the call belongs in,
 * and whose free/busy decides which slots a prospect is offered.
 *
 * Talks to the REST API over fetch rather than pulling in `googleapis`, which
 * is tens of megabytes for the four calls we make. Same shape as the DocuSign
 * and Paystack adapters: without credentials it reports "not configured" and
 * the app carries on with its own bookings, exactly as it does today.
 *
 * Setup, in Google Cloud Console:
 *  1. Create a project, enable the Google Calendar API.
 *  2. Create an OAuth client (type: Web application).
 *  3. Add the redirect URI: <APP_URL>/api/google/callback
 *  4. Put the client id and secret in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET.
 *  5. While the consent screen is unverified, add each team member under
 *     "Test users" or they will be refused at the consent step.
 */

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';
const USERINFO = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * calendar.events to create and cancel the call.
 * calendar.readonly to read busy times — free/busy needs read access to the
 * calendar, and this is the narrowest scope that grants it.
 */
const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleRedirectUri(): string {
  return appUrl('/api/google/callback');
}

/**
 * Where to send someone to grant access.
 *
 * `access_type=offline` with `prompt=consent` is what makes Google return a
 * refresh token. Without both, a second connection returns only a short-lived
 * access token and the integration quietly stops working an hour later.
 */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: 'code',
    scope: SCOPES,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  error?: string;
  error_description?: string;
};

export async function exchangeCodeForTokens(code: string): Promise<{
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  email: string | null;
}> {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: googleRedirectUri(),
      grant_type: 'authorization_code',
    }),
  });

  const json = (await res.json()) as TokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(`Google token exchange failed: ${json.error_description ?? json.error ?? res.statusText}`);
  }

  let email: string | null = null;
  try {
    const me = await fetch(USERINFO, { headers: { Authorization: `Bearer ${json.access_token}` } });
    if (me.ok) email = ((await me.json()) as { email?: string }).email ?? null;
  } catch {
    // The address is only shown in Settings; not worth failing the connection.
  }

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt: new Date(Date.now() + json.expires_in * 1000),
    email,
  };
}

/**
 * Returns a valid access token for a user, refreshing it when it is close to
 * expiring. Returns null when the calendar is not connected, or when Google has
 * revoked the grant — callers treat that as "no calendar", not as an error.
 */
export async function accessTokenFor(userId: string): Promise<string | null> {
  if (!googleConfigured()) return null;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { googleAccessToken: true, googleRefreshToken: true, googleTokenExpiry: true },
  });
  if (!user?.googleRefreshToken) return null;

  // A minute of headroom, so a token cannot expire mid-request.
  const current = decryptSecret(user.googleAccessToken);
  if (current && user.googleTokenExpiry && user.googleTokenExpiry.getTime() - 60_000 > Date.now()) {
    return current;
  }

  const refreshToken = decryptSecret(user.googleRefreshToken);
  if (!refreshToken) return null;

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
    }),
  });

  const json = (await res.json()) as TokenResponse;

  if (!res.ok || !json.access_token) {
    // invalid_grant means the user revoked access or changed their password.
    // Clear the connection so the UI offers to reconnect instead of failing
    // silently on every booking.
    if (json.error === 'invalid_grant') {
      await disconnectGoogle(userId);
    }
    return null;
  }

  const expiresAt = new Date(Date.now() + json.expires_in * 1000);
  await prisma.user.update({
    where: { id: userId },
    data: { googleAccessToken: encryptSecret(json.access_token), googleTokenExpiry: expiresAt },
  });

  return json.access_token;
}

export async function saveGoogleConnection(input: {
  userId: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  email: string | null;
}): Promise<void> {
  await prisma.user.update({
    where: { id: input.userId },
    data: {
      googleAccessToken: encryptSecret(input.accessToken),
      // Google only returns a refresh token on first consent; keep the stored
      // one when a re-connection does not include a new one.
      ...(input.refreshToken ? { googleRefreshToken: encryptSecret(input.refreshToken) } : {}),
      googleTokenExpiry: input.expiresAt,
      googleEmail: input.email,
      googleConnectedAt: new Date(),
    },
  });
}

export async function disconnectGoogle(userId: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleEmail: null,
      googleConnectedAt: null,
    },
  });
}

export type BusyPeriod = { start: Date; end: Date };

/**
 * Times the person is already busy, straight from Google.
 *
 * Returns an empty list when no calendar is connected, so a booking page always
 * renders — a calendar outage must not take the booking link down with it.
 */
export async function busyPeriods(input: {
  userId: string;
  from: Date;
  to: Date;
}): Promise<BusyPeriod[]> {
  const token = await accessTokenFor(input.userId);
  if (!token) return [];

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { googleCalendarId: true },
  });

  try {
    const res = await fetch(`${CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin: input.from.toISOString(),
        timeMax: input.to.toISOString(),
        items: [{ id: user?.googleCalendarId || 'primary' }],
      }),
    });

    if (!res.ok) return [];

    const json = (await res.json()) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[] }>;
    };

    return Object.values(json.calendars ?? {})
      .flatMap((c) => c.busy ?? [])
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
  } catch {
    return [];
  }
}

/** True when [start, end) overlaps any busy period. Touching edges do not clash. */
export function overlapsBusy(start: Date, end: Date, busy: BusyPeriod[]): boolean {
  return busy.some((period) => start < period.end && end > period.start);
}

export type CreatedEvent = {
  eventId: string;
  calendarId: string;
  htmlLink: string | null;
  meetLink: string | null;
};

/**
 * Puts the call in the owner's calendar and invites the prospect.
 *
 * Returns null when no calendar is connected — the booking still stands, it
 * just lives only in this app. Never throws for a Google-side failure: losing
 * a calendar event is much better than losing the booking.
 */
export async function createCalendarEvent(input: {
  userId: string;
  summary: string;
  description: string;
  start: Date;
  durationMins: number;
  attendeeEmail: string;
  attendeeName?: string | null;
  timeZone?: string;
}): Promise<CreatedEvent | null> {
  const token = await accessTokenFor(input.userId);
  if (!token) return null;

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { googleCalendarId: true },
  });
  const calendarId = user?.googleCalendarId || 'primary';
  const end = new Date(input.start.getTime() + input.durationMins * 60_000);

  try {
    const res = await fetch(
      // conferenceDataVersion=1 is required for Google to mint the Meet link.
      `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: input.summary,
          description: input.description,
          start: { dateTime: input.start.toISOString(), timeZone: input.timeZone ?? 'Africa/Johannesburg' },
          end: { dateTime: end.toISOString(), timeZone: input.timeZone ?? 'Africa/Johannesburg' },
          attendees: [{ email: input.attendeeEmail, displayName: input.attendeeName ?? undefined }],
          conferenceData: {
            createRequest: {
              requestId: `icfo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
              conferenceSolutionKey: { type: 'hangoutsMeet' },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 10 },
            ],
          },
        }),
      },
    );

    if (!res.ok) {
      console.error('[google] could not create the calendar event:', await res.text());
      return null;
    }

    const json = (await res.json()) as {
      id: string;
      htmlLink?: string;
      hangoutLink?: string;
      conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
    };

    const meetLink =
      json.hangoutLink ??
      json.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
      null;

    return { eventId: json.id, calendarId, htmlLink: json.htmlLink ?? null, meetLink };
  } catch (err) {
    console.error('[google] calendar event creation threw:', err);
    return null;
  }
}

/** Cancels the event, notifying the attendee. Silent on failure by design. */
export async function cancelCalendarEvent(input: {
  userId: string;
  eventId: string;
  calendarId?: string | null;
}): Promise<boolean> {
  const token = await accessTokenFor(input.userId);
  if (!token) return false;

  try {
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId || 'primary')}/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    );
    // 410 means it is already gone, which is the outcome we wanted.
    return res.ok || res.status === 410;
  } catch {
    return false;
  }
}

/** Moves an existing event, notifying the attendee. */
export async function rescheduleCalendarEvent(input: {
  userId: string;
  eventId: string;
  calendarId?: string | null;
  start: Date;
  durationMins: number;
  timeZone?: string;
}): Promise<boolean> {
  const token = await accessTokenFor(input.userId);
  if (!token) return false;

  const end = new Date(input.start.getTime() + input.durationMins * 60_000);

  try {
    const res = await fetch(
      `${CALENDAR_API}/calendars/${encodeURIComponent(input.calendarId || 'primary')}/events/${encodeURIComponent(input.eventId)}?sendUpdates=all`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { dateTime: input.start.toISOString(), timeZone: input.timeZone ?? 'Africa/Johannesburg' },
          end: { dateTime: end.toISOString(), timeZone: input.timeZone ?? 'Africa/Johannesburg' },
        }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function googleConnectionFor(userId: string): Promise<{
  connected: boolean;
  email: string | null;
  connectedAt: Date | null;
  calendarId: string;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      googleRefreshToken: true,
      googleEmail: true,
      googleConnectedAt: true,
      googleCalendarId: true,
    },
  });

  return {
    connected: Boolean(user?.googleRefreshToken),
    email: user?.googleEmail ?? null,
    connectedAt: user?.googleConnectedAt ?? null,
    calendarId: user?.googleCalendarId || 'primary',
  };
}
