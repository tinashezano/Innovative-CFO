import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { ProposalClient } from './proposal-client';

export const dynamic = 'force-dynamic';

/**
 * The public proposal page — one link that carries the client all the way
 * through review, e-signature and payment.
 */
export default async function PublicProposalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const settings = await getSettings();

  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: {
      items: { orderBy: { sortOrder: 'asc' } },
      lead: { include: { owner: { select: { name: true, jobTitle: true, email: true } } } },
      client: true,
      envelopes: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!proposal) notFound();

  // First open marks the proposal viewed, which shows on the internal list.
  if (proposal.status === 'SENT') {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'VIEWED', viewedAt: proposal.viewedAt ?? new Date() },
    });
    if (proposal.leadId) {
      await prisma.leadActivity.create({
        data: { leadId: proposal.leadId, type: 'SYSTEM', body: 'Proposal opened by the client.' },
      });
    }
  }

  const envelope = proposal.envelopes.find((e) => e.kind === 'ENGAGEMENT_LETTER');
  const payment = proposal.payments.find((p) => ['PENDING', 'SUCCESS'].includes(p.status));

  const expired = proposal.validUntil ? proposal.validUntil < new Date() : false;

  return (
    <ProposalClient
      token={token}
      firm={{
        name: settings.firmName,
        email: settings.firmEmail,
        phone: settings.firmPhone,
        address: settings.firmAddress,
      }}
      proposal={{
        id: proposal.id,
        number: proposal.number,
        title: proposal.title,
        summary: proposal.summary,
        scopeHtml: proposal.scopeHtml,
        currency: proposal.currency,
        subtotal: proposal.subtotal,
        discount: proposal.discount,
        tax: proposal.tax,
        taxRate: proposal.taxRate,
        total: proposal.total,
        depositAmount: proposal.depositAmount,
        status: proposal.status,
        validUntil: proposal.validUntil?.toISOString() ?? null,
        declineReason: proposal.declineReason,
        items: proposal.items.map((i) => ({
          id: i.id,
          name: i.name,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.amount,
          billingCycle: i.billingCycle,
        })),
      }}
      recipient={{
        contactName: proposal.lead?.contactName ?? proposal.client?.name ?? 'there',
        companyName: proposal.lead?.companyName ?? proposal.client?.name ?? '',
        ownerName: proposal.lead?.owner?.name ?? settings.firmName,
        ownerTitle: proposal.lead?.owner?.jobTitle ?? null,
      }}
      envelope={
        envelope
          ? { id: envelope.id, status: envelope.status, signedAt: envelope.signedAt?.toISOString() ?? null }
          : null
      }
      payment={
        payment
          ? {
              reference: payment.reference,
              status: payment.status,
              amount: payment.amount,
              authorizationUrl: payment.authorizationUrl,
            }
          : null
      }
      expired={expired}
    />
  );
}
