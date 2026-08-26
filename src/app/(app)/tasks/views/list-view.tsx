'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, ChevronRight, CornerDownRight, Plus } from 'lucide-react';
import { Avatar, DueDate, PriorityBadge, TaskStatusBadge } from '@/components/ui';
import { submitJson } from '@/components/forms';
import { cn } from '@/lib/utils';
import { TASK_CATEGORY_LABELS, type TaskCategory } from '@/lib/constants';
import type { TaskRow } from '../types';

/**
 * List view: every task sits under its client, exactly as the firm thinks
 * about the work. Subtasks expand inline and can be ticked off without
 * leaving the list.
 */
export function TaskListView({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  // Group by client, with unassigned work last.
  const groups = new Map<string, { name: string; colorTag: string; tasks: TaskRow[] }>();
  for (const task of tasks) {
    const key = task.client?.id ?? '__none__';
    if (!groups.has(key)) {
      groups.set(key, {
        name: task.client?.name ?? 'No client',
        colorTag: task.client?.colorTag ?? '#94a3b8',
        tasks: [],
      });
    }
    groups.get(key)!.tasks.push(task);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) =>
    a === '__none__' ? 1 : b === '__none__' ? -1 : 0,
  );

  function toggle(set: Set<string>, id: string, apply: (next: Set<string>) => void) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  }

  async function setStatus(taskId: string, status: string) {
    setBusy(taskId);
    await submitJson(`/api/tasks/${taskId}`, { status }, 'PATCH');
    setBusy(null);
    router.refresh();
  }

  async function addSubtask(parentId: string, title: string) {
    if (!title.trim()) return;
    setBusy(parentId);
    await submitJson(`/api/tasks/${parentId}/subtasks`, { title });
    setBusy(null);
    setAdding(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {ordered.map(([key, group]) => {
        const collapsed = collapsedGroups.has(key);
        const open = group.tasks.filter((t) => t.status !== 'DONE').length;

        return (
          <section key={key} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(collapsedGroups, key, setCollapsedGroups)}
              aria-expanded={!collapsed}
              className="flex w-full items-center gap-2.5 border-b border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden />
              )}
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: group.colorTag }} aria-hidden />
              <span className="text-sm font-semibold text-slate-900">{group.name}</span>
              <span className="text-xs text-slate-500">
                {open} open · {group.tasks.length} total
              </span>
              {key !== '__none__' ? (
                <Link
                  href={`/clients/${key}`}
                  className="ml-auto text-xs text-brand-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  Open client
                </Link>
              ) : null}
            </button>

            {collapsed ? null : (
              <ul className="divide-y divide-slate-100">
                {group.tasks.map((task) => {
                  const isExpanded = expanded.has(task.id);
                  const doneSubs = task.subtasks.filter((s) => s.status === 'DONE').length;
                  const isDone = task.status === 'DONE';

                  return (
                    <li key={task.id}>
                      <div
                        className={cn(
                          'flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-slate-50',
                          isDone && 'opacity-60',
                        )}
                      >
                        <button
                          type="button"
                          disabled={busy === task.id}
                          onClick={() => setStatus(task.id, isDone ? 'TODO' : 'DONE')}
                          aria-label={isDone ? `Reopen ${task.title}` : `Complete ${task.title}`}
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition',
                            isDone
                              ? 'border-emerald-600 bg-emerald-600 text-white'
                              : 'border-slate-300 hover:border-brand-500',
                          )}
                        >
                          {isDone ? <Check className="h-3 w-3" aria-hidden /> : null}
                        </button>

                        {task.subtasks.length ? (
                          <button
                            type="button"
                            onClick={() => toggle(expanded, task.id, setExpanded)}
                            aria-expanded={isExpanded}
                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} subtasks`}
                            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        ) : (
                          <span className="w-[22px] shrink-0" aria-hidden />
                        )}

                        <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 group">
                          <p
                            className={cn(
                              'truncate text-sm text-slate-900 group-hover:text-brand-700',
                              isDone && 'line-through',
                            )}
                          >
                            {task.title}
                          </p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-400">
                            <span>{task.reference}</span>
                            <span aria-hidden>·</span>
                            <span>{TASK_CATEGORY_LABELS[task.category as TaskCategory] ?? task.category}</span>
                            {task.subtasks.length ? (
                              <>
                                <span aria-hidden>·</span>
                                <span>
                                  {doneSubs}/{task.subtasks.length} subtasks
                                </span>
                              </>
                            ) : null}
                            {task.source === 'RECURRING' ? (
                              <>
                                <span aria-hidden>·</span>
                                <span className="text-brand-500">recurring</span>
                              </>
                            ) : null}
                          </p>
                        </Link>

                        <div className="hidden shrink-0 items-center gap-2 sm:flex">
                          <TaskStatusBadge status={task.status} />
                          <PriorityBadge priority={task.priority} />
                        </div>
                        <DueDate date={task.dueDate} done={isDone} />
                        {task.assignee ? (
                          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="sm" />
                        ) : (
                          <span className="w-6 shrink-0" aria-hidden />
                        )}
                      </div>

                      {isExpanded ? (
                        <ul className="border-t border-slate-100 bg-slate-50/60">
                          {task.subtasks.map((sub) => {
                            const subDone = sub.status === 'DONE';
                            return (
                              <li
                                key={sub.id}
                                className="flex items-center gap-2.5 py-2 pl-14 pr-4 transition hover:bg-slate-100/70"
                              >
                                <button
                                  type="button"
                                  disabled={busy === sub.id}
                                  onClick={() => setStatus(sub.id, subDone ? 'TODO' : 'DONE')}
                                  aria-label={subDone ? `Reopen ${sub.title}` : `Complete ${sub.title}`}
                                  className={cn(
                                    'flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition',
                                    subDone
                                      ? 'border-emerald-600 bg-emerald-600 text-white'
                                      : 'border-slate-300 hover:border-brand-500',
                                  )}
                                >
                                  {subDone ? <Check className="h-2.5 w-2.5" aria-hidden /> : null}
                                </button>
                                <CornerDownRight className="h-3 w-3 shrink-0 text-slate-300" aria-hidden />
                                <span
                                  className={cn(
                                    'min-w-0 flex-1 truncate text-sm',
                                    subDone ? 'text-slate-400 line-through' : 'text-slate-700',
                                  )}
                                >
                                  {sub.title}
                                </span>
                                <DueDate date={sub.dueDate} done={subDone} />
                                {sub.assignee ? (
                                  <Avatar name={sub.assignee.name} color={sub.assignee.avatarColor} size="sm" />
                                ) : null}
                              </li>
                            );
                          })}

                          <li className="py-2 pl-14 pr-4">
                            {adding === task.id ? (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  const input = new FormData(e.currentTarget).get('title') as string;
                                  void addSubtask(task.id, input);
                                }}
                                className="flex gap-2"
                              >
                                <input
                                  name="title"
                                  className="input py-1 text-xs"
                                  placeholder="Subtask title"
                                  autoFocus
                                  onBlur={(e) => {
                                    if (!e.target.value) setAdding(null);
                                  }}
                                />
                                <button type="submit" className="btn-primary btn-sm">
                                  Add
                                </button>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAdding(task.id)}
                                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600"
                              >
                                <Plus className="h-3 w-3" aria-hidden />
                                Add a subtask
                              </button>
                            )}
                          </li>
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
