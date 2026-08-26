'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, isoDate, startOfDay } from '@/lib/utils';
import { TASK_PRIORITY_RANK, type TaskPriority } from '@/lib/constants';
import type { TaskRow } from '../types';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const PRIORITY_BAR: Record<string, string> = {
  URGENT: 'bg-red-500',
  HIGH: 'bg-amber-500',
  MEDIUM: 'bg-sky-500',
  LOW: 'bg-slate-400',
};

/**
 * Month calendar keyed on due date. Weeks start on Monday, which is how an
 * accounting calendar actually runs. Days with more than three tasks collapse
 * into a "+N more" that opens the day.
 */
export function TaskCalendarView({ tasks }: { tasks: TaskRow[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [openDay, setOpenDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, TaskRow[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const key = isoDate(task.dueDate);
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    // Most urgent first within a day.
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          (TASK_PRIORITY_RANK[b.priority as TaskPriority] ?? 0) -
          (TASK_PRIORITY_RANK[a.priority as TaskPriority] ?? 0),
      );
    }
    return map;
  }, [tasks]);

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Monday-first offset: JS getDay() is Sunday-first.
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(start.getDate() - offset);

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);

  const today = startOfDay(new Date());
  const noDueDate = tasks.filter((t) => !t.dueDate);
  const openDayTasks = openDay ? (byDay.get(openDay) ?? []) : [];

  return (
    <>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {cursor.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })}
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="btn-ghost btn-sm"
              aria-label="Previous month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => setCursor(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
            >
              Today
            </button>
            <button
              type="button"
              className="btn-ghost btn-sm"
              aria-label="Next month"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((day) => (
            <div key={day} className="px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {grid.map((date) => {
            const key = isoDate(date);
            const dayTasks = byDay.get(key) ?? [];
            const inMonth = date.getMonth() === cursor.getMonth();
            const isToday = key === isoDate(today);
            const isPast = date < today;

            return (
              <div
                key={key}
                className={cn(
                  'min-h-[104px] border-b border-r border-slate-100 p-1.5',
                  !inMonth && 'bg-slate-50/70',
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                      isToday ? 'bg-brand-600 text-white' : inMonth ? 'text-slate-700' : 'text-slate-400',
                    )}
                  >
                    {date.getDate()}
                  </span>
                  {dayTasks.length > 3 ? (
                    <button
                      type="button"
                      onClick={() => setOpenDay(key)}
                      className="text-[10px] font-semibold text-brand-600 hover:underline"
                    >
                      +{dayTasks.length - 3}
                    </button>
                  ) : null}
                </div>

                <ul className="space-y-1">
                  {dayTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        title={`${task.title}${task.client ? ` — ${task.client.name}` : ''}`}
                        className={cn(
                          'flex items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight transition hover:bg-slate-100',
                          task.status === 'DONE' && 'opacity-50 line-through',
                          isPast && task.status !== 'DONE' && 'bg-red-50',
                        )}
                      >
                        <span
                          className={cn('h-3 w-0.5 shrink-0 rounded', PRIORITY_BAR[task.priority] ?? 'bg-slate-400')}
                          aria-hidden
                        />
                        {task.client ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: task.client.colorTag }}
                            aria-hidden
                          />
                        ) : null}
                        <span className="truncate text-slate-700">{task.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {noDueDate.length ? (
        <section className="card mt-4">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">
              No due date
              <span className="ml-2 text-xs font-normal text-slate-500">{noDueDate.length}</span>
            </h2>
          </div>
          <ul className="flex flex-wrap gap-2 p-4">
            {noDueDate.map((task) => (
              <li key={task.id}>
                <Link
                  href={`/tasks/${task.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
                >
                  {task.client ? (
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: task.client.colorTag }}
                      aria-hidden
                    />
                  ) : null}
                  {task.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {openDay ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setOpenDay(null)}
          />
          <div className="relative z-10 max-h-[70vh] w-full max-w-md overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
            <h2 className="mb-3 text-sm font-semibold text-slate-900">
              {new Date(`${openDay}T00:00:00`).toLocaleDateString('en-ZA', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </h2>
            <ul className="space-y-1.5">
              {openDayTasks.map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm transition hover:border-brand-300 hover:bg-brand-50"
                  >
                    <span
                      className={cn('h-4 w-0.5 shrink-0 rounded', PRIORITY_BAR[task.priority] ?? 'bg-slate-400')}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-900">{task.title}</span>
                      {task.client ? (
                        <span className="block text-xs text-slate-500">{task.client.name}</span>
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}
