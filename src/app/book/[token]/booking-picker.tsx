'use client';

import { useState } from 'react';
import { CalendarCheck, CheckCircle2 } from 'lucide-react';
import { formatLongDateTime, formatLongWeekdayDate, formatTime } from '@/lib/utils';

type Slots = { date: string; times: string[] }[];

export function BookingPicker({
  token,
  contactName,
  companyName,
  ownerName,
  ownerTitle,
  durationMins,
  slots,
  existing,
}: {
  token: string;
  contactName: string;
  companyName: string;
  ownerName: string;
  ownerTitle: string | null;
  durationMins: number;
  slots: Slots;
  existing: { scheduledAt: string; meetingLink: string | null } | null;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [agenda, setAgenda] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<string | null>(existing?.scheduledAt ?? null);

  async function confirm() {
    if (!selected) return;
    setBusy(true);
    setError(null);

    const res = await fetch('/api/public/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, scheduledAt: selected, agenda }),
    });

    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? 'That slot could not be booked. Please pick another.');
      return;
    }
    setConfirmed(selected);
  }

  if (confirmed) {
    return (
      <div className="card px-6 py-12 text-center">
        <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" aria-hidden />
        <h2 className="text-lg font-bold text-slate-900">You&rsquo;re booked in</h2>
        <p className="mt-2 text-sm text-slate-600">
          {formatLongDateTime(confirmed)}
          {' · '}
          {durationMins} minutes with {ownerName}
        </p>
        <p className="mt-4 text-sm text-slate-500">
          A confirmation is on its way to your inbox. To get the most out of the call, have your latest
          management accounts and upcoming deadlines to hand.
        </p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
        <p className="text-sm text-slate-600">
          Hi {contactName.split(' ')[0]} — pick a time that works and we&rsquo;ll talk through what{' '}
          {companyName} needs.
        </p>
        <p className="mt-2 text-xs text-slate-500">
          With {ownerName}
          {ownerTitle ? `, ${ownerTitle}` : ''}
        </p>
      </div>

      {slots.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-500">
          No slots are open at the moment. Reply to our email and we&rsquo;ll find a time.
        </p>
      ) : (
        <>
          <div className="max-h-[420px] space-y-5 overflow-y-auto px-6 py-5">
            {slots.map((day) => (
              <div key={day.date}>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {formatLongWeekdayDate(day.date)}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {day.times.map((time) => {
                    const active = selected === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelected(time)}
                        className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                          active
                            ? 'border-brand-600 bg-brand-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50'
                        }`}
                      >
                        {formatTime(time)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-slate-200 px-6 py-5">
            <label className="label" htmlFor="agenda">
              Anything you&rsquo;d like us to prepare? (optional)
            </label>
            <textarea
              id="agenda"
              rows={3}
              className="input"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="e.g. we're behind on VAT and want payroll taken off our plate"
            />

            {error ? (
              <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            <button
              type="button"
              onClick={confirm}
              disabled={!selected || busy}
              className="btn-primary mt-4 w-full"
            >
              <CalendarCheck className="h-4 w-4" aria-hidden />
              {busy ? 'Confirming…' : 'Confirm my booking'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
