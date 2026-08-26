import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { appUrl } from '@/lib/utils';

/**
 * Where DocuSign sends the signer once the embedded session ends.
 *
 * The `event` query parameter is a UI hint only — never a signature record.
 * The signature itself is confirmed by the Connect webhook, so this route only
 * routes the client back to their proposal page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const envelopeId = url.searchParams.get('envelope');
  const event = url.searchParams.get('event');

  if (!envelopeId) return NextResponse.redirect(appUrl('/'));

  const envelope = await prisma.envelope.findUnique({
    where: { id: envelopeId },
    include: { proposal: { select: { publicToken: true } } },
  });

  if (!envelope?.proposal) return NextResponse.redirect(appUrl('/'));

  return NextResponse.redirect(
    appUrl(`/p/${envelope.proposal.publicToken}?signing=${event ?? 'returned'}`),
  );
}
