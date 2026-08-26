import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { createTask } from '@/lib/tasks';
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES } from '@/lib/constants';

const schema = z.object({
  title: z.string().min(1, 'Give the task a title'),
  description: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  estimateHours: z.coerce.number().min(0).nullable().optional(),
  labels: z.string().nullable().optional(),
  subtaskTitles: z.array(z.string().min(1)).optional(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const input = schema.parse(await request.json());

  const task = await createTask({
    ...input,
    createdById: user.id,
    startDate: toDate(input.startDate ?? null),
    dueDate: toDate(input.dueDate ?? null),
  });

  return ok({ task }, 201);
});
