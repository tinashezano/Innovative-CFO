'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send, Trash2 } from 'lucide-react';
import { submitJson } from '@/components/forms';

export function ProposalActions({
  proposalId,
  status,
  hasRecipient,
}: {
  proposalId: string;
  status: string;
  hasRecipient: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = ['DRAFT', 'SENT', 'VIEWED'].includes(status);
  const canDelete = status === 'DRAFT';

  async function send() {
    setBusy(true);
    setError(null);
    const result = await submitJson(`/api/proposals/${proposalId}/send`, {});
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this draft proposal? This cannot be undone.')) return;
    setBusy(true);
    const result = await submitJson(`/api/proposals/${proposalId}`, undefined, 'DELETE');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push('/proposals');
    router.refresh();
  }

  return (
    <>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      {canSend ? (
        <button type="button" className="btn-primary" onClick={send} disabled={busy || !hasRecipient}>
          <Send className="h-4 w-4" aria-hidden />
          {status === 'DRAFT' ? 'Send to the client' : 'Resend'}
        </button>
      ) : null}

      {canDelete ? (
        <button type="button" className="btn-danger" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete
        </button>
      ) : null}
    </>
  );
}
