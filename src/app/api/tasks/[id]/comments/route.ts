import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { notify } from '@/lib/notify';

const schema = z.object({ body: z.string().min(1, 'Write something first') });

export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const comment = await prisma.taskComment.create({
    data: { taskId: id, userId: user.id, body: input.body },
  });

  // Tell the assignee, unless they are the one commenting.
  const task = await prisma.task.findUnique({
    where: { id },
    select: { title: true, assigneeId: true },
  });
  if (task?.assigneeId && task.assigneeId !== user.id) {
    await notify({
      userId: task.assigneeId,
      title: `${user.name} commented on ${task.title}`,
      body: input.body.slice(0, 160),
      link: `/tasks/${id}`,
    });
  }

  return ok({ comment }, 201);
});
