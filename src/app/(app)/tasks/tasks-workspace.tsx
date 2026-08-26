'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, Columns3, GanttChart, List, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FilterOptions, TaskRow } from './types';
import { TaskListView } from './views/list-view';
import { TaskBoardView } from './views/board-view';
import { TaskCalendarView } from './views/calendar-view';
import { TaskTimelineView } from './views/timeline-view';
import { NewTaskModal } from './new-task-modal';
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

const VIEWS = [
  { key: 'list', label: 'List', icon: List },
  { key: 'board', label: 'Board', icon: Columns3 },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'timeline', label: 'Timeline', icon: GanttChart },
] as const;

export function TasksWorkspace({
  tasks,
  options,
  currentUserId,
  view,
}: {
  tasks: TaskRow[];
  options: FilterOptions;
  currentUserId: string;
  view: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);

  /** Rewrites one query parameter, preserving the rest. */
  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value) next.delete(key);
      else next.set(key, value);
      router.push(`${pathname}?${next.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const activeFilters = useMemo(
    () =>
      ['client', 'assignee', 'status', 'priority', 'category', 'due', 'q'].filter((key) =>
        searchParams.get(key),
      ),
    [searchParams],
  );

  const currentView = view;

  return (
    <>
      {/* View switcher + filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5" role="tablist">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const active = currentView === item.key;
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setParam('view', item.key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition',
                  active ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            defaultValue={searchParams.get('q') ?? ''}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="input w-44 py-1.5 text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setParam('q', (e.target as HTMLInputElement).value || null);
            }}
          />

          <Select
            label="Client"
            value={searchParams.get('client')}
            onChange={(v) => setParam('client', v)}
            options={[
              { value: 'none', label: 'No client' },
              ...options.clients.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />

          <Select
            label="Assignee"
            value={searchParams.get('assignee')}
            onChange={(v) => setParam('assignee', v)}
            options={[
              { value: 'me', label: 'Me' },
              { value: 'none', label: 'Unassigned' },
              ...options.users.map((u) => ({ value: u.id, label: u.name })),
            ]}
          />

          <Select
            label="Status"
            value={searchParams.get('status')}
            onChange={(v) => setParam('status', v)}
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s as TaskStatus] }))}
          />

          <Select
            label="Priority"
            value={searchParams.get('priority')}
            onChange={(v) => setParam('priority', v)}
            options={TASK_PRIORITIES.map((p) => ({
              value: p,
              label: TASK_PRIORITY_LABELS[p as TaskPriority],
            }))}
          />

          <Select
            label="Type"
            value={searchParams.get('category')}
            onChange={(v) => setParam('category', v)}
            options={TASK_CATEGORIES.map((c) => ({
              value: c,
              label: TASK_CATEGORY_LABELS[c as TaskCategory],
            }))}
          />

          <Select
            label="Due"
            value={searchParams.get('due')}
            onChange={(v) => setParam('due', v)}
            options={[
              { value: 'overdue', label: 'Overdue' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Next 7 days' },
              { value: 'none', label: 'No due date' },
            ]}
          />

          {activeFilters.length ? (
            <button
              type="button"
              className="btn-ghost btn-sm text-slate-500"
              onClick={() => router.push(`${pathname}?view=${currentView}`)}
            >
              <X className="h-3.5 w-3.5" aria-hidden />
              Clear {activeFilters.length}
            </button>
          ) : null}

          {currentView === 'list' ? (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={searchParams.get('showDone') === '1'}
                onChange={(e) => setParam('showDone', e.target.checked ? '1' : null)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600"
              />
              Show done
            </label>
          ) : null}

          <button type="button" className="btn-primary btn-sm" onClick={() => setNewOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            New task
          </button>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="card px-6 py-16 text-center">
          <p className="text-sm font-semibold text-slate-700">No tasks match these filters</p>
          <p className="mt-1 text-sm text-slate-500">
            {activeFilters.length ? (
              <button type="button" className="link" onClick={() => router.push(`${pathname}?view=${currentView}`)}>
                Clear the filters
              </button>
            ) : (
              <>
                Create one, or let the recurring calendar generate them.{' '}
                <Link href="/recurring" className="link">
                  Manage recurring work
                </Link>
              </>
            )}
          </p>
        </div>
      ) : currentView === 'board' ? (
        <TaskBoardView tasks={tasks} />
      ) : currentView === 'calendar' ? (
        <TaskCalendarView tasks={tasks} />
      ) : currentView === 'timeline' ? (
        <TaskTimelineView tasks={tasks} />
      ) : (
        <TaskListView tasks={tasks} users={options.users} />
      )}

      <NewTaskModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        clients={options.clients}
        users={options.users}
        currentUserId={currentUserId}
        defaultClientId={searchParams.get('client')}
      />
    </>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      aria-label={label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      className={cn(
        'input w-auto py-1.5 text-xs',
        value ? 'border-brand-400 bg-brand-50 font-semibold text-brand-800' : '',
      )}
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
