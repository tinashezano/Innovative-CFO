import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { PageHeader, StatCard } from '@/components/ui';
import { RecurringManager } from './recurring-manager';
import { parseJson } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string; highlight?: string }>;
}) {
  await requirePageUser();
  const params = await searchParams;

  const [templates, clients, users, generatedCount] = await Promise.all([
    prisma.recurringTaskTemplate.findMany({
      where: params.client ? { clientId: params.client } : {},
      include: {
        client: { select: { id: true, name: true, colorTag: true } },
        assignee: { select: { id: true, name: true, avatarColor: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
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
    prisma.task.count({ where: { source: 'RECURRING' } }),
  ]);

  const active = templates.filter((t) => t.active);

  return (
    <>
      <PageHeader
        title="Recurring work"
        subtitle="The compliance calendar. Tasks are generated ahead of their due date, with their subtasks."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active schedules" value={active.length} />
        <StatCard label="Paused" value={templates.length - active.length} />
        <StatCard label="Tasks generated" value={generatedCount} tone="positive" />
        <StatCard
          label="Clients covered"
          value={new Set(templates.filter((t) => t.clientId).map((t) => t.clientId)).size}
        />
      </div>

      <RecurringManager
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          description: template.description,
          clientId: template.clientId,
          clientName: template.client?.name ?? null,
          clientColor: template.client?.colorTag ?? null,
          category: template.category,
          priority: template.priority,
          assigneeId: template.assigneeId,
          assigneeName: template.assignee?.name ?? null,
          assigneeColor: template.assignee?.avatarColor ?? null,
          frequency: template.frequency,
          interval: template.interval,
          dayOfWeek: template.dayOfWeek,
          dayOfMonth: template.dayOfMonth,
          monthOfYear: template.monthOfYear,
          leadTimeDays: template.leadTimeDays,
          estimateHours: template.estimateHours,
          subtaskTitles: parseJson<string[]>(template.subtaskTitles, []),
          startDate: template.startDate.toISOString(),
          endDate: template.endDate?.toISOString() ?? null,
          nextDueAt: template.nextDueAt?.toISOString() ?? null,
          lastRunAt: template.lastRunAt?.toISOString() ?? null,
          active: template.active,
          generatedCount: template._count.tasks,
        }))}
        clients={clients}
        users={users}
        filterClientId={params.client ?? null}
        highlightId={params.highlight ?? null}
      />
    </>
  );
}
