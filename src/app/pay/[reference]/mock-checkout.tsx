'use client';

import { useState } from 'react';
import { CheckCircle2, CreditCard, Lock } from 'lucide-react';
import { formatMoney } from '@/lib/utils';

export function MockCheckout({
  reference,
  amount,
  currency,
  email,
  status,
  firmName,
  proposalNumber,
  returnUrl,
}: {
  reference: string;
  amount: number;
  currency: string;
  email: string;
  status: string;
  firmName: string;
  proposalNumber: string;
  returnUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(status === 'SUCCESS');

  async function pay(outcome: 'success' | 'failed') {
    setBusy(true);
    setError(null);

    const res = await fetch('/api/mock/pay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference, outcome }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'The payment could not be processed.');
      setBusy(false);
      return;
    }

    if (outcome === 'failed') {
      setError('Payment declined. Try a different card.');
      setBusy(false);
      return;
    }

    setDone(true);
    setTimeout(() => {
      window.location.href = returnUrl;
    }, 1400);
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-xl bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" aria-hidden />
          <h1 className="text-lg font-bold text-slate-900">Payment successful</h1>
          <p className="mt-1.5 text-sm text-slate-500">Taking you back…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          Demo checkout. Set <code className="font-mono">PAYSTACK_MODE=live</code> with your secret key to
          send clients to Paystack&rsquo;s hosted page instead.
        </div>

        <div className="overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pay {firmName}</p>
            <p className="mt-1.5 text-3xl font-bold text-slate-900">{formatMoney(amount, currency)}</p>
            <p className="mt-1 text-xs text-slate-500">
              {email} · {proposalNumber}
            </p>
          </div>

          <div className="space-y-4 px-6 py-5">
            <label className="block">
              <span className="label">Card number</span>
              <input className="input font-mono" defaultValue="4084 0840 8408 4081" readOnly />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="label">Expiry</span>
                <input className="input font-mono" defaultValue="12/30" readOnly />
              </label>
              <label className="block">
                <span className="label">CVV</span>
                <input className="input font-mono" defaultValue="408" readOnly />
              </label>
            </div>

            {error ? (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button type="button" className="btn-primary w-full" onClick={() => pay('success')} disabled={busy}>
              <CreditCard className="h-4 w-4" aria-hidden />
              {busy ? 'Processing…' : `Pay ${formatMoney(amount, currency)}`}
            </button>

            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => pay('failed')}
              disabled={busy}
            >
              Simulate a declined card
            </button>

            <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-400">
              <Lock className="h-3 w-3" aria-hidden />
              Reference {reference}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
