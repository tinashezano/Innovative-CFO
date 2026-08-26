import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { mapEnvelopeStatus } from '@/lib/docusign';
import { markEnvelopeSigned } from '@/lib/workflow';

/**
 * DocuSign Connect listener.
 *
 * Configure a Connect subscription pointing at POST /api/webhooks/docusign with
 * "Include HMAC signature" switched on, and put the same key in
 * DOCUSIGN_WEBHOOK_SECRET. Subscribe to the envelope-completed and
 * envelope-declined events.
 *
 * Every delivery is recorded first, so a duplicate is recognised and ignored —
 * DocuSign retries aggressively.
 */
export async function POST(request: Request) {
  const raw = await request.text();

  if (!verifySignature(raw, request.headers.get('x-docusign-signature-1'))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: DocuSignPayload;
  try {
    payload = JSON.parse(raw) as DocuSignPayload;
  } catch {
    return NextResponse.json({ error: 'Malformed payload' }, { status: 400 });
  }

  const envelopeId = payload.data?.envelopeId;
  const eventType = payload.event ?? 'unknown';
  // DocuSign sends a unique id per delivery; fall back to a digest of the body.
  const deliveryId =
    payload.uri ?? `${envelopeId ?? 'unknown'}:${eventType}:${crypto.createHash('sha1').update(raw).digest('hex').slice(0, 16)}`;

  const seen = await prisma.webhookEvent.findUnique({
    where: { provider_externalId: { provider: 'DOCUSIGN', externalId: deliveryId } },
  });
  if (seen) return NextResponse.json({ ok: true, duplicate: true });

  const record = await prisma.webhookEvent.create({
    data: { provider: 'DOCUSIGN', externalId: deliveryId, eventType, payload: raw },
  });

  try {
    if (!envelopeId) throw new Error('Payload carried no envelopeId');

    // We stamp our own envelope id as a custom field when creating the envelope,
    // so match on that first and fall back to the DocuSign id.
    const ourId = payload.data?.envelopeSummary?.customFields?.textCustomFields?.find(
      (f) => f.name === 'icfoEnvelopeId',
    )?.value;

    const envelope = ourId
      ? await prisma.envelope.findUnique({ where: { id: ourId } })
      : await prisma.envelope.findUnique({ where: { externalId: envelopeId } });

    if (!envelope) throw new Error(`No envelope matching ${ourId ?? envelopeId}`);

    const status = mapEnvelopeStatus(payload.data?.envelopeSummary?.status ?? eventType);

    if (status === 'COMPLETED') {
      const signer = payload.data?.envelopeSummary?.recipients?.signers?.[0];
      await markEnvelopeSigned({
        envelopeId: envelope.id,
        signerName: signer?.name ?? envelope.recipientName,
        raw: payload,
      });
    } else {
      await prisma.envelope.update({
        where: { id: envelope.id },
        data: {
          status,
          lastEventRaw: raw,
          ...(status === 'DECLINED' ? { declinedAt: new Date() } : {}),
        },
      });
      if (status === 'DECLINED') {
        await prisma.proposal.update({
          where: { id: envelope.proposalId },
          data: { status: 'DECLINED', declinedAt: new Date() },
        });
      }
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
    // 200 so DocuSign stops retrying a payload we will never process; the
    // failure is on the Webhook events log for a human to look at.
    return NextResponse.json({ ok: false, error: message });
  }
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  // No secret configured means mock mode — accept, since nothing real is at stake.
  if (!secret) return process.env.DOCUSIGN_MODE !== 'live';
  if (!signature) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

type DocuSignPayload = {
  event?: string;
  uri?: string;
  data?: {
    envelopeId?: string;
    envelopeSummary?: {
      status?: string;
      customFields?: { textCustomFields?: { name: string; value: string }[] };
      recipients?: { signers?: { name?: string; email?: string }[] };
    };
  };
};
