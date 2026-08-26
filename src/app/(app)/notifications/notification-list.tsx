'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CheckCheck } from 'lucide-react';
import { cn, formatDateTime } from '@/lib/utils';
import { submitJson } from '@/components/forms';

type Notification = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  kind: string;
  read: boolean;
  createdAt: string;
};

const KIND_DOT: Record<string, string> = {
  INFO: 'bg-slate-400',
  SUCCESS: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  ACTION: 'bg-brand-500',
};

export function NotificationList({ notifications }: { notifications: Notification[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const unread = notifications.filter((n) => !n.read);

  async function markRead(ids: string[] | 'all') {
    setBusy(true);
    await submitJson('/api/notifications', ids === 'all' ? { all: true } : { ids }, 'PATCH');
    setBusy(false);
    router.refresh();
  }

  if (!notifications.length) {
    return (
      <div className="card px-6 py-16 text-center">
        <p className="text-sm font-semibold text-slate-700">Nothing here yet</p>
        <p className="mt-1 text-sm text-slate-500">
          You will be told when a lead is assigned to you, a proposal is signed, or a task lands on your plate.
        </p>
      </div>
    );
  }

  return (
    <>
      {unread.length ? (
        <div className="mb-4 flex justify-end">
          <button type="button" className="btn-secondary btn-sm" onClick={() => markRead('all')} disabled={busy}>
            <CheckCheck className="h-3.5 w-3.5" aria-hidden />
            Mark all as read
          </button>
        </div>
      ) : null}

      <ul className="card divide-y divide-slate-100 overflow-hidden">
        {notifications.map((notification) => {
          const inner = (
            <div className="flex gap-3 px-5 py-4">
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                  notification.read ? 'bg-slate-200' : (KIND_DOT[notification.kind] ?? 'bg-slate-400'),
                )}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'text-sm',
                    notification.read ? 'text-slate-600' : 'font-semibold text-slate-900',
                  )}
                >
                  {notification.title}
                </p>
                {notification.body ? (
                  <p className="mt-0.5 text-sm text-slate-500">{notification.body}</p>
                ) : null}
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(notification.createdAt)}</p>
              </div>
              {!notification.read ? (
                <button
                  type="button"
                  className="btn-ghost btn-sm shrink-0 text-slate-400"
                  disabled={busy}
                  onClick={(e) => {
                    e.preventDefault();
                    void markRead([notification.id]);
                  }}
                >
                  Mark read
                </button>
              ) : null}
            </div>
          );

          return (
            <li key={notification.id} className={cn(!notification.read && 'bg-brand-50/40')}>
              {notification.link ? (
                <Link
                  href={notification.link}
                  className="block transition hover:bg-slate-50"
                  onClick={() => {
                    if (!notification.read) void markRead([notification.id]);
                  }}
                >
                  {inner}
                </Link>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
