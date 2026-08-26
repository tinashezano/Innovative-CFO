'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import { LEAD_SOURCES } from '@/lib/constants';

export function NewLeadButton({
  users,
  currentUserId,
}: {
  users: { id: string; name: string }[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await submitJson('/api/leads', {
      companyName: form.get('companyName'),
      contactName: form.get('contactName'),
      email: form.get('email'),
      phone: form.get('phone') || null,
      source: form.get('source'),
      serviceInterest: form.get('serviceInterest') || null,
      estimatedValue: Number(form.get('estimatedValue') || 0),
      notes: form.get('notes') || null,
      ownerId: form.get('ownerId') || null,
      sendBookingInvite: form.get('sendBookingInvite') === 'on',
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
        New lead
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Capture a lead">
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company" required>
              <input name="companyName" className="input" required autoFocus />
            </Field>
            <Field label="Contact name" required>
              <input name="contactName" className="input" required />
            </Field>
            <Field label="Email" required>
              <input name="email" type="email" className="input" required />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" />
            </Field>
            <Field label="Source">
              <select name="source" className="input" defaultValue="WEBSITE">
                {LEAD_SOURCES.map((source) => (
                  <option key={source} value={source}>
                    {source.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estimated monthly value">
              <input name="estimatedValue" type="number" min="0" step="100" className="input" defaultValue={0} />
            </Field>
          </div>

          <Field label="Services they are interested in">
            <input name="serviceInterest" className="input" placeholder="Bookkeeping, VAT, payroll…" />
          </Field>

          <Field label="Owner">
            <select name="ownerId" className="input" defaultValue={currentUserId}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Notes">
            <textarea name="notes" rows={3} className="input" placeholder="What do they need? What did they say?" />
          </Field>

          <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3">
            <input
              type="checkbox"
              name="sendBookingInvite"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-sm text-slate-600">
              Email the discovery-call booking link straight away
              <span className="mt-0.5 block text-xs text-slate-400">
                A follow-up task is raised for the owner either way.
              </span>
            </span>
          </label>

          <FormError message={error} />

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Creating…' : 'Create lead'}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
