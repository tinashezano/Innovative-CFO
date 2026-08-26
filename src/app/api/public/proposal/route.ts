import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { acceptProposal, ensurePayment, signingUrlFor } from '@/lib/workflow';

const postSchema = z.object({
  token: z.string().min(8),
  action: z.enum(['accept', 'pay', 'decline']),
  reason: z.string().max(2000).optional(),
});

/** Polled by the public proposal page while a webhook is in flight. */
export const GET = handler(async (request: Request) => {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return ok({ error: 'Missing token' }, 400);

  const proposal = await prisma.proposal.findUnique({
    where: { publicToken: token },
    include: {
      envelopes: { orderBy: { createdAt: 'desc' }, take: 1 },
      payments: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  if (!proposal) return ok({ error: 'Not found' }, 404);

  const envelope = proposal.envelopes[0];
  const payment = proposal.payments[0];

  return ok({
    status: proposal.status,
    envelope: envelope
      ? { id: envelope.id, status: envelope.status, signedAt: envelope.signedAt }
      : null,
    payment: payment
      ? {
          reference: payment.reference,
          status: payment.status,
          amount: payment.amount,
          authorizationUrl: payment.authorizationUrl,
        }
      : null,
  });
});

export const POST = handler(async (request: Request) => {
  const input = postSchema.parse(await request.json());

  const proposal = await prisma.proposal.findUnique({ where: { publicToken: input.token } });
  if (!proposal) return ok({ error: 'That proposal link is no longer valid' }, 404);

  if (input.action === 'decline') {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'DECLINED', declinedAt: new Date(), declineReason: input.reason || null },
    });
    if (proposal.leadId) {
      await prisma.leadActivity.create({
        data: {
          leadId: proposal.leadId,
          type: 'SYSTEM',
          body: `Proposal declined by the client.${input.reason ? ` Reason: ${input.reason}` : ''}`,
        },
      });
      await prisma.lead.update({
        where: { id: proposal.leadId },
        data: { stage: 'LOST', lostAt: new Date(), lostReason: input.reason || 'Proposal declined' },
      });
    }
    return ok({ declined: true });
  }

  if (proposal.validUntil && proposal.validUntil < new Date() && proposal.status !== 'PAID') {
    return ok({ error: 'This proposal has expired. Please ask us for an updated one.' }, 410);
  }

  if (input.action === 'accept') {
    const envelope = await acceptProposal(proposal.id);
    const signingUrl = 'signingUrl' in envelope ? envelope.signingUrl : await signingUrlFor(envelope.id);
    return ok({
      envelope: { id: envelope.id, status: envelope.status, signedAt: envelope.signedAt },
      signingUrl,
    });
  }

  // action === 'pay'
  const payment = await ensurePayment(proposal.id);
  return ok({
    payment: {
      reference: payment.reference,
      status: payment.status,
      amount: payment.amount,
      authorizationUrl: payment.authorizationUrl,
    },
  });
});
