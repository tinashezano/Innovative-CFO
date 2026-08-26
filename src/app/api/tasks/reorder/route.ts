import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { repositionTask } from '@/lib/tasks';
import { scheduleReminders } from '@/lib/tasks';
import { prisma } from '@/lib/db';
import { TASK_STATUSES } from '@/lib/constants';

const schema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  beforeTaskId: z.string().nullable().optional(),
});

/** Kanban drag-and-drop: move a task into a column, at a position. */
export const POST = handler(async (request: Request) => {
  await requireUser();
  const input = schema.parse(await request.json());

  const before = await prisma.task.findUnique({
    where: { id: input.taskId },
    select: { status: true, completedAt: true },
  });
  if (!before) throw new Error('Task not found');

  await repositionTask(input.taskId, input.status, input.beforeTaskId ?? null);

  if (input.status !== before.status) {
    await prisma.task.update({
      where: { id: input.taskId },
      data: {
        completedAt: input.status === 'DONE' ? (before.completedAt ?? new Date()) : null,
      },
    });
    if (input.status === 'DONE') {
      await prisma.task.updateMany({
        where: { parentId: input.taskId, status: { not: 'DONE' } },
        data: { status: 'DONE', completedAt: new Date() },
      });
    }
    await scheduleReminders(input.taskId);
  }

  return ok({ moved: true });
});
