'use client';

import { useState } from 'react';
import { PenLine } from 'lucide-react';

export function SignPad({ envelopeId, defaultName }: { envelopeId: string; defaultName: string }) {
  const [name, setName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function sign() {
    setBusy(true);
    setError(null);

    const res = await fetch('/api/mock/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ envelopeId, signerName: name }),
    });

    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'Signing failed. Please try again.');
      return;
    }
    setDone(true);
    // Tell the parent proposal page to move on to payment.
    window.parent?.postMessage({ type: 'envelope-signed', envelopeId }, '*');
  }

  if (done) {
    return (
      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
        <p className="text-sm font-semibold text-emerald-900">Signed. Thank you.</p>
        <p className="mt-1 text-xs text-emerald-700">You can close this and continue to payment.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Sign the engagement letter</h2>

      <label className="mt-4 block">
        <span className="label">Type your full name as your signature</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input font-serif text-lg italic"
          autoComplete="name"
        />
      </label>

      <label className="mt-4 flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
        />
        <span className="text-sm text-slate-600">
          I have read the engagement letter and I am authorised to accept it on behalf of the company. I
          agree that typing my name here is my electronic signature.
        </span>
      </label>

      {error ? (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={sign}
        disabled={!agreed || !name.trim() || busy}
        className="btn-primary mt-5 w-full"
      >
        <PenLine className="h-4 w-4" aria-hidden />
        {busy ? 'Signing…' : 'Sign the engagement letter'}
      </button>
    </div>
  );
}
