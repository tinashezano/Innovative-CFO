import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { scheduleReminders } from '@/lib/tasks';
import { notify } from '@/lib/notify';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

const schema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimateHours: z.coerce.number().min(0).nullable().optional(),
  actualHours: z.coerce.number().min(0).nullable().optional(),
  labels: z.string().nullable().optional(),
  archived: z.boolean().optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { startDate, dueDate, archived, ...fields } = schema.parse(await request.json());

  const before = await prisma.task.findUnique({
    where: { id },
    include: { subtasks: { select: { id: true, status: true } } },
  });
  if (!before) throw new Error('Task not found');

  // Closing a parent closes its subtasks — a parent is not done while its
  // pieces are outstanding.
  const closing = fields.status === 'DONE' && before.status !== 'DONE';
  if (closing && before.subtasks.length) {
    await prisma.task.updateMany({
      where: { parentId: id, status: { not: 'DONE' } },
      data: { status: 'DONE', completedAt: new Date() },
    });
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      ...fields,
      ...(startDate !== undefined ? { startDate: toDate(startDate) } : {}),
      ...(dueDate !== undefined ? { dueDate: toDate(dueDate) } : {}),
      ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      ...(fields.status
        ? {
            completedAt: fields.status === 'DONE' ? (before.completedAt ?? new Date()) : null,
          }
        : {}),
    },
  });

  // A moved due date, a reopened task or a new assignee all change who gets
  // chased and when.
  if (dueDate !== undefined || fields.status || fields.assigneeId !== undefined) {
    await scheduleReminders(id);
  }

  if (fields.assigneeId && fields.assigneeId !== before.assigneeId && fields.assigneeId !== user.id) {
    await notify({
      userId: fields.assigneeId,
      title: `Task assigned to you: ${task.title}`,
      body: task.dueDate ? `Due ${task.dueDate.toLocaleDateString('en-ZA')}` : undefined,
      link: `/tasks/${task.id}`,
      kind: 'ACTION',
    });
  }

  return ok({ task });
});

export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  await prisma.task.delete({ where: { id } });
  return ok({ deleted: true });
});
