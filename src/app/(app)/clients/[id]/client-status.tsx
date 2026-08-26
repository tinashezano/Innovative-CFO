'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { submitJson } from '@/components/forms';
import { CLIENT_STATUSES } from '@/lib/constants';

const LABELS: Record<string, string> = {
  ONBOARDING: 'Onboarding',
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  OFFBOARDED: 'Offboarded',
};

export function ClientStatusControl({ clientId, status }: { clientId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    setBusy(true);
    setError(null);
    const result = await submitJson(`/api/clients/${clientId}`, { status: next }, 'PATCH');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <select
        aria-label="Client status"
        className="input w-auto"
        value={status}
        disabled={busy}
        onChange={(e) => void change(e.target.value)}
      >
        {CLIENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {LABELS[s]}
          </option>
        ))}
      </select>
    </>
  );
}
