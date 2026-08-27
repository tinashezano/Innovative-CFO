import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { busyPeriods, overlapsBusy } from '@/lib/google-calendar';
import { addDays, startOfDay } from '@/lib/utils';
import { BookingPicker } from './booking-picker';

export const dynamic = 'force-dynamic';

/**
 * Public discovery-call booking page. Reached by token from the invite email —
 * no sign-in, and the token is the only thing that identifies the lead.
 */
export default async function PublicBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const settings = await getSettings();

  const lead = await prisma.lead.findUnique({
    where: { bookingToken: token },
    include: {
      owner: { select: { name: true, jobTitle: true, avatarColor: true } },
      bookings: { where: { status: 'CONFIRMED' }, orderBy: { scheduledAt: 'asc' } },
    },
  });

  if (!lead) notFound();

  const existing = lead.bookings[0];

  // Offer slots across the firm's working days, skipping anything already taken.
  const taken = new Set(
    (
      await prisma.discoveryBooking.findMany({
        where: { status: 'CONFIRMED', scheduledAt: { gte: new Date() } },
        select: { scheduledAt: true },
      })
    ).map((b) => b.scheduledAt.toISOString()),
  );

  const from = startOfDay(addDays(new Date(), 1));
  const horizon = addDays(from, 21);

  // Also hide anything the owner is already busy with in Google Calendar, so a
  // prospect cannot book over a meeting this app knows nothing about. Returns
  // empty when no calendar is connected, leaving behaviour exactly as before.
  const busy = lead.ownerId
    ? await busyPeriods({ userId: lead.ownerId, from, to: horizon })
    : [];

  const slots: { date: string; times: string[] }[] = [];

  for (let dayOffset = 0; dayOffset < 21 && slots.length < 10; dayOffset += 1) {
    const day = addDays(from, dayOffset);
    if (!settings.discoveryDays.includes(day.getDay())) continue;

    const times: string[] = [];
    for (
      let minutes = settings.discoveryStartHour * 60;
      minutes + settings.discoveryDurationMins <= settings.discoveryEndHour * 60;
      minutes += settings.discoverySlotMinutes
    ) {
      const slot = new Date(day);
      slot.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      if (slot <= new Date()) continue;
      if (taken.has(slot.toISOString())) continue;

      const slotEnd = new Date(slot.getTime() + settings.discoveryDurationMins * 60_000);
      if (overlapsBusy(slot, slotEnd, busy)) continue;

      times.push(slot.toISOString());
    }
    if (times.length) slots.push({ date: day.toISOString(), times });
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            IC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{settings.firmName}</h1>
          <p className="mt-1 text-sm text-slate-500">Discovery call · {settings.discoveryDurationMins} minutes</p>
        </header>

        <BookingPicker
          token={token}
          contactName={lead.contactName}
          companyName={lead.companyName}
          ownerName={lead.owner?.name ?? settings.firmName}
          ownerTitle={lead.owner?.jobTitle ?? null}
          durationMins={settings.discoveryDurationMins}
          slots={slots}
          existing={
            existing
              ? { scheduledAt: existing.scheduledAt.toISOString(), meetingLink: existing.meetingLink }
              : null
          }
        />

        <p className="mt-8 text-center text-xs text-slate-400">
          {settings.firmName} · {settings.firmEmail}
        </p>
      </div>
    </main>
  );
}
