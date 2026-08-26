import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { markPaymentPaid } from '@/lib/workflow';
import { paystackMode } from '@/lib/paystack';

const schema = z.object({
  reference: z.string().min(1),
  outcome: z.enum(['success', 'failed']),
});

/**
 * Records the outcome of the local demo checkout. Disabled entirely when
 * Paystack is live so a payment can never be marked paid without Paystack
 * having actually taken the money.
 */
export const POST = handler(async (request: Request) => {
  if (paystackMode() === 'live') {
    return ok({ error: 'Paystack is running in live mode; pay through Paystack.' }, 409);
  }

  const input = schema.parse(await request.json());

  const payment = await prisma.payment.findUnique({ where: { reference: input.reference } });
  if (!payment) return ok({ error: 'That payment could not be found' }, 404);

  if (input.outcome === 'failed') {
    await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    return ok({ status: 'FAILED' });
  }

  await markPaymentPaid({
    reference: payment.reference,
    channel: 'card',
    paidAt: new Date(),
    raw: { source: 'demo-checkout' },
  });

  return ok({ status: 'SUCCESS' });
});
