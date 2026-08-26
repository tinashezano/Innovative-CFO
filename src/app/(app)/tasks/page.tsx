import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { TasksWorkspace } from './tasks-workspace';
import type { TaskRow } from './types';
import { startOfDay, addDays } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Search = {
  view?: string;
  client?: string;
  assignee?: string;
  status?: string;
  priority?: string;
  category?: string;
  due?: string;
  q?: string;
  showDone?: string;
};

export default async function TasksPage({ searchParams }: { searchParams: Promise<Search> }) {
  const user = await requirePageUser();
  const params = await searchParams;

  const today = startOfDay(new Date());

  // Only top-level tasks are listed; subtasks come nested on their parent.
  const where: Record<string, unknown> = { parentId: null, archivedAt: null };

  if (params.client) where.clientId = params.client === 'none' ? null : params.client;
  if (params.assignee) {
    where.assigneeId = params.assignee === 'me' ? user.id : params.assignee === 'none' ? null : params.assignee;
  }
  if (params.status) where.status = params.status;
  if (params.priority) where.priority = params.priority;
  if (params.category) where.category = params.category;
  if (params.q) {
    where.OR = [
      { title: { contains: params.q } },
      { description: { contains: params.q } },
      { reference: { contains: params.q } },
    ];
  }

  if (params.due === 'overdue') {
    where.dueDate = { lt: today };
    where.status = { not: 'DONE' };
  } else if (params.due === 'today') {
    where.dueDate = { gte: today, lt: addDays(today, 1) };
  } else if (params.due === 'week') {
    where.dueDate = { gte: today, lte: addDays(today, 7) };
  } else if (params.due === 'none') {
    where.dueDate = null;
  }

  // Board and timeline need finished work in view; list hides it by default.
  const view = ['board', 'calendar', 'timeline'].includes(params.view ?? '')
    ? (params.view as string)
    : 'list';
  const showDone = params.showDone === '1' || view === 'board' || view === 'calendar';
  if (!showDone && !params.status) where.status = { not: 'DONE' };

  const [tasks, clients, users] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, colorTag: true } },
        assignee: { select: { id: true, name: true, avatarColor: true } },
        subtasks: {
          include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: [{ position: 'asc' }, { dueDate: 'asc' }],
      take: 500,
    }),
    prisma.client.findMany({
      where: { status: { not: 'OFFBOARDED' } },
      select: { id: true, name: true, colorTag: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const rows: TaskRow[] = tasks.map((task) => ({
    id: task.id,
    reference: task.reference,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    category: task.category,
    startDate: task.startDate?.toISOString() ?? null,
    dueDate: task.dueDate?.toISOString() ?? null,
    completedAt: task.completedAt?.toISOString() ?? null,
    estimateHours: task.estimateHours,
    labels: task.labels,
    source: task.source,
    position: task.position,
    client: task.client,
    assignee: task.assignee,
    subtasks: task.subtasks.map((sub) => ({
      id: sub.id,
      title: sub.title,
      status: sub.status,
      dueDate: sub.dueDate?.toISOString() ?? null,
      assignee: sub.assignee,
    })),
  }));

  const open = rows.filter((t) => t.status !== 'DONE');
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < today);

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle={`${open.length} open${overdue.length ? ` · ${overdue.length} overdue` : ''} · grouped by client`}
      />
      <TasksWorkspace
        tasks={rows}
        options={{ clients, users }}
        currentUserId={user.id}
        view={view}
      />
    </>
  );
}
