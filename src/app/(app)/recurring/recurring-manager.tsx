'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Pause, Play, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import { Avatar } from '@/components/ui';
import { describeRecurrence } from '@/lib/recurrence';
import { cn, formatDate, isoDate } from '@/lib/utils';
import {
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type RecurrenceFrequency,
  type TaskCategory,
  type TaskPriority,
} from '@/lib/constants';

type Template = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  clientColor: string | null;
  category: string;
  priority: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeColor: string | null;
  frequency: string;
  interval: number;
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  monthOfYear: number | null;
  leadTimeDays: number;
  estimateHours: number | null;
  subtaskTitles: string[];
  startDate: string;
  endDate: string | null;
  nextDueAt: string | null;
  lastRunAt: string | null;
  active: boolean;
  generatedCount: number;
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function RecurringManager({
  templates,
  clients,
  users,
  filterClientId,
  highlightId,
}: {
  templates: Template[];
  clients: { id: string; name: string; colorTag: string }[];
  users: { id: string; name: string; avatarColor: string }[];
  filterClientId: string | null;
  highlightId: string | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Template | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function toggleActive(template: Template) {
    setBusy(true);
    await submitJson(`/api/recurring/${template.id}`, { active: !template.active }, 'PATCH');
    setBusy(false);
    router.refresh();
  }

  async function remove(template: Template) {
    if (
      !confirm(
        `Stop generating "${template.name}"? The ${template.generatedCount} task${template.generatedCount === 1 ? '' : 's'} it already created stay where they are.`,
      )
    )
      return;
    setBusy(true);
    await submitJson(`/api/recurring/${template.id}`, undefined, 'DELETE');
    setBusy(false);
    router.refresh();
  }

  async function runNow() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/cron/run', { method: 'POST' });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? 'The job could not be run.');
      return;
    }
    setNotice(
      `Created ${data.recurringTasksCreated} task${data.recurringTasksCreated === 1 ? '' : 's'} and sent ${data.reminderEmailsSent} reminder email${data.reminderEmailsSent === 1 ? '' : 's'}.`,
    );
    setTimeout(() => setNotice(null), 6000);
    router.refresh();
  }

  const grouped = new Map<string, Template[]>();
  for (const template of templates) {
    const key = template.clientId ?? '__none__';
    grouped.set(key, [...(grouped.get(key) ?? []), template]);
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter by client"
          className={cn('input w-auto py-1.5 text-xs', filterClientId ? 'border-brand-400 bg-brand-50' : '')}
          value={filterClientId ?? ''}
          onChange={(e) => router.push(e.target.value ? `/recurring?client=${e.target.value}` : '/recurring')}
        >
          <option value="">All clients</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={runNow} disabled={busy}>
            <RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} aria-hidden />
            Run the job now
          </button>
          <button type="button" className="btn-primary btn-sm" onClick={() => setCreating(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New schedule
          </button>
        </div>
      </div>

      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {templates.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="text-sm font-semibold text-slate-700">No recurring work scheduled</p>
          <p className="mt-1 text-sm text-slate-500">
            The standard calendar installs itself when a client signs. Add your own schedules here.
          </p>
          <button type="button" className="btn-primary mt-4" onClick={() => setCreating(true)}>
            New schedule
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {[...grouped.entries()].map(([key, group]) => (
            <section key={key} className="card overflow-hidden">
              <div className="flex items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: group[0]!.clientColor ?? '#94a3b8' }}
                  aria-hidden
                />
                <span className="text-sm font-semibold text-slate-900">
                  {group[0]!.clientName ?? 'Firm-wide (no client)'}
                </span>
                <span className="text-xs text-slate-500">{group.length} schedule{group.length === 1 ? '' : 's'}</span>
                {key !== '__none__' ? (
                  <Link href={`/clients/${key}`} className="ml-auto text-xs text-brand-600 hover:underline">
                    Open client
                  </Link>
                ) : null}
              </div>

              <ul className="divide-y divide-slate-100">
                {group.map((template) => (
                  <li
                    key={template.id}
                    className={cn(
                      'flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-slate-50',
                      highlightId === template.id && 'bg-brand-50',
                      !template.active && 'opacity-60',
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setEditing(template)}
                        className="text-left text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {template.name}
                      </button>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                        <span>{describeRecurrence(template)}</span>
                        <span aria-hidden>·</span>
                        <span>{TASK_CATEGORY_LABELS[template.category as TaskCategory]}</span>
                        <span aria-hidden>·</span>
                        <span>raised {template.leadTimeDays}d ahead</span>
                        {template.subtaskTitles.length ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{template.subtaskTitles.length} subtasks</span>
                          </>
                        ) : null}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <p className="text-slate-500">Next due</p>
                      <p className="font-semibold text-slate-900">
                        {template.nextDueAt ? formatDate(template.nextDueAt) : '—'}
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <p className="text-slate-500">Generated</p>
                      <p className="font-semibold text-slate-900">{template.generatedCount}</p>
                    </div>

                    {template.assigneeName ? (
                      <Avatar name={template.assigneeName} color={template.assigneeColor ?? undefined} size="sm" />
                    ) : (
                      <span className="w-8 text-center text-[10px] text-amber-600">—</span>
                    )}

                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => toggleActive(template)}
                        disabled={busy}
                        aria-label={template.active ? `Pause ${template.name}` : `Resume ${template.name}`}
                        title={template.active ? 'Pause' : 'Resume'}
                      >
                        {template.active ? (
                          <Pause className="h-3.5 w-3.5" aria-hidden />
                        ) : (
                          <Play className="h-3.5 w-3.5" aria-hidden />
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn-ghost btn-sm text-slate-400 hover:text-red-600"
                        onClick={() => remove(template)}
                        disabled={busy}
                        aria-label={`Delete ${template.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <TemplateForm
        open={creating || Boolean(editing)}
        template={editing}
        clients={clients}
        users={users}
        defaultClientId={filterClientId}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={() => {
          setCreating(false);
          setEditing(null);
          router.refresh();
        }}
      />
    </>
  );
}

function TemplateForm({
  open,
  template,
  clients,
  users,
  defaultClientId,
  onClose,
  onSaved,
}: {
  open: boolean;
  template: Template | null;
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  defaultClientId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [frequency, setFrequency] = useState<string>(template?.frequency ?? 'MONTHLY');
  const [subtasks, setSubtasks] = useState<string[]>(template?.subtaskTitles ?? []);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form when a different template is opened.
  const [seed, setSeed] = useState(template?.id ?? 'new');
  if (open && seed !== (template?.id ?? 'new')) {
    setSeed(template?.id ?? 'new');
    setFrequency(template?.frequency ?? 'MONTHLY');
    setSubtasks(template?.subtaskTitles ?? []);
    setError(null);
  }

  const needsWeekday = ['WEEKLY', 'BIWEEKLY'].includes(frequency);
  const needsMonthDay = ['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL'].includes(frequency);
  const needsAnchorMonth = ['QUARTERLY', 'SEMIANNUAL', 'ANNUAL'].includes(frequency);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const payload = {
      name: form.get('name'),
      description: form.get('description') || null,
      clientId: form.get('clientId') || null,
      category: form.get('category'),
      priority: form.get('priority'),
      assigneeId: form.get('assigneeId') || null,
      frequency,
      interval: Number(form.get('interval') || 1),
      dayOfWeek: needsWeekday ? Number(form.get('dayOfWeek')) : null,
      dayOfMonth: needsMonthDay ? Number(form.get('dayOfMonth')) : null,
      monthOfYear: needsAnchorMonth ? Number(form.get('monthOfYear')) : null,
      leadTimeDays: Number(form.get('leadTimeDays') || 7),
      estimateHours: form.get('estimateHours') ? Number(form.get('estimateHours')) : null,
      subtaskTitles: subtasks,
      startDate: form.get('startDate') || null,
      endDate: form.get('endDate') || null,
      active: form.get('active') === 'on',
    };

    const result = template
      ? await submitJson(`/api/recurring/${template.id}`, payload, 'PATCH')
      : await submitJson('/api/recurring', payload);

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <Modal open={open} onClose={onClose} title={template ? 'Edit schedule' : 'New recurring schedule'} wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" required>
          <input name="name" className="input" required defaultValue={template?.name ?? ''} autoFocus />
        </Field>

        <Field label="Description">
          <textarea name="description" rows={2} className="input" defaultValue={template?.description ?? ''} />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" hint="Leave blank for firm-wide internal work.">
            <select name="clientId" className="input" defaultValue={template?.clientId ?? defaultClientId ?? ''}>
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assignee">
            <select name="assigneeId" className="input" defaultValue={template?.assigneeId ?? ''}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type">
            <select name="category" className="input" defaultValue={template?.category ?? 'BOOKKEEPING'}>
              {TASK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {TASK_CATEGORY_LABELS[category as TaskCategory]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <select name="priority" className="input" defaultValue={template?.priority ?? 'MEDIUM'}>
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority as TaskPriority]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="rounded-lg border border-slate-200 p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Schedule</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Frequency">
              <select
                className="input"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                {RECURRENCE_FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {RECURRENCE_FREQUENCY_LABELS[f as RecurrenceFrequency]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Repeat every" hint="1 = every period, 2 = every other, and so on.">
              <input
                name="interval"
                type="number"
                min="1"
                max="52"
                className="input"
                defaultValue={template?.interval ?? 1}
              />
            </Field>

            {needsWeekday ? (
              <Field label="Day of week">
                <select name="dayOfWeek" className="input" defaultValue={template?.dayOfWeek ?? 1}>
                  {WEEKDAYS.map((day, index) => (
                    <option key={day} value={index}>
                      {day}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            {needsMonthDay ? (
              <Field label="Day of month" hint="Clamped to the last day in shorter months.">
                <input
                  name="dayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  className="input"
                  defaultValue={template?.dayOfMonth ?? 7}
                />
              </Field>
            ) : null}

            {needsAnchorMonth ? (
              <Field label="Anchor month" hint="The first month of the cycle — e.g. February for Feb/May/Aug/Nov VAT.">
                <select name="monthOfYear" className="input" defaultValue={template?.monthOfYear ?? 1}>
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Raise the task this many days ahead" hint="Gives the team runway before the deadline.">
              <input
                name="leadTimeDays"
                type="number"
                min="0"
                max="120"
                className="input"
                defaultValue={template?.leadTimeDays ?? 7}
              />
            </Field>

            <Field label="Estimate (hours)">
              <input
                name="estimateHours"
                type="number"
                min="0"
                step="0.5"
                className="input"
                defaultValue={template?.estimateHours ?? ''}
              />
            </Field>

            <Field label="Start from">
              <input
                name="startDate"
                type="date"
                className="input"
                defaultValue={isoDate(template?.startDate ?? new Date())}
              />
            </Field>

            <Field label="Stop after" hint="Leave blank to run indefinitely.">
              <input name="endDate" type="date" className="input" defaultValue={isoDate(template?.endDate)} />
            </Field>
          </div>
        </div>

        <div>
          <span className="label">Subtasks cloned onto every generated task</span>
          {subtasks.length ? (
            <ul className="mb-2 space-y-1.5">
              {subtasks.map((title, index) => (
                <li
                  key={`${title}-${index}`}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-sm text-slate-700"
                >
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                  <button
                    type="button"
                    onClick={() => setSubtasks((s) => s.filter((_, i) => i !== index))}
                    className="btn-ghost btn-sm text-slate-400 hover:text-red-600"
                    aria-label={`Remove ${title}`}
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex gap-2">
            <input
              className="input"
              placeholder="Add a subtask and press Enter"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (draft.trim()) {
                    setSubtasks((s) => [...s, draft.trim()]);
                    setDraft('');
                  }
                }
              }}
            />
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => {
                if (draft.trim()) {
                  setSubtasks((s) => [...s, draft.trim()]);
                  setDraft('');
                }
              }}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2.5">
          <input
            type="checkbox"
            name="active"
            defaultChecked={template?.active ?? true}
            className="h-4 w-4 rounded border-slate-300 text-brand-600"
          />
          <span className="text-sm text-slate-600">Active — generate tasks on this schedule</span>
        </label>

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Saving…' : template ? 'Save changes' : 'Create schedule'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
