'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import { CLIENT_STATUSES } from '@/lib/constants';

export function NewClientButton({ users }: { users: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await submitJson('/api/clients', {
      name: form.get('name'),
      legalName: form.get('legalName') || null,
      email: form.get('email'),
      phone: form.get('phone') || null,
      contactName: form.get('contactName') || null,
      industry: form.get('industry') || null,
      registrationNumber: form.get('registrationNumber') || null,
      taxNumber: form.get('taxNumber') || null,
      financialYearEnd: form.get('financialYearEnd') || null,
      monthlyFee: Number(form.get('monthlyFee') || 0),
      status: form.get('status'),
      ownerId: form.get('ownerId') || null,
      withOnboarding: form.get('withOnboarding') === 'on',
      withRecurringCalendar: form.get('withRecurringCalendar') === 'on',
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" aria-hidden />
        Add a client
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Add an existing client" wide>
        <form onSubmit={onSubmit} className="space-y-4">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            New business normally arrives here on its own once a proposal is signed and paid. Use this for
            clients you already had before the app.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trading name" required>
              <input name="name" className="input" required autoFocus />
            </Field>
            <Field label="Registered name">
              <input name="legalName" className="input" />
            </Field>
            <Field label="Primary contact">
              <input name="contactName" className="input" />
            </Field>
            <Field label="Email" required>
              <input name="email" type="email" className="input" required />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" />
            </Field>
            <Field label="Industry">
              <input name="industry" className="input" />
            </Field>
            <Field label="Registration number">
              <input name="registrationNumber" className="input" />
            </Field>
            <Field label="Tax number">
              <input name="taxNumber" className="input" />
            </Field>
            <Field label="Financial year end">
              <input name="financialYearEnd" className="input" placeholder="February" />
            </Field>
            <Field label="Monthly fee">
              <input name="monthlyFee" type="number" min="0" step="100" className="input" defaultValue={0} />
            </Field>
            <Field label="Status">
              <select name="status" className="input" defaultValue="ACTIVE">
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Account manager">
              <select name="ownerId" className="input">
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="space-y-2 rounded-lg bg-slate-50 p-3">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="withOnboarding"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm text-slate-600">Open onboarding with the standard checklist</span>
            </label>
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="withRecurringCalendar"
                defaultChecked
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm text-slate-600">
                Install the recurring compliance calendar
                <span className="mt-0.5 block text-xs text-slate-400">
                  Bookkeeping, management accounts, annual accounts and CIPC. Add VAT, payroll and tax per
                  client from the Recurring tab.
                </span>
              </span>
            </label>
          </div>

          <FormError message={error} />

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : 'Add client'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
