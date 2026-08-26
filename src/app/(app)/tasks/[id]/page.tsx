import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Repeat } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { TaskDetail } from './task-detail';

export const dynamic = 'force-dynamic';

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  const [task, clients, users] = await Promise.all([
    prisma.task.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, colorTag: true } },
        assignee: { select: { id: true, name: true, avatarColor: true } },
        createdBy: { select: { name: true } },
        parent: { select: { id: true, title: true, reference: true } },
        subtasks: {
          include: { assignee: { select: { id: true, name: true, avatarColor: true } } },
          orderBy: { position: 'asc' },
        },
        comments: { include: { user: true }, orderBy: { createdAt: 'desc' } },
        reminders: { orderBy: { scheduledFor: 'asc' } },
        template: { select: { id: true, name: true, frequency: true } },
        lead: { select: { id: true, companyName: true } },
        proposal: { select: { id: true, number: true } },
        onboarding: { select: { id: true, clientId: true } },
      },
    }),
    prisma.client.findMany({
      where: { status: { not: 'OFFBOARDED' } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true, avatarColor: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  if (!task) notFound();

  return (
    <>
      <Link href="/tasks" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to tasks
      </Link>

      <PageHeader
        title={task.title}
        subtitle={[
          task.reference,
          task.client?.name,
          task.parent ? `subtask of ${task.parent.title}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      />

      {task.template ? (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs text-brand-800">
          <Repeat className="h-3.5 w-3.5" aria-hidden />
          Generated from the recurring template{' '}
          <Link href={`/recurring?highlight=${task.template.id}`} className="font-semibold underline">
            {task.template.name}
          </Link>
          {task.periodKey ? ` · period ${task.periodKey}` : ''}
        </p>
      ) : null}

      <TaskDetail
        task={{
          id: task.id,
          reference: task.reference,
          title: task.title,
          description: task.description,
          status: task.status,
          priority: task.priority,
          category: task.category,
          clientId: task.clientId,
          assigneeId: task.assigneeId,
          startDate: task.startDate?.toISOString() ?? null,
          dueDate: task.dueDate?.toISOString() ?? null,
          estimateHours: task.estimateHours,
          actualHours: task.actualHours,
          labels: task.labels,
          parentId: task.parentId,
          createdByName: task.createdBy?.name ?? null,
          createdAt: task.createdAt.toISOString(),
          completedAt: task.completedAt?.toISOString() ?? null,
        }}
        subtasks={task.subtasks.map((sub) => ({
          id: sub.id,
          reference: sub.reference,
          title: sub.title,
          status: sub.status,
          dueDate: sub.dueDate?.toISOString() ?? null,
          assignee: sub.assignee,
        }))}
        comments={task.comments.map((comment) => ({
          id: comment.id,
          body: comment.body,
          createdAt: comment.createdAt.toISOString(),
          userName: comment.user?.name ?? 'Someone',
          userColor: comment.user?.avatarColor ?? '#64748b',
        }))}
        reminders={task.reminders.map((reminder) => ({
          id: reminder.id,
          kind: reminder.kind,
          offsetDays: reminder.offsetDays,
          scheduledFor: reminder.scheduledFor.toISOString(),
          status: reminder.status,
          sentAt: reminder.sentAt?.toISOString() ?? null,
        }))}
        links={{
          lead: task.lead ? { id: task.lead.id, label: task.lead.companyName } : null,
          proposal: task.proposal ? { id: task.proposal.id, label: task.proposal.number } : null,
          client: task.client ? { id: task.client.id, label: task.client.name } : null,
        }}
        clients={clients}
        users={users}
      />
    </>
  );
}
