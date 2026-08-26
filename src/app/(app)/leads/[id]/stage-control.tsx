'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import { LEAD_BOARD_STAGES, LEAD_STAGE_LABELS } from '@/lib/constants';

export function LeadStageControl({
  leadId,
  stage,
  hasProposal,
}: {
  leadId: string;
  stage: string;
  hasProposal: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string, lostReason?: string) {
    setBusy(true);
    setError(null);
    const result = await submitJson(`/api/leads/${leadId}`, { stage: next, lostReason }, 'PATCH');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLostOpen(false);
    router.refresh();
  }

  return (
    <>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}

      <select
        aria-label="Lead stage"
        className="input w-auto"
        value={stage}
        disabled={busy}
        onChange={(e) => {
          const next = e.target.value;
          if (next === 'LOST') {
            setLostOpen(true);
            return;
          }
          void change(next);
        }}
      >
        {LEAD_BOARD_STAGES.map((s) => (
          <option key={s} value={s}>
            {LEAD_STAGE_LABELS[s]}
          </option>
        ))}
      </select>

      {!hasProposal && ['DISCOVERY', 'PROPOSAL'].includes(stage) ? (
        <Link href={`/proposals/new?leadId=${leadId}`} className="btn-primary">
          Build proposal
        </Link>
      ) : null}

      <Modal open={lostOpen} onClose={() => setLostOpen(false)} title="Mark this lead as lost">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const reason = new FormData(e.currentTarget).get('lostReason') as string;
            void change('LOST', reason);
          }}
          className="space-y-4"
        >
          <Field label="Why was it lost?" hint="This shows on the lead and feeds your win-rate reporting.">
            <textarea name="lostReason" rows={3} className="input" autoFocus required />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setLostOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-danger" disabled={busy}>
              Mark as lost
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
