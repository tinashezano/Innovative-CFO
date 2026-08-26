import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { appUrl, formatDate, formatDateTime, formatMoney } from '@/lib/utils';
import { PageHeader, ProposalStatusBadge } from '@/components/ui';
import { CopyLink } from '@/components/copy-link';
import { ProposalActions } from './proposal-actions';
import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function ProposalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      lead: { include: { owner: true } },
      client: true,
      createdBy: true,
      envelopes: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!proposal) notFound();

  const publicUrl = appUrl(`/p/${proposal.publicToken}`);
  const envelope = proposal.envelopes[0];
  const payment = proposal.payments[0];

  const timeline = [
    { label: 'Created', at: proposal.createdAt },
    { label: 'Sent', at: proposal.sentAt },
    { label: 'Opened by the client', at: proposal.viewedAt },
    { label: 'Accepted', at: proposal.acceptedAt },
    { label: 'Engagement letter signed', at: proposal.signedAt },
    { label: 'Paid', at: proposal.paidAt },
    { label: 'Declined', at: proposal.declinedAt },
  ].filter((entry) => entry.at);

  return (
    <>
      <Link href="/proposals" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to proposals
      </Link>

      <PageHeader
        title={proposal.title}
        subtitle={`${proposal.number} · ${formatMoney(proposal.total, proposal.currency)}`}
        actions={
          <ProposalActions
            proposalId={proposal.id}
            status={proposal.status}
            hasRecipient={Boolean(proposal.lead || proposal.client)}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {proposal.summary ? (
            <section className="card card-pad">
              <h2 className="mb-2 text-sm font-semibold text-slate-900">Summary</h2>
              <p className="text-sm leading-relaxed text-slate-600">{proposal.summary}</p>
            </section>
          ) : null}

          <section className="card overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Line items</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="th">Service</th>
                    <th className="th text-center">Qty</th>
                    <th className="th text-right">Rate</th>
                    <th className="th text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {proposal.items.map((item) => (
                    <tr key={item.id}>
                      <td className="td">
                        <p className="font-medium text-slate-900">{item.name}</p>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                        ) : null}
                      </td>
                      <td className="td text-center">{item.quantity}</td>
                      <td className="td text-right">
                        {formatMoney(item.unitPrice, proposal.currency)}
                        <span className="block text-[11px] text-slate-400">
                          {BILLING_CYCLE_LABELS[item.billingCycle as BillingCycle]}
                        </span>
                      </td>
                      <td className="td text-right font-semibold">
                        {formatMoney(item.amount, proposal.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
              <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
                <Row label="Subtotal" value={formatMoney(proposal.subtotal, proposal.currency)} />
                {proposal.discount ? (
                  <Row label="Discount" value={`-${formatMoney(proposal.discount, proposal.currency)}`} />
                ) : null}
                {proposal.tax ? (
                  <Row label={`VAT (${proposal.taxRate}%)`} value={formatMoney(proposal.tax, proposal.currency)} />
                ) : null}
                <div className="flex justify-between border-t border-slate-300 pt-2 font-bold text-slate-900">
                  <dt>Total</dt>
                  <dd>{formatMoney(proposal.total, proposal.currency)}</dd>
                </div>
                {proposal.depositAmount ? (
                  <Row
                    label="Payable on signature"
                    value={formatMoney(proposal.depositAmount, proposal.currency)}
                  />
                ) : null}
              </dl>
            </div>
          </section>

          {/* Signature + payment */}
          <div className="grid gap-6 sm:grid-cols-2">
            <section className="card card-pad">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Engagement letter</h2>
              {envelope ? (
                <dl className="space-y-2.5 text-sm">
                  <Row label="Status" value={envelope.status.toLowerCase()} />
                  <Row label="Signer" value={envelope.signerName ?? envelope.recipientName} />
                  <Row label="Email" value={envelope.recipientEmail} />
                  {envelope.signedAt ? <Row label="Signed" value={formatDateTime(envelope.signedAt)} /> : null}
                  {envelope.externalId ? (
                    <Row
                      label={envelope.externalId.startsWith('mock-') ? 'Demo envelope' : 'DocuSign envelope'}
                      value={envelope.externalId}
                    />
                  ) : null}
                </dl>
              ) : (
                <p className="text-sm text-slate-500">
                  No envelope yet. One is created the moment the client accepts.
                </p>
              )}
            </section>

            <section className="card card-pad">
              <h2 className="mb-3 text-sm font-semibold text-slate-900">Payment</h2>
              {payment ? (
                <dl className="space-y-2.5 text-sm">
                  <Row label="Status" value={payment.status.toLowerCase()} />
                  <Row label="Amount" value={formatMoney(payment.amount, payment.currency)} />
                  <Row label="Reference" value={payment.reference} />
                  {payment.paidAt ? <Row label="Paid" value={formatDateTime(payment.paidAt)} /> : null}
                  {payment.channel ? <Row label="Channel" value={payment.channel} /> : null}
                </dl>
              ) : (
                <p className="text-sm text-slate-500">
                  No transaction yet. Paystack is initialised as soon as the letter is signed.
                </p>
              )}
            </section>
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <section className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Status</h2>
              <ProposalStatusBadge status={proposal.status} />
            </div>
            <dl className="space-y-2.5 text-sm">
              {proposal.lead ? (
                <div>
                  <dt className="text-xs text-slate-500">Lead</dt>
                  <dd>
                    <Link href={`/leads/${proposal.lead.id}`} className="link">
                      {proposal.lead.companyName}
                    </Link>
                  </dd>
                </div>
              ) : null}
              {proposal.client ? (
                <div>
                  <dt className="text-xs text-slate-500">Client</dt>
                  <dd>
                    <Link href={`/clients/${proposal.client.id}`} className="link">
                      {proposal.client.name}
                    </Link>
                  </dd>
                </div>
              ) : null}
              <Row label="Valid until" value={formatDate(proposal.validUntil)} />
              <Row label="Prepared by" value={proposal.createdBy?.name ?? '—'} />
              {proposal.declineReason ? <Row label="Declined because" value={proposal.declineReason} /> : null}
            </dl>
          </section>

          <section className="card card-pad">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Client link</h2>
            <p className="mb-3 text-xs text-slate-500">
              One page for review, e-signature and payment. Safe to resend at any time.
            </p>
            <CopyLink url={publicUrl} label="Public proposal link" />
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary btn-sm mt-3 w-full"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              Preview as the client
            </a>
          </section>

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Timeline</h2>
            </div>
            <ol className="px-5 py-4">
              {timeline.map((entry, index) => (
                <li key={entry.label} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < timeline.length - 1 ? (
                    <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" aria-hidden />
                  ) : null}
                  <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                  <div>
                    <p className="text-sm text-slate-800">{entry.label}</p>
                    <p className="text-xs text-slate-400">{formatDateTime(entry.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="truncate text-right text-sm capitalize text-slate-900">{value}</dd>
    </div>
  );
}
