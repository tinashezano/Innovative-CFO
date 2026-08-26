import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { PageHeader } from '@/components/ui';
import { LeadsBoard } from './leads-board';
import { LeadsList } from './leads-list';
import { NewLeadButton } from './new-lead';
import { LEAD_BOARD_STAGES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; stage?: string; owner?: string; q?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const settings = await getSettings();
  const view = params.view === 'list' ? 'list' : 'board';

  const where = {
    ...(params.stage ? { stage: params.stage } : {}),
    ...(params.owner === 'me' ? { ownerId: user.id } : params.owner ? { ownerId: params.owner } : {}),
    ...(params.q
      ? {
          OR: [
            { companyName: { contains: params.q } },
            { contactName: { contains: params.q } },
            { email: { contains: params.q } },
            { reference: { contains: params.q } },
          ],
        }
      : {}),
  };

  const [leads, users] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, avatarColor: true } },
        bookings: {
          where: { status: 'CONFIRMED' },
          orderBy: { scheduledAt: 'asc' },
          take: 1,
        },
        proposals: { select: { id: true, status: true, total: true } },
      },
      orderBy: [{ stage: 'asc' }, { updatedAt: 'desc' }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const serialised = leads.map((lead) => ({
    id: lead.id,
    reference: lead.reference,
    companyName: lead.companyName,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone,
    stage: lead.stage,
    source: lead.source,
    serviceInterest: lead.serviceInterest,
    estimatedValue: lead.estimatedValue,
    currency: lead.currency,
    createdAt: lead.createdAt.toISOString(),
    owner: lead.owner,
    nextCall: lead.bookings[0]?.scheduledAt.toISOString() ?? null,
    proposalCount: lead.proposals.length,
  }));

  const total = serialised.reduce((sum, l) => sum + l.estimatedValue, 0);

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle={`${leads.length} lead${leads.length === 1 ? '' : 's'} · ${settings.defaultCurrency} ${total.toLocaleString('en-ZA')} estimated pipeline`}
        actions={
          <>
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="tablist">
              <ViewTab href="/leads?view=board" label="Board" active={view === 'board'} />
              <ViewTab href="/leads?view=list" label="List" active={view === 'list'} />
            </div>
            <NewLeadButton users={users} currentUserId={user.id} />
          </>
        }
      />

      {view === 'board' ? (
        <LeadsBoard leads={serialised} stages={[...LEAD_BOARD_STAGES]} />
      ) : (
        <LeadsList leads={serialised} />
      )}
    </>
  );
}

function ViewTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
        active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </Link>
  );
}
