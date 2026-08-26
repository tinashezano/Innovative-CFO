import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { createTask } from '@/lib/tasks';
import { prisma } from '@/lib/db';

const schema = z.object({ title: z.string().min(1, 'Give the subtask a title') });

export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const parent = await prisma.task.findUnique({ where: { id } });
  if (!parent) throw new Error('Parent task not found');
  // One level of nesting keeps the board and the reminder grouping legible.
  if (parent.parentId) throw new Error('Subtasks cannot themselves have subtasks');

  const task = await createTask({
    title: input.title,
    parentId: id,
    clientId: parent.clientId,
    priority: parent.priority,
    category: parent.category,
    assigneeId: parent.assigneeId,
    dueDate: parent.dueDate,
    createdById: user.id,
    source: parent.source,
  });

  return ok({ task }, 201);
});
