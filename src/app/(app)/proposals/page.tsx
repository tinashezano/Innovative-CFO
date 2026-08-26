import Link from 'next/link';
import { Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/utils';
import { EmptyState, PageHeader, ProposalStatusBadge, StatCard } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default async function ProposalsPage() {
  await requirePageUser();

  const proposals = await prisma.proposal.findMany({
    include: {
      lead: { select: { id: true, companyName: true, contactName: true } },
      client: { select: { id: true, name: true } },
      payments: { select: { status: true, amount: true } },
      envelopes: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const awaiting = proposals.filter((p) => ['SENT', 'VIEWED'].includes(p.status));
  const signedNotPaid = proposals.filter((p) => p.status === 'SIGNED');
  const won = proposals.filter((p) => p.status === 'PAID');
  const wonValue = won.reduce((sum, p) => sum + p.total, 0);

  // Win rate over decided proposals only — drafts and open ones tell us nothing.
  const decided = proposals.filter((p) =>
    ['PAID', 'DECLINED', 'EXPIRED'].includes(p.status),
  ).length;
  const winRate = decided ? Math.round((won.length / decided) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Proposals"
        subtitle="Every proposal, from draft to signed and paid."
        actions={
          <Link href="/proposals/new" className="btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            New proposal
          </Link>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Awaiting decision" value={awaiting.length} hint={`${formatMoney(awaiting.reduce((s, p) => s + p.total, 0))} in play`} />
        <StatCard
          label="Signed, not yet paid"
          value={signedNotPaid.length}
          tone={signedNotPaid.length ? 'warning' : 'default'}
          hint={signedNotPaid.length ? 'Chase the payment link' : 'Nothing outstanding'}
        />
        <StatCard label="Won" value={won.length} hint={formatMoney(wonValue)} tone="positive" />
        <StatCard label="Win rate" value={`${winRate}%`} hint={`${decided} decided`} />
      </div>

      {proposals.length ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="th">Proposal</th>
                  <th className="th">For</th>
                  <th className="th">Status</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Sent</th>
                  <th className="th">Signature</th>
                  <th className="th">Payment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proposals.map((proposal) => {
                  const signature = proposal.envelopes[0]?.status;
                  const payment = proposal.payments.find((p) => p.status === 'SUCCESS')
                    ? 'Paid'
                    : proposal.payments.length
                      ? 'Pending'
                      : '—';
                  return (
                    <tr key={proposal.id} className="transition hover:bg-slate-50">
                      <td className="td">
                        <Link
                          href={`/proposals/${proposal.id}`}
                          className="font-semibold text-slate-900 hover:text-brand-700"
                        >
                          {proposal.title}
                        </Link>
                        <div className="text-xs text-slate-400">{proposal.number}</div>
                      </td>
                      <td className="td">
                        {proposal.lead ? (
                          <Link href={`/leads/${proposal.lead.id}`} className="link text-sm">
                            {proposal.lead.companyName}
                          </Link>
                        ) : proposal.client ? (
                          <Link href={`/clients/${proposal.client.id}`} className="link text-sm">
                            {proposal.client.name}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="td">
                        <ProposalStatusBadge status={proposal.status} />
                      </td>
                      <td className="td text-right font-medium">
                        {formatMoney(proposal.total, proposal.currency)}
                      </td>
                      <td className="td text-xs text-slate-500">{formatDate(proposal.sentAt)}</td>
                      <td className="td text-xs capitalize text-slate-500">
                        {signature ? signature.toLowerCase() : '—'}
                      </td>
                      <td className="td text-xs text-slate-500">{payment}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No proposals yet"
          description="Run a discovery call, then build a proposal from the lead."
          action={
            <Link href="/proposals/new" className="btn-primary">
              New proposal
            </Link>
          }
        />
      )}
    </>
  );
}
