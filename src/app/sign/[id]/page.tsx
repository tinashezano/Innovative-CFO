import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { SignPad } from './sign-pad';

export const dynamic = 'force-dynamic';

/**
 * In-app engagement-letter signing, used when DOCUSIGN_MODE=mock.
 *
 * It renders the same document that live mode uploads to DocuSign and posts to
 * the same webhook handler, so switching to live DocuSign changes only which
 * URL the iframe loads — nothing downstream.
 */
export default async function SignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const envelope = await prisma.envelope.findUnique({
    where: { id },
    include: { proposal: { select: { number: true, currency: true, total: true } } },
  });

  if (!envelope) notFound();

  const done = envelope.status === 'COMPLETED';

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Demo signing session. Set <code className="font-mono">DOCUSIGN_MODE=live</code> with your
          integration key to route this through DocuSign instead — nothing else in the flow changes.
        </div>

        <div
          className="rounded-xl border border-slate-200 bg-white shadow-sm"
          dangerouslySetInnerHTML={{ __html: envelope.documentHtml ?? '' }}
        />

        {done ? (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-sm font-semibold text-emerald-900">
              Signed by {envelope.signerName ?? envelope.recipientName}
            </p>
            <p className="mt-0.5 text-xs text-emerald-700">
              {envelope.signedAt?.toLocaleString('en-ZA')}
            </p>
          </div>
        ) : (
          <SignPad envelopeId={envelope.id} defaultName={envelope.recipientName} />
        )}
      </div>
    </main>
  );
}
