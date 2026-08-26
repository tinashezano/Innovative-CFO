'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatDateTime, cn } from '@/lib/utils';
import { submitJson } from '@/components/forms';
import { LEAD_ACTIVITY_TYPES } from '@/lib/constants';

type Activity = {
  id: string;
  type: string;
  body: string;
  createdAt: string;
  userName: string | null;
};

const TYPE_DOT: Record<string, string> = {
  NOTE: 'bg-slate-400',
  CALL: 'bg-sky-500',
  EMAIL: 'bg-violet-500',
  MEETING: 'bg-amber-500',
  STAGE_CHANGE: 'bg-brand-500',
  SYSTEM: 'bg-slate-300',
};

export function ActivityFeed({ leadId, activities }: { leadId: string; activities: Activity[] }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [type, setType] = useState('NOTE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);

    const result = await submitJson(`/api/leads/${leadId}/activities`, { type, body });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setBody('');
    router.refresh();
  }

  return (
    <section className="card">
      <div className="border-b border-slate-200 px-5 py-3.5">
        <h2 className="text-sm font-semibold text-slate-900">Activity</h2>
      </div>

      <form onSubmit={add} className="border-b border-slate-100 px-5 py-4">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="input"
          placeholder="Log a call, an email or a note…"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input w-auto text-xs">
            {LEAD_ACTIVITY_TYPES.filter((t) => t !== 'SYSTEM' && t !== 'STAGE_CHANGE').map((t) => (
              <option key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
          <button type="submit" className="btn-primary btn-sm" disabled={busy || !body.trim()}>
            {busy ? 'Saving…' : 'Add'}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </form>

      {activities.length ? (
        <ol className="px-5 py-4">
          {activities.map((activity, index) => (
            <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
              {index < activities.length - 1 ? (
                <span className="absolute left-[5px] top-4 h-full w-px bg-slate-200" aria-hidden />
              ) : null}
              <span
                className={cn('relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full', TYPE_DOT[activity.type] ?? 'bg-slate-300')}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700">{activity.body}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {formatDateTime(activity.createdAt)}
                  {activity.userName ? ` · ${activity.userName}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing logged yet.</p>
      )}
    </section>
  );
}
