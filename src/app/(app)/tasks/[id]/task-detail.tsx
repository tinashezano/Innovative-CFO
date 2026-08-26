'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, Check, Plus, Trash2 } from 'lucide-react';
import { Avatar, DueDate, ProgressBar } from '@/components/ui';
import { Field, FormError, submitJson } from '@/components/forms';
import { cn, formatDate, formatDateTime, isoDate } from '@/lib/utils';
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type TaskCategory,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants';

type Task = {
  id: string;
  reference: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  clientId: string | null;
  assigneeId: string | null;
  startDate: string | null;
  dueDate: string | null;
  estimateHours: number | null;
  actualHours: number | null;
  labels: string | null;
  parentId: string | null;
  createdByName: string | null;
  createdAt: string;
  completedAt: string | null;
};

export function TaskDetail({
  task,
  subtasks,
  comments,
  reminders,
  links,
  clients,
  users,
}: {
  task: Task;
  subtasks: {
    id: string;
    reference: string;
    title: string;
    status: string;
    dueDate: string | null;
    assignee: { id: string; name: string; avatarColor: string } | null;
  }[];
  comments: { id: string; body: string; createdAt: string; userName: string; userColor: string }[];
  reminders: {
    id: string;
    kind: string;
    offsetDays: number;
    scheduledFor: string;
    status: string;
    sentAt: string | null;
  }[];
  links: {
    lead: { id: string; label: string } | null;
    proposal: { id: string; label: string } | null;
    client: { id: string; label: string } | null;
  };
  clients: { id: string; name: string }[];
  users: { id: string; name: string; avatarColor: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [description, setDescription] = useState(task.description ?? '');
  const [descDirty, setDescDirty] = useState(false);

  const doneSubs = subtasks.filter((s) => s.status === 'DONE').length;

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await submitJson(`/api/tasks/${task.id}`, body, 'PATCH');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    router.refresh();
    return true;
  }

  async function addSubtask() {
    if (!subtaskDraft.trim()) return;
    setBusy(true);
    const result = await submitJson(`/api/tasks/${task.id}/subtasks`, { title: subtaskDraft });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubtaskDraft('');
    router.refresh();
  }

  async function toggleSubtask(id: string, status: string) {
    setBusy(true);
    await submitJson(`/api/tasks/${id}`, { status: status === 'DONE' ? 'TODO' : 'DONE' }, 'PATCH');
    setBusy(false);
    router.refresh();
  }

  async function addComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    const result = await submitJson(`/api/tasks/${task.id}/comments`, { body: comment });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setComment('');
    router.refresh();
  }

  async function remove() {
    if (!confirm('Delete this task and its subtasks? This cannot be undone.')) return;
    setBusy(true);
    const result = await submitJson(`/api/tasks/${task.id}`, undefined, 'DELETE');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push('/tasks');
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {/* Status rail */}
        <section className="card card-pad">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Task status">
            {TASK_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                disabled={busy}
                onClick={() => patch({ status })}
                aria-pressed={task.status === status}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                  task.status === status
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                )}
              >
                {TASK_STATUS_LABELS[status as TaskStatus]}
              </button>
            ))}
          </div>
          {task.completedAt ? (
            <p className="mt-3 text-xs text-emerald-700">Completed {formatDateTime(task.completedAt)}</p>
          ) : null}
          {error ? (
            <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </section>

        {/* Description */}
        <section className="card card-pad">
          <h2 className="mb-2 text-sm font-semibold text-slate-900">Description</h2>
          <textarea
            className="input"
            rows={5}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setDescDirty(true);
            }}
            placeholder="What needs doing, and what does done look like?"
          />
          {descDirty ? (
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="btn-primary btn-sm"
                disabled={busy}
                onClick={async () => {
                  if (await patch({ description: description || null })) setDescDirty(false);
                }}
              >
                Save
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => {
                  setDescription(task.description ?? '');
                  setDescDirty(false);
                }}
              >
                Cancel
              </button>
            </div>
          ) : null}
        </section>

        {/* Subtasks */}
        {!task.parentId ? (
          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-900">
                  Subtasks
                  {subtasks.length ? (
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {doneSubs}/{subtasks.length}
                    </span>
                  ) : null}
                </h2>
              </div>
              {subtasks.length ? (
                <div className="mt-2">
                  <ProgressBar value={doneSubs} max={subtasks.length} />
                </div>
              ) : null}
            </div>

            <ul className="divide-y divide-slate-100">
              {subtasks.map((sub) => {
                const done = sub.status === 'DONE';
                return (
                  <li key={sub.id} className="flex items-center gap-3 px-5 py-2.5">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => toggleSubtask(sub.id, sub.status)}
                      aria-label={done ? `Reopen ${sub.title}` : `Complete ${sub.title}`}
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition',
                        done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 hover:border-brand-500',
                      )}
                    >
                      {done ? <Check className="h-3 w-3" aria-hidden /> : null}
                    </button>
                    <Link
                      href={`/tasks/${sub.id}`}
                      className={cn(
                        'min-w-0 flex-1 truncate text-sm hover:text-brand-700',
                        done ? 'text-slate-400 line-through' : 'text-slate-800',
                      )}
                    >
                      {sub.title}
                    </Link>
                    <DueDate date={sub.dueDate} done={done} />
                    {sub.assignee ? (
                      <Avatar name={sub.assignee.name} color={sub.assignee.avatarColor} size="sm" />
                    ) : null}
                  </li>
                );
              })}
            </ul>

            <div className="border-t border-slate-100 px-5 py-3">
              <div className="flex gap-2">
                <input
                  className="input py-1.5 text-sm"
                  placeholder="Add a subtask"
                  value={subtaskDraft}
                  onChange={(e) => setSubtaskDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void addSubtask();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-secondary btn-sm shrink-0"
                  onClick={addSubtask}
                  disabled={busy || !subtaskDraft.trim()}
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  Add
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* Comments */}
        <section className="card">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Comments</h2>
          </div>

          <form onSubmit={addComment} className="border-b border-slate-100 px-5 py-4">
            <textarea
              className="input"
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Leave a note for whoever picks this up…"
            />
            <div className="mt-2 flex justify-end">
              <button type="submit" className="btn-primary btn-sm" disabled={busy || !comment.trim()}>
                Comment
              </button>
            </div>
          </form>

          {comments.length ? (
            <ul className="divide-y divide-slate-100">
              {comments.map((entry) => (
                <li key={entry.id} className="flex gap-3 px-5 py-3.5">
                  <Avatar name={entry.userName} color={entry.userColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900">
                      {entry.userName}
                      <span className="ml-2 font-normal text-slate-400">
                        {formatDateTime(entry.createdAt)}
                      </span>
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{entry.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-sm text-slate-500">No comments yet.</p>
          )}
        </section>
      </div>

      {/* Right rail */}
      <div className="space-y-6">
        <section className="card card-pad space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Details</h2>

          <Field label="Assignee">
            <select
              className="input"
              value={task.assigneeId ?? ''}
              disabled={busy}
              onChange={(e) => patch({ assigneeId: e.target.value || null })}
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Client">
            <select
              className="input"
              value={task.clientId ?? ''}
              disabled={busy || Boolean(task.parentId)}
              onChange={(e) => patch({ clientId: e.target.value || null })}
            >
              <option value="">No client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select
                className="input"
                value={task.priority}
                disabled={busy}
                onChange={(e) => patch({ priority: e.target.value })}
              >
                {TASK_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {TASK_PRIORITY_LABELS[priority as TaskPriority]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Type">
              <select
                className="input"
                value={task.category}
                disabled={busy}
                onChange={(e) => patch({ category: e.target.value })}
              >
                {TASK_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {TASK_CATEGORY_LABELS[category as TaskCategory]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Start date">
              <input
                type="date"
                className="input"
                defaultValue={isoDate(task.startDate)}
                disabled={busy}
                onChange={(e) => patch({ startDate: e.target.value || null })}
              />
            </Field>

            <Field label="Due date">
              <input
                type="date"
                className="input"
                defaultValue={isoDate(task.dueDate)}
                disabled={busy}
                onChange={(e) => patch({ dueDate: e.target.value || null })}
              />
            </Field>

            <Field label="Estimate (h)">
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                defaultValue={task.estimateHours ?? ''}
                disabled={busy}
                onBlur={(e) => patch({ estimateHours: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>

            <Field label="Actual (h)">
              <input
                type="number"
                min="0"
                step="0.5"
                className="input"
                defaultValue={task.actualHours ?? ''}
                disabled={busy}
                onBlur={(e) => patch({ actualHours: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
          </div>

          <Field label="Labels" hint="Comma separated.">
            <input
              className="input"
              defaultValue={task.labels ?? ''}
              disabled={busy}
              onBlur={(e) => patch({ labels: e.target.value || null })}
            />
          </Field>

          <p className="border-t border-slate-100 pt-3 text-xs text-slate-400">
            Created {formatDate(task.createdAt)}
            {task.createdByName ? ` by ${task.createdByName}` : ''}
          </p>
        </section>

        {/* Reminders */}
        <section className="card">
          <div className="border-b border-slate-200 px-5 py-3.5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              <Bell className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              Reminder emails
            </h2>
          </div>
          {reminders.length ? (
            <ul className="divide-y divide-slate-100">
              {reminders.map((reminder) => (
                <li key={reminder.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800">
                      {reminder.kind === 'OVERDUE'
                        ? 'Overdue chase-up'
                        : reminder.kind === 'DUE_TODAY'
                          ? 'On the due date'
                          : `${reminder.offsetDays} day${reminder.offsetDays === 1 ? '' : 's'} before`}
                    </p>
                    <p className="text-[11px] text-slate-400">{formatDate(reminder.scheduledFor)}</p>
                  </div>
                  <span
                    className={cn(
                      'badge shrink-0',
                      reminder.status === 'SENT'
                        ? 'bg-emerald-100 text-emerald-800'
                        : reminder.status === 'SCHEDULED'
                          ? 'bg-sky-100 text-sky-800'
                          : reminder.status === 'FAILED'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {reminder.status.toLowerCase()}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-center text-xs text-slate-500">
              Reminders are scheduled once the task has a due date and an assignee.
            </p>
          )}
        </section>

        {/* Linked records */}
        {links.client || links.lead || links.proposal ? (
          <section className="card card-pad">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">Linked to</h2>
            <ul className="space-y-2 text-sm">
              {links.client ? (
                <li>
                  <Link href={`/clients/${links.client.id}`} className="link">
                    Client: {links.client.label}
                  </Link>
                </li>
              ) : null}
              {links.lead ? (
                <li>
                  <Link href={`/leads/${links.lead.id}`} className="link">
                    Lead: {links.lead.label}
                  </Link>
                </li>
              ) : null}
              {links.proposal ? (
                <li>
                  <Link href={`/proposals/${links.proposal.id}`} className="link">
                    Proposal: {links.proposal.label}
                  </Link>
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}

        <button type="button" className="btn-danger w-full" onClick={remove} disabled={busy}>
          <Trash2 className="h-4 w-4" aria-hidden />
          Delete task
        </button>
      </div>
    </div>
  );
}
