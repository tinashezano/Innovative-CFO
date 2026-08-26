import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { appUrl, formatDate, formatMoney } from '@/lib/utils';
import { Avatar, LeadStageBadge, PageHeader, ProposalStatusBadge } from '@/components/ui';
import { LeadStageControl } from './stage-control';
import { BookingPanel } from './booking-panel';
import { ActivityFeed } from './activity-feed';
import { CopyLink } from '@/components/copy-link';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      owner: true,
      client: true,
      activities: { include: { user: true }, orderBy: { createdAt: 'desc' } },
      bookings: { orderBy: { scheduledAt: 'desc' } },
      proposals: { orderBy: { createdAt: 'desc' } },
      tasks: {
        where: { parentId: null, archivedAt: null },
        include: { assignee: true },
        orderBy: { dueDate: 'asc' },
      },
    },
  });

  if (!lead) notFound();

  const bookingUrl = appUrl(`/book/${lead.bookingToken}`);
  const openBooking = lead.bookings.find((b) => b.status === 'CONFIRMED');

  return (
    <>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to leads
      </Link>

      <PageHeader
        title={lead.companyName}
        subtitle={`${lead.reference} · created ${formatDate(lead.createdAt)}`}
        actions={<LeadStageControl leadId={lead.id} stage={lead.stage} hasProposal={lead.proposals.length > 0} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Discovery call */}
          <BookingPanel
            leadId={lead.id}
            bookings={lead.bookings.map((b) => ({
              id: b.id,
              scheduledAt: b.scheduledAt.toISOString(),
              durationMins: b.durationMins,
              status: b.status,
              outcome: b.outcome,
              outcomeNotes: b.outcomeNotes,
              meetingLink: b.meetingLink,
              agenda: b.agenda,
            }))}
            bookingUrl={bookingUrl}
            hasOpenBooking={Boolean(openBooking)}
          />

          {/* Proposals */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Proposals</h2>
              <Link href={`/proposals/new?leadId=${lead.id}`} className="btn-secondary btn-sm">
                New proposal
              </Link>
            </div>
            {lead.proposals.length ? (
              <ul className="divide-y divide-slate-100">
                {lead.proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <Link
                      href={`/proposals/${proposal.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{proposal.title}</p>
                        <p className="text-xs text-slate-500">
                          {proposal.number} · {formatMoney(proposal.total, proposal.currency)}
                        </p>
                      </div>
                      <ProposalStatusBadge status={proposal.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No proposal yet. Run the discovery call, then build one.
              </p>
            )}
          </section>

          {/* Activity */}
          <ActivityFeed
            leadId={lead.id}
            activities={lead.activities.map((a) => ({
              id: a.id,
              type: a.type,
              body: a.body,
              createdAt: a.createdAt.toISOString(),
              userName: a.user?.name ?? null,
            }))}
          />
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <section className="card card-pad">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Contact</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Name</dt>
                <dd className="font-medium text-slate-900">{lead.contactName}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Email</dt>
                <dd>
                  <a href={`mailto:${lead.email}`} className="link inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    {lead.email}
                  </a>
                </dd>
              </div>
              {lead.phone ? (
                <div>
                  <dt className="text-xs text-slate-500">Phone</dt>
                  <dd>
                    <a href={`tel:${lead.phone}`} className="link inline-flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      {lead.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Details</h2>
            <dl className="space-y-3 text-sm">
              <Row label="Stage">
                <LeadStageBadge stage={lead.stage} />
              </Row>
              <Row label="Estimated value">
                <span className="font-semibold">{formatMoney(lead.estimatedValue, lead.currency)}</span>
              </Row>
              <Row label="Source">
                <span className="capitalize">{lead.source.toLowerCase().replace(/_/g, ' ')}</span>
              </Row>
              {lead.serviceInterest ? <Row label="Interested in">{lead.serviceInterest}</Row> : null}
              <Row label="Owner">
                {lead.owner ? (
                  <span className="inline-flex items-center gap-2">
                    <Avatar name={lead.owner.name} color={lead.owner.avatarColor} size="sm" />
                    {lead.owner.name}
                  </span>
                ) : (
                  <span className="text-amber-600">Unassigned</span>
                )}
              </Row>
              {lead.lostReason ? <Row label="Lost because">{lead.lostReason}</Row> : null}
              {lead.client ? (
                <Row label="Client">
                  <Link href={`/clients/${lead.client.id}`} className="link">
                    {lead.client.name}
                  </Link>
                </Row>
              ) : null}
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Booking link</h2>
            <p className="mb-3 text-xs text-slate-500">
              Share this to let {lead.contactName.split(' ')[0]} pick a discovery slot. A confirmed booking
              raises the call task automatically.
            </p>
            <CopyLink url={bookingUrl} />
          </section>

          {lead.notes ? (
            <section className="card card-pad">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Notes</h2>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{lead.notes}</p>
            </section>
          ) : null}

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Linked tasks</h2>
            </div>
            {lead.tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {lead.tasks.map((task) => (
                  <li key={task.id}>
                    <Link href={`/tasks/${task.id}`} className="block px-5 py-3 transition hover:bg-slate-50">
                      <p className="text-sm text-slate-900">{task.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {task.status.replace(/_/g, ' ').toLowerCase()}
                        {task.dueDate ? ` · due ${formatDate(task.dueDate)}` : ''}
                        {task.assignee ? ` · ${task.assignee.name}` : ''}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No tasks linked yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}
