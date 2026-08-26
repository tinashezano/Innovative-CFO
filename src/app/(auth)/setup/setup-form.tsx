'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SetupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const res = await fetch('/api/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        email: form.get('email'),
        password: form.get('password'),
        firmName: form.get('firmName') || undefined,
      }),
    });

    if (res.ok) {
      router.push('/');
      router.refresh();
      return;
    }

    const body = await res.json().catch(() => null);
    setError(body?.error ?? 'Could not create the account.');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="label">Firm name</span>
        <input name="firmName" className="input" placeholder="Innovative CFO" />
      </label>

      <label className="block">
        <span className="label">
          Your name<span className="text-red-500"> *</span>
        </span>
        <input name="name" className="input" required autoFocus autoComplete="name" />
      </label>

      <label className="block">
        <span className="label">
          Your email<span className="text-red-500"> *</span>
        </span>
        <input name="email" type="email" className="input" required autoComplete="username" />
      </label>

      <label className="block">
        <span className="label">
          Password<span className="text-red-500"> *</span>
        </span>
        <input
          name="password"
          type="password"
          className="input"
          required
          minLength={10}
          autoComplete="new-password"
        />
        <span className="mt-1 block text-xs text-slate-400">At least 10 characters.</span>
      </label>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? 'Creating your account…' : 'Create owner account'}
      </button>
    </form>
  );
}
