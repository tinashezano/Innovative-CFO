'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { addDays, cn, formatDate, isoDate, startOfDay } from '@/lib/utils';
import type { TaskRow } from '../types';

const PRIORITY_BAR: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-amber-500',
  MEDIUM: 'bg-sky-500',
  LOW: 'bg-slate-400',
};

const RANGES = [
  { key: '4w', label: '4 weeks', days: 28 },
  { key: '8w', label: '8 weeks', days: 56 },
  { key: '12w', label: '12 weeks', days: 84 },
] as const;

/**
 * Gantt-style timeline. A task spans from its start date to its due date;
 * tasks with only a due date render as a single-day marker so nothing goes
 * missing. Rows are grouped by client, matching the rest of the app.
 */
export function TaskTimelineView({ tasks }: { tasks: TaskRow[] }) {
  const [rangeKey, setRangeKey] = useState<(typeof RANGES)[number]['key']>('8w');
  const [offsetWeeks, setOffsetWeeks] = useState(0);

  const range = RANGES.find((r) => r.key === rangeKey)!;

  const { start, days } = useMemo(() => {
    const today = startOfDay(new Date());
    // Snap the window to the Monday of the current week.
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    const windowStart = addDays(monday, offsetWeeks * 7 - 7);
    return {
      start: windowStart,
      days: Array.from({ length: range.days }, (_, i) => addDays(windowStart, i)),
    };
  }, [range.days, offsetWeeks]);

  const end = addDays(start, range.days - 1);
  const today = startOfDay(new Date());

  const scheduled = tasks.filter((t) => t.dueDate || t.startDate);

  const groups = useMemo(() => {
    const map = new Map<string, { name: string; colorTag: string; tasks: TaskRow[] }>();
    for (const task of scheduled) {
      const key = task.client?.id ?? '__none__';
      if (!map.has(key)) {
        map.set(key, {
          name: task.client?.name ?? 'No client',
          colorTag: task.client?.colorTag ?? '#94a3b8',
          tasks: [],
        });
      }
      map.get(key)!.tasks.push(task);
    }
    for (const group of map.values()) {
      group.tasks.sort((a, b) => {
        const aDate = new Date(a.startDate ?? a.dueDate!).getTime();
        const bDate = new Date(b.startDate ?? b.dueDate!).getTime();
        return aDate - bDate;
      });
    }
    return [...map.entries()].sort(([a], [b]) => (a === '__none__' ? 1 : b === '__none__' ? -1 : 0));
  }, [scheduled]);

  /** Column span for a task, clipped to the visible window. */
  function bar(task: TaskRow): { offset: number; span: number; clippedStart: boolean; clippedEnd: boolean } | null {
    const rawStart = startOfDay(new Date(task.startDate ?? task.dueDate!));
    const rawEnd = startOfDay(new Date(task.dueDate ?? task.startDate!));
    const from = rawStart <= rawEnd ? rawStart : rawEnd;
    const to = rawStart <= rawEnd ? rawEnd : rawStart;

    if (to < start || from > end) return null;

    const clippedStart = from < start;
    const clippedEnd = to > end;
    const visibleFrom = clippedStart ? start : from;
    const visibleTo = clippedEnd ? end : to;

    const offset = Math.round((visibleFrom.getTime() - start.getTime()) / 86400000);
    const span = Math.max(1, Math.round((visibleTo.getTime() - visibleFrom.getTime()) / 86400000) + 1);

    return { offset, span, clippedStart, clippedEnd };
  }

  const dayWidth = 26;
  const gridWidth = range.days * dayWidth;

  // Month header segments across the window.
  const months: { label: string; span: number }[] = [];
  for (const day of days) {
    const label = day.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' });
    const last = months.at(-1);
    if (last && last.label === label) last.span += 1;
    else months.push({ label, span: 1 });
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">
          {formatDate(start)} – {formatDate(end)}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRangeKey(r.key)}
                className={cn(
                  'rounded px-2 py-1 text-[11px] font-semibold transition',
                  rangeKey === r.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            aria-label="Earlier"
            onClick={() => setOffsetWeeks((w) => w - 2)}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <button type="button" className="btn-secondary btn-sm" onClick={() => setOffsetWeeks(0)}>
            Today
          </button>
          <button
            type="button"
            className="btn-ghost btn-sm"
            aria-label="Later"
            onClick={() => setOffsetWeeks((w) => w + 2)}
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <div className="scroll-thin overflow-x-auto">
        <div style={{ minWidth: gridWidth + 260 }}>
          {/* Header */}
          <div className="sticky top-0 z-10 flex border-b border-slate-200 bg-slate-50">
            <div className="w-[260px] shrink-0 border-r border-slate-200 px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Task
            </div>
            <div style={{ width: gridWidth }}>
              <div className="flex border-b border-slate-100">
                {months.map((month, index) => (
                  <div
                    key={`${month.label}-${index}`}
                    style={{ width: month.span * dayWidth }}
                    className="border-r border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600"
                  >
                    {month.label}
                  </div>
                ))}
              </div>
              <div className="flex">
                {days.map((day) => {
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = isoDate(day) === isoDate(today);
                  return (
                    <div
                      key={day.toISOString()}
                      style={{ width: dayWidth }}
                      className={cn(
                        'border-r border-slate-100 py-1 text-center text-[10px]',
                        weekend ? 'bg-slate-100 text-slate-400' : 'text-slate-500',
                        isToday && 'bg-brand-100 font-bold text-brand-700',
                      )}
                    >
                      {day.getDate()}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Rows */}
          {groups.map(([key, group]) => (
            <div key={key}>
              <div className="flex border-b border-slate-200 bg-slate-50/70">
                <div className="flex w-[260px] shrink-0 items-center gap-2 border-r border-slate-200 px-4 py-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: group.colorTag }}
                    aria-hidden
                  />
                  <span className="truncate text-xs font-bold text-slate-700">{group.name}</span>
                </div>
                <div style={{ width: gridWidth }} />
              </div>

              {group.tasks.map((task) => {
                const placement = bar(task);
                const overdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'DONE';

                return (
                  <div key={task.id} className="flex border-b border-slate-100 transition hover:bg-slate-50">
                    <div className="flex w-[260px] shrink-0 items-center gap-2 border-r border-slate-200 px-4 py-2">
                      <Link
                        href={`/tasks/${task.id}`}
                        className="min-w-0 flex-1 truncate text-xs text-slate-800 hover:text-brand-700"
                        title={task.title}
                      >
                        {task.title}
                      </Link>
                      {task.assignee ? (
                        <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="sm" />
                      ) : null}
                    </div>

                    <div className="relative" style={{ width: gridWidth, height: 34 }}>
                      {/* Weekend + today shading */}
                      <div className="absolute inset-0 flex">
                        {days.map((day) => {
                          const weekend = day.getDay() === 0 || day.getDay() === 6;
                          const isToday = isoDate(day) === isoDate(today);
                          return (
                            <div
                              key={day.toISOString()}
                              style={{ width: dayWidth }}
                              className={cn(
                                'border-r border-slate-50',
                                weekend && 'bg-slate-50',
                                isToday && 'bg-brand-50',
                              )}
                            />
                          );
                        })}
                      </div>

                      {placement ? (
                        <Link
                          href={`/tasks/${task.id}`}
                          title={`${task.title} · ${formatDate(task.startDate ?? task.dueDate)} → ${formatDate(task.dueDate)}`}
                          className={cn(
                            'absolute top-1.5 flex h-[22px] items-center gap-1 px-1.5 text-[10px] font-medium text-white shadow-sm transition hover:brightness-110',
                            task.status === 'DONE' ? 'bg-emerald-500' : (PRIORITY_BAR[task.priority] ?? 'bg-slate-400'),
                            overdue && 'ring-2 ring-red-300',
                            placement.clippedStart ? 'rounded-l-none' : 'rounded-l',
                            placement.clippedEnd ? 'rounded-r-none' : 'rounded-r',
                          )}
                          style={{
                            left: placement.offset * dayWidth + 1,
                            width: placement.span * dayWidth - 2,
                          }}
                        >
                          <span className="truncate">{task.title}</span>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {!scheduled.length ? (
        <p className="px-5 py-12 text-center text-sm text-slate-500">
          No tasks have dates yet. Give a task a start and due date and it appears here.
        </p>
      ) : null}
    </div>
  );
}
