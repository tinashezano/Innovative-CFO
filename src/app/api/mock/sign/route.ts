import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { markEnvelopeSigned } from '@/lib/workflow';
import { docusignMode } from '@/lib/docusign';

const schema = z.object({
  envelopeId: z.string().min(1),
  signerName: z.string().min(1, 'Type your name to sign'),
});

/**
 * Signature capture for the in-app (mock) signing experience. Refuses to run
 * when DocuSign is configured live so the real envelope stays the source of
 * truth for signatures.
 */
export const POST = handler(async (request: Request) => {
  if (docusignMode() === 'live') {
    return ok({ error: 'DocuSign is running in live mode; sign through DocuSign.' }, 409);
  }

  const input = schema.parse(await request.json());

  const envelope = await prisma.envelope.findUnique({ where: { id: input.envelopeId } });
  if (!envelope) return ok({ error: 'That signing session is no longer valid' }, 404);
  if (envelope.status === 'COMPLETED') return ok({ alreadySigned: true });

  const forwarded = request.headers.get('x-forwarded-for');
  await markEnvelopeSigned({
    envelopeId: envelope.id,
    signerName: input.signerName,
    signerIp: forwarded?.split(',')[0]?.trim() ?? null,
    raw: { source: 'in-app-signature' },
  });

  return ok({ signed: true });
});
