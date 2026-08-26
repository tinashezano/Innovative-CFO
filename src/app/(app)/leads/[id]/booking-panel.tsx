'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Video } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import { formatDateTime } from '@/lib/utils';
import { CopyLink } from '@/components/copy-link';

type Booking = {
  id: string;
  scheduledAt: string;
  durationMins: number;
  status: string;
  outcome: string | null;
  outcomeNotes: string | null;
  meetingLink: string | null;
  agenda: string | null;
};

export function BookingPanel({
  leadId,
  bookings,
  bookingUrl,
  hasOpenBooking,
}: {
  leadId: string;
  bookings: Booking[];
  bookingUrl: string;
  hasOpenBooking: boolean;
}) {
  const router = useRouter();
  const [bookOpen, setBookOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<Booking | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    const result = await submitJson(`/api/leads/${leadId}/bookings`, {
      scheduledAt: form.get('scheduledAt'),
      durationMins: Number(form.get('durationMins') || 30),
      meetingLink: form.get('meetingLink') || null,
      agenda: form.get('agenda') || null,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBookOpen(false);
    router.refresh();
  }

  async function complete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!completeFor) return;
    setBusy(true);
    setError(null);
    const form = new FormData(event.currentTarget);

    const result = await submitJson(`/api/bookings/${completeFor.id}/complete`, {
      outcome: form.get('outcome'),
      outcomeNotes: form.get('outcomeNotes') || null,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCompleteFor(null);
    router.refresh();
  }

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">Discovery calls</h2>
        <button type="button" className="btn-secondary btn-sm" onClick={() => setBookOpen(true)}>
          <CalendarPlus className="h-3.5 w-3.5" aria-hidden />
          Book a call
        </button>
      </div>

      {bookings.length ? (
        <ul className="divide-y divide-slate-100">
          {bookings.map((booking) => (
            <li key={booking.id} className="px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatDateTime(booking.scheduledAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {booking.durationMins} minutes ·{' '}
                    <span className="capitalize">{booking.status.toLowerCase().replace(/_/g, ' ')}</span>
                    {booking.outcome ? ` · outcome ${booking.outcome.toLowerCase().replace(/_/g, ' ')}` : ''}
                  </p>
                  {booking.agenda ? (
                    <p className="mt-2 text-sm text-slate-600">{booking.agenda}</p>
                  ) : null}
                  {booking.outcomeNotes ? (
                    <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                      {booking.outcomeNotes}
                    </p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {booking.meetingLink ? (
                    <a
                      href={booking.meetingLink}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-secondary btn-sm"
                    >
                      <Video className="h-3.5 w-3.5" aria-hidden />
                      Join
                    </a>
                  ) : null}
                  {booking.status === 'CONFIRMED' ? (
                    <button
                      type="button"
                      className="btn-primary btn-sm"
                      onClick={() => setCompleteFor(booking)}
                    >
                      Log the outcome
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-6">
          <p className="text-sm text-slate-500">
            No call booked yet. Send {hasOpenBooking ? 'another' : 'the'} booking link, or capture a call you
            arranged by phone.
          </p>
          <div className="mt-3">
            <CopyLink url={bookingUrl} label="Discovery call booking link" />
          </div>
        </div>
      )}

      <Modal open={bookOpen} onClose={() => setBookOpen(false)} title="Book a discovery call">
        <form onSubmit={book} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date and time" required>
              <input name="scheduledAt" type="datetime-local" className="input" required autoFocus />
            </Field>
            <Field label="Duration (minutes)">
              <input name="durationMins" type="number" min="5" step="5" defaultValue={30} className="input" />
            </Field>
          </div>
          <Field label="Meeting link">
            <input name="meetingLink" className="input" placeholder="https://meet.google.com/…" />
          </Field>
          <Field label="Agenda" hint="What the prospect wants to cover. Shows on the call task.">
            <textarea name="agenda" rows={3} className="input" />
          </Field>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setBookOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Booking…' : 'Confirm booking'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(completeFor)} onClose={() => setCompleteFor(null)} title="Log the call outcome">
        <form onSubmit={complete} className="space-y-4">
          <Field label="Outcome" required>
            <select name="outcome" className="input" defaultValue="PROCEED">
              <option value="PROCEED">Proceed — build a proposal</option>
              <option value="FOLLOW_UP">Follow up — not ready yet</option>
              <option value="NOT_A_FIT">Not a fit — mark the lead lost</option>
            </select>
          </Field>
          <Field label="Notes" hint="What did you learn? This lands on the lead's activity feed.">
            <textarea name="outcomeNotes" rows={4} className="input" />
          </Field>
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-800">
            Choosing <strong>Proceed</strong> moves the lead to Proposal and raises a proposal task for the
            owner. <strong>Not a fit</strong> marks the lead lost.
          </p>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setCompleteFor(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save outcome'}
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
