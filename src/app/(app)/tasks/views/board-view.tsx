'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListChecks, Repeat } from 'lucide-react';
import { Avatar, DueDate, PriorityBadge } from '@/components/ui';
import { submitJson } from '@/components/forms';
import { cn } from '@/lib/utils';
import { TASK_STATUSES, TASK_STATUS_LABELS, type TaskStatus } from '@/lib/constants';
import type { TaskRow } from '../types';

const ACCENT: Record<string, string> = {
  TODO: 'border-t-slate-400',
  IN_PROGRESS: 'border-t-sky-500',
  BLOCKED: 'border-t-red-500',
  REVIEW: 'border-t-amber-500',
  DONE: 'border-t-emerald-500',
};

/**
 * Kanban board. Cards carry their client colour so a column of mixed client
 * work is still readable at a glance. Dropping onto a column both moves the
 * status and writes the new position, so ordering survives a refresh.
 */
export function TaskBoardView({ tasks }: { tasks: TaskRow[] }) {
  const router = useRouter();
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const statusOf = (task: TaskRow) => pending[task.id] ?? task.status;

  async function move(taskId: string, status: string, beforeTaskId: string | null) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    setPending((p) => ({ ...p, [taskId]: status }));
    setError(null);

    const result = await submitJson('/api/tasks/reorder', { taskId, status, beforeTaskId });
    if (!result.ok) {
      setPending((p) => {
        const next = { ...p };
        delete next[taskId];
        return next;
      });
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="scroll-thin -mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
        {TASK_STATUSES.map((status) => {
          const columnTasks = tasks.filter((t) => statusOf(t) === status);
          const hours = columnTasks.reduce((s, t) => s + (t.estimateHours ?? 0), 0);

          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(status);
              }}
              onDragLeave={() => setDragOver((s) => (s === status ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                if (dragging) void move(dragging, status, null);
                setDragging(null);
              }}
              className={cn(
                'flex w-[300px] shrink-0 flex-col rounded-xl border border-t-4 bg-slate-100/60 transition',
                ACCENT[status] ?? 'border-t-slate-400',
                dragOver === status ? 'border-brand-400 bg-brand-50/60' : 'border-slate-200',
              )}
            >
              <div className="flex items-baseline justify-between px-3 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wide text-slate-600">
                  {TASK_STATUS_LABELS[status as TaskStatus]}
                  <span className="ml-1.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                    {columnTasks.length}
                  </span>
                </h2>
                {hours ? <span className="text-[11px] text-slate-500">{hours}h</span> : null}
              </div>

              <div className="scroll-thin flex-1 space-y-2 overflow-y-auto px-2 pb-3" style={{ maxHeight: '68vh' }}>
                {columnTasks.map((task) => {
                  const doneSubs = task.subtasks.filter((s) => s.status === 'DONE').length;

                  return (
                    <article
                      key={task.id}
                      draggable
                      onDragStart={() => setDragging(task.id)}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => e.stopPropagation()}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDragOver(null);
                        // Dropping onto a card inserts above it.
                        if (dragging && dragging !== task.id) void move(dragging, status, task.id);
                        setDragging(null);
                      }}
                      className={cn(
                        'cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-300 hover:shadow active:cursor-grabbing',
                        dragging === task.id && 'opacity-50',
                      )}
                    >
                      {task.client ? (
                        <Link
                          href={`/clients/${task.client.id}`}
                          className="mb-2 inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] font-medium"
                          style={{ backgroundColor: `${task.client.colorTag}18`, color: task.client.colorTag }}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: task.client.colorTag }}
                            aria-hidden
                          />
                          <span className="truncate">{task.client.name}</span>
                        </Link>
                      ) : null}

                      <Link href={`/tasks/${task.id}`} className="block">
                        <p className="text-sm font-medium leading-snug text-slate-900">{task.title}</p>
                      </Link>

                      <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        {task.subtasks.length ? (
                          <span className="inline-flex items-center gap-1">
                            <ListChecks className="h-3 w-3" aria-hidden />
                            {doneSubs}/{task.subtasks.length}
                          </span>
                        ) : null}
                        {task.source === 'RECURRING' ? (
                          <Repeat className="h-3 w-3 text-brand-500" aria-label="Recurring" />
                        ) : null}
                        {task.estimateHours ? <span>{task.estimateHours}h</span> : null}
                      </div>

                      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
                        <div className="flex items-center gap-1.5">
                          <PriorityBadge priority={task.priority} />
                          <DueDate date={task.dueDate} done={status === 'DONE'} />
                        </div>
                        {task.assignee ? (
                          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="sm" />
                        ) : null}
                      </div>
                    </article>
                  );
                })}

                {columnTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                    Drop a task here
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
