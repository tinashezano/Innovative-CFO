'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Modal } from '@/components/modal';
import { Field, FormError, submitJson } from '@/components/forms';
import {
  TASK_CATEGORIES,
  TASK_CATEGORY_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskCategory,
  type TaskPriority,
} from '@/lib/constants';

export function NewTaskModal({
  open,
  onClose,
  clients,
  users,
  currentUserId,
  defaultClientId,
}: {
  open: boolean;
  onClose: () => void;
  clients: { id: string; name: string }[];
  users: { id: string; name: string }[];
  currentUserId: string;
  defaultClientId?: string | null;
}) {
  const router = useRouter();
  const [subtasks, setSubtasks] = useState<string[]>([]);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addSubtask() {
    const value = subtaskDraft.trim();
    if (!value) return;
    setSubtasks((s) => [...s, value]);
    setSubtaskDraft('');
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await submitJson('/api/tasks', {
      title: form.get('title'),
      description: form.get('description') || null,
      clientId: form.get('clientId') || null,
      priority: form.get('priority'),
      category: form.get('category'),
      assigneeId: form.get('assigneeId') || null,
      startDate: form.get('startDate') || null,
      dueDate: form.get('dueDate') || null,
      estimateHours: form.get('estimateHours') ? Number(form.get('estimateHours')) : null,
      labels: form.get('labels') || null,
      subtaskTitles: subtasks,
    });

    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSubtasks([]);
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="New task" wide>
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Title" required>
          <input name="title" className="input" required autoFocus />
        </Field>

        <Field label="Description">
          <textarea name="description" rows={3} className="input" />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Client" hint="Tasks are grouped by client everywhere in the app.">
            <select name="clientId" className="input" defaultValue={defaultClientId ?? ''}>
              <option value="">No client (internal)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Assignee">
            <select name="assigneeId" className="input" defaultValue={currentUserId}>
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type">
            <select name="category" className="input" defaultValue="OTHER">
              {TASK_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {TASK_CATEGORY_LABELS[category as TaskCategory]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Priority">
            <select name="priority" className="input" defaultValue="MEDIUM">
              {TASK_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {TASK_PRIORITY_LABELS[priority as TaskPriority]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Start date">
            <input name="startDate" type="date" className="input" />
          </Field>

          <Field label="Due date" hint="Reminder emails are scheduled from this date.">
            <input name="dueDate" type="date" className="input" />
          </Field>

          <Field label="Estimate (hours)">
            <input name="estimateHours" type="number" min="0" step="0.5" className="input" />
          </Field>

          <Field label="Labels" hint="Comma separated.">
            <input name="labels" className="input" placeholder="year-end, urgent" />
          </Field>
        </div>

        <div>
          <span className="label">Subtasks</span>
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
                    aria-label={`Remove subtask ${title}`}
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
              value={subtaskDraft}
              onChange={(e) => setSubtaskDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
            />
            <button type="button" className="btn-secondary shrink-0" onClick={addSubtask}>
              <Plus className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <FormError message={error} />

        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? 'Creating…' : 'Create task'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
