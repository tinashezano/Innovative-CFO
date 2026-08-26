import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { MockCheckout } from './mock-checkout';

export const dynamic = 'force-dynamic';

/**
 * Local checkout used when PAYSTACK_MODE=mock, so the sign-then-pay flow can
 * be exercised without keys. In live mode the client is sent to Paystack's own
 * hosted page instead and never reaches this route.
 */
export default async function MockPayPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const settings = await getSettings();

  const payment = await prisma.payment.findUnique({
    where: { reference },
    include: { proposal: { select: { publicToken: true, number: true, title: true } } },
  });

  if (!payment) notFound();

  return (
    <MockCheckout
      reference={payment.reference}
      amount={payment.amount}
      currency={payment.currency}
      email={payment.customerEmail ?? ''}
      status={payment.status}
      firmName={settings.firmName}
      proposalNumber={payment.proposal?.number ?? ''}
      returnUrl={payment.proposal ? `/p/${payment.proposal.publicToken}?paid=1` : '/'}
    />
  );
}
