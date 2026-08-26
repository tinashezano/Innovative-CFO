import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapPaymentStatus, verifyWebhookSignature, fromMinorUnits } from '@/lib/paystack';
import { markPaymentPaid } from '@/lib/workflow';

/**
 * Paystack webhook listener.
 *
 * Point your Paystack dashboard's webhook URL at POST /api/webhooks/paystack.
 * The signature is an HMAC-SHA512 of the raw body keyed on your secret key, so
 * the body is read as text and never re-serialised before verification.
 *
 * Deliveries are deduplicated on the transaction reference plus event type;
 * Paystack retries until it gets a 200.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  if (!verifyWebhookSignature(raw, request.headers.get('x-paystack-signature'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: PaystackPayload;
  try {
    payload = JSON.parse(raw) as PaystackPayload;
  } catch {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const eventType = payload.event ?? 'unknown';
  const reference = payload.data?.reference;
  if (!reference) return NextResponse.json({ ok: true, ignored: 'no reference' });

  const deliveryId = `${reference}:${eventType}`;
  const seen = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'PAYSTACK', externalId: deliveryId } },
  });
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  const record = await prisma.webhookEvent.create({
    data: { provider: 'PAYSTACK', externalId: deliveryId, eventType, payload: raw },
  });

  try {
    const payment = await prisma.payment.findUnique({ where: { reference } });
    if (!payment) throw new Error(`No payment matching reference ${reference}`);

    const status = mapPaymentStatus(payload.data?.status ?? '');

    if (eventType === 'charge.success' || status === 'SUCCESS') {
      // Guard against a tampered or mismatched amount before activating anything.
      const paidAmount = fromMinorUnits(payload.data?.amount ?? 0);
      if (paidAmount > 0 && Math.abs(paidAmount - payment.amount) > 0.01) {
        throw new Error(
          `Amount mismatch on ${reference}: expected ${payment.amount}, Paystack reported ${paidAmount}`,
        );
      }

      await markPaymentPaid({
        reference,
        channel: payload.data?.channel ?? null,
        paidAt: payload.data?.paid_at ? new Date(payload.data.paid_at) : new Date(),
        raw: payload,
      });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status, lastEventRaw: raw },
      });
    }

    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: 'PROCESSED', processedAt: new Date() },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.webhookEvent.update({
      where: { id: record.id },
      data: { status: 'FAILED', error: message, processedAt: new Date() },
    });
    return NextResponse.json({ ok: false, error: message });
  }
}

type PaystackPayload = {
  event?: string;
  data?: {
    reference?: string;
    status?: string;
    amount?: number;
    channel?: string;
    paid_at?: string;
  };
};
