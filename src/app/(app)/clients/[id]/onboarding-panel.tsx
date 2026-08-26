'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Mail, Plus, SkipForward, Trash2 } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import { ProgressBar } from '@/components/ui';
import { formatDate, cn } from '@/lib/utils';
import {
  ONBOARDING_ITEM_TYPES,
  ONBOARDING_STAGES,
  ONBOARDING_STAGE_LABELS,
  type OnboardingStage,
} from '@/lib/constants';

type Item = {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  type: string;
  required: boolean;
  status: string;
  dueDate: string | null;
};

const STATUS_ORDER = ['PENDING', 'RECEIVED', 'APPROVED', 'WAIVED'];

export function OnboardingPanel({
  onboardingId,
  stage,
  ownerName,
  targetCompleteAt,
  welcomePackSentAt,
  items,
}: {
  onboardingId: string;
  stage: string;
  ownerName: string | null;
  targetCompleteAt: string | null;
  welcomePackSentAt: string | null;
  items: Item[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const done = items.filter((i) => ['APPROVED', 'WAIVED'].includes(i.status)).length;
  const currentIndex = ONBOARDING_STAGES.indexOf(stage as OnboardingStage);

  // A stage cannot be left while its required items are still outstanding.
  const blockers = items.filter(
    (i) => i.stage === stage && i.required && !['APPROVED', 'WAIVED'].includes(i.status),
  );

  async function call(url: string, body: unknown, method: 'POST' | 'PATCH' | 'DELETE' = 'PATCH') {
    setBusy(true);
    setError(null);
    const result = await submitJson(url, body, method);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function moveStage(next: string) {
    await call(`/api/onboarding/${onboardingId}`, { stage: next });
  }

  async function setItemStatus(itemId: string, status: string) {
    await call(`/api/onboarding/items/${itemId}`, { status });
  }

  async function removeItem(itemId: string) {
    if (!confirm('Remove this checklist item?')) return;
    await call(`/api/onboarding/items/${itemId}`, undefined, 'DELETE');
  }

  async function resend(action: string, message: string) {
    const okResult = await call(`/api/onboarding/${onboardingId}`, { action });
    if (okResult) {
      setNotice(message);
      setTimeout(() => setNotice(null), 4000);
    }
  }

  return (
    <section className="card">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Onboarding</h2>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => resend('resend-information-request', 'Information request sent.')}
              disabled={busy}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Resend information request
            </button>
            {!welcomePackSentAt ? (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => resend('resend-welcome-pack', 'Welcome pack sent.')}
                disabled={busy}
              >
                Send welcome pack
              </button>
            ) : null}
            <button type="button" className="btn-secondary btn-sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add item
            </button>
          </div>
        </div>

        {/* Stage rail */}
        <ol className="mt-4 flex flex-wrap gap-1.5" aria-label="Onboarding stages">
          {ONBOARDING_STAGES.map((s, index) => {
            const state = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'todo';
            return (
              <li key={s}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => moveStage(s)}
                  className={cn(
                    'rounded-lg px-2.5 py-1.5 text-xs font-semibold transition',
                    state === 'done' && 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200',
                    state === 'current' && 'bg-brand-600 text-white',
                    state === 'todo' && 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                  )}
                >
                  {ONBOARDING_STAGE_LABELS[s]}
                </button>
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
          <span className="min-w-[180px] flex-1">
            <ProgressBar value={done} max={items.length} />
          </span>
          <span>
            {done} of {items.length} items complete
          </span>
          {targetCompleteAt ? <span>Target: {formatDate(targetCompleteAt)}</span> : null}
          {ownerName ? <span>Owner: {ownerName}</span> : null}
        </div>

        {blockers.length && stage !== 'COMPLETE' ? (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {blockers.length} required item{blockers.length === 1 ? '' : 's'} still outstanding at this
            stage: {blockers.map((b) => b.title).join(', ')}.
          </p>
        ) : null}

        {notice ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </p>
        ) : null}
      </div>

      {/* Checklist grouped by stage */}
      <div className="divide-y divide-slate-100">
        {ONBOARDING_STAGES.map((s) => {
          const stageItems = items.filter((i) => i.stage === s);
          if (!stageItems.length) return null;

          return (
            <div key={s} className="px-5 py-4">
              <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                {ONBOARDING_STAGE_LABELS[s]}
              </h3>
              <ul className="space-y-1.5">
                {stageItems.map((item) => {
                  const complete = ['APPROVED', 'WAIVED'].includes(item.status);
                  const overdue =
                    !complete && item.dueDate && new Date(item.dueDate) < new Date();

                  return (
                    <li
                      key={item.id}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border px-3 py-2.5 transition',
                        complete ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-white',
                      )}
                    >
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          // Cycle Pending -> Received -> Approved -> Pending.
                          const index = STATUS_ORDER.indexOf(item.status);
                          const next =
                            item.status === 'WAIVED'
                              ? 'PENDING'
                              : STATUS_ORDER[(index + 1) % 3] ?? 'PENDING';
                          void setItemStatus(item.id, next);
                        }}
                        aria-label={`Mark "${item.title}" as the next status`}
                        className={cn(
                          'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition',
                          item.status === 'APPROVED' && 'border-emerald-600 bg-emerald-600 text-white',
                          item.status === 'RECEIVED' && 'border-sky-500 bg-sky-500 text-white',
                          item.status === 'WAIVED' && 'border-slate-300 bg-slate-200 text-slate-500',
                          item.status === 'PENDING' && 'border-slate-300 bg-white hover:border-brand-400',
                        )}
                      >
                        {complete || item.status === 'RECEIVED' ? (
                          <Check className="h-3 w-3" aria-hidden />
                        ) : null}
                      </button>

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-sm',
                            complete ? 'text-slate-500 line-through' : 'font-medium text-slate-900',
                          )}
                        >
                          {item.title}
                          {!item.required ? (
                            <span className="ml-2 text-[10px] font-normal uppercase tracking-wide text-slate-400">
                              optional
                            </span>
                          ) : null}
                        </p>
                        {item.description ? (
                          <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                        ) : null}
                        <p className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                          <span className="capitalize">{item.type.toLowerCase()}</span>
                          <span aria-hidden>·</span>
                          <span className="capitalize">{item.status.toLowerCase()}</span>
                          {item.dueDate ? (
                            <>
                              <span aria-hidden>·</span>
                              <span className={overdue ? 'font-semibold text-red-600' : ''}>
                                due {formatDate(item.dueDate)}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-1">
                        {item.status !== 'WAIVED' && !item.required ? (
                          <button
                            type="button"
                            className="btn-ghost btn-sm text-slate-400"
                            title="Not applicable"
                            aria-label={`Waive "${item.title}"`}
                            onClick={() => setItemStatus(item.id, 'WAIVED')}
                            disabled={busy}
                          >
                            <SkipForward className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="btn-ghost btn-sm text-slate-400 hover:text-red-600"
                          aria-label={`Remove "${item.title}"`}
                          onClick={() => removeItem(item.id)}
                          disabled={busy}
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a checklist item">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            const created = await call(
              `/api/onboarding/${onboardingId}/items`,
              {
                title: form.get('title'),
                description: form.get('description') || null,
                stage: form.get('stage'),
                type: form.get('type'),
                required: form.get('required') === 'on',
                dueDate: form.get('dueDate') || null,
              },
              'POST',
            );
            if (created) setAddOpen(false);
          }}
          className="space-y-4"
        >
          <Field label="Title" required>
            <input name="title" className="input" required autoFocus />
          </Field>
          <Field label="Description">
            <textarea name="description" rows={2} className="input" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Stage">
              <select name="stage" className="input" defaultValue="INFORMATION_REQUESTED">
                {ONBOARDING_STAGES.map((s) => (
                  <option key={s} value={s}>
                    {ONBOARDING_STAGE_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Type">
              <select name="type" className="input" defaultValue="DOCUMENT">
                {ONBOARDING_ITEM_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Due date">
            <input name="dueDate" type="date" className="input" />
          </Field>
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              name="required"
              defaultChecked
              className="h-4 w-4 rounded border-slate-300 text-brand-600"
            />
            <span className="text-sm text-slate-600">Required before the stage can be left</span>
          </label>
          <FormError message={error} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              Add item
            </button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
