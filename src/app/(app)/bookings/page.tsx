import Link from 'next/link';
import { CalendarClock, Video } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { formatDateTime, startOfDay } from '@/lib/utils';
import { EmptyState, LeadStageBadge, PageHeader, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function BookingsPage() {
  await requirePageUser();

  const now = new Date();
  const today = startOfDay(now);

  const bookings = await prisma.discoveryBooking.findMany({
    include: {
      lead: {
        select: {
          id: true,
          companyName: true,
          contactName: true,
          email: true,
          phone: true,
          stage: true,
          owner: { select: { name: true } },
        },
      },
    },
    orderBy: { scheduledAt: 'desc' },
    take: 100,
  });

  const upcoming = bookings.filter((b) => b.status === 'CONFIRMED' && b.scheduledAt >= now);
  const awaitingOutcome = bookings.filter((b) => b.status === 'CONFIRMED' && b.scheduledAt < now);
  const past = bookings.filter((b) => b.status !== 'CONFIRMED');

  const thisWeek = upcoming.filter(
    (b) => b.scheduledAt <= new Date(today.getTime() + 7 * 86400000),
  ).length;

  const proceeded = past.filter((b) => b.outcome === 'PROCEED').length;
  const withOutcome = past.filter((b) => b.outcome).length;

  return (
    <>
      <PageHeader
        title="Discovery calls"
        subtitle="Every call booked through the public link or captured by the team."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Upcoming" value={upcoming.length} hint={`${thisWeek} in the next 7 days`} />
        <StatCard
          label="Awaiting an outcome"
          value={awaitingOutcome.length}
          tone={awaitingOutcome.length ? 'warning' : 'default'}
          hint={awaitingOutcome.length ? 'Log these to move the pipeline' : 'Nothing outstanding'}
        />
        <StatCard label="Completed" value={past.length} />
        <StatCard
          label="Progressed to proposal"
          value={withOutcome ? `${Math.round((proceeded / withOutcome) * 100)}%` : '—'}
          hint={withOutcome ? `${proceeded} of ${withOutcome} calls` : 'No outcomes logged yet'}
          tone="positive"
        />
      </div>

      {awaitingOutcome.length ? (
        <Section title="Awaiting an outcome" tone="warning">
          {awaitingOutcome.map((booking) => (
            <BookingRow key={booking.id} booking={booking} needsOutcome />
          ))}
        </Section>
      ) : null}

      {upcoming.length ? (
        <Section title="Upcoming">
          {upcoming.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </Section>
      ) : null}

      {past.length ? (
        <Section title="Completed">
          {past.map((booking) => (
            <BookingRow key={booking.id} booking={booking} />
          ))}
        </Section>
      ) : null}

      {!bookings.length ? (
        <EmptyState
          title="No discovery calls yet"
          description="Send a lead their booking link and confirmed slots appear here."
          action={
            <Link href="/leads" className="btn-primary">
              Go to leads
            </Link>
          }
        />
      ) : null}
    </>
  );
}

function Section({
  title,
  tone,
  children,
}: {
  title: string;
  tone?: 'warning';
  children: React.ReactNode;
}) {
  return (
    <section className="card mb-6 overflow-hidden">
      <div
        className={`border-b px-5 py-3.5 ${tone === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}
      >
        <h2 className={`text-sm font-semibold ${tone === 'warning' ? 'text-amber-900' : 'text-slate-900'}`}>
          {title}
        </h2>
      </div>
      <ul className="divide-y divide-slate-100">{children}</ul>
    </section>
  );
}

function BookingRow({
  booking,
  needsOutcome,
}: {
  booking: {
    id: string;
    scheduledAt: Date;
    durationMins: number;
    status: string;
    outcome: string | null;
    outcomeNotes: string | null;
    meetingLink: string | null;
    agenda: string | null;
    lead: {
      id: string;
      companyName: string;
      contactName: string;
      email: string;
      phone: string | null;
      stage: string;
      owner: { name: string } | null;
    };
  };
  needsOutcome?: boolean;
}) {
  return (
    <li className="px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/leads/${booking.lead.id}`} className="font-semibold text-slate-900 hover:text-brand-700">
              {booking.lead.companyName}
            </Link>
            <LeadStageBadge stage={booking.lead.stage} />
            {booking.outcome ? (
              <span
                className={`badge ${
                  booking.outcome === 'PROCEED'
                    ? 'bg-emerald-100 text-emerald-800'
                    : booking.outcome === 'NOT_A_FIT'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-slate-100 text-slate-600'
                }`}
              >
                {booking.outcome.toLowerCase().replace(/_/g, ' ')}
              </span>
            ) : null}
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="h-3 w-3" aria-hidden />
              {formatDateTime(booking.scheduledAt)}
            </span>
            <span aria-hidden>·</span>
            <span>{booking.durationMins} min</span>
            <span aria-hidden>·</span>
            <span>{booking.lead.contactName}</span>
            {booking.lead.owner ? (
              <>
                <span aria-hidden>·</span>
                <span>with {booking.lead.owner.name}</span>
              </>
            ) : null}
          </p>

          {booking.agenda ? <p className="mt-2 text-sm text-slate-600">{booking.agenda}</p> : null}
          {booking.outcomeNotes ? (
            <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{booking.outcomeNotes}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {booking.meetingLink ? (
            <a href={booking.meetingLink} target="_blank" rel="noreferrer" className="btn-secondary btn-sm">
              <Video className="h-3.5 w-3.5" aria-hidden />
              Join
            </a>
          ) : null}
          <Link
            href={`/leads/${booking.lead.id}`}
            className={needsOutcome ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
          >
            {needsOutcome ? 'Log the outcome' : 'Open lead'}
          </Link>
        </div>
      </div>
    </li>
  );
}
