import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { nextOccurrence } from '@/lib/recurrence';
import { RECURRENCE_FREQUENCIES, TASK_CATEGORIES, TASK_PRIORITIES } from '@/lib/constants';
import type { RecurrenceFrequency } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1, 'Give the recurring task a name'),
  description: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  category: z.enum(TASK_CATEGORIES).default('OTHER'),
  priority: z.enum(TASK_PRIORITIES).default('MEDIUM'),
  assigneeId: z.string().nullable().optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  interval: z.coerce.number().int().min(1).max(52).default(1),
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.coerce.number().int().min(1).max(12).nullable().optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(120).default(7),
  estimateHours: z.coerce.number().min(0).nullable().optional(),
  subtaskTitles: z.array(z.string().min(1)).default([]),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  active: z.boolean().default(true),
});

export const POST = handler(async (request: Request) => {
  await requireUser();
  const input = schema.parse(await request.json());

  const startDate = toDate(input.startDate ?? null) ?? new Date();
  const endDate = toDate(input.endDate ?? null);

  const nextDueAt = nextOccurrence(
    {
      frequency: input.frequency as RecurrenceFrequency,
      interval: input.interval,
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      startDate,
      endDate,
    },
    new Date(),
  );

  const template = await prisma.recurringTaskTemplate.create({
    data: {
      name: input.name,
      description: input.description || null,
      clientId: input.clientId || null,
      category: input.category,
      priority: input.priority,
      assigneeId: input.assigneeId || null,
      frequency: input.frequency,
      interval: input.interval,
      dayOfWeek: input.dayOfWeek ?? null,
      dayOfMonth: input.dayOfMonth ?? null,
      monthOfYear: input.monthOfYear ?? null,
      leadTimeDays: input.leadTimeDays,
      estimateHours: input.estimateHours ?? null,
      subtaskTitles: JSON.stringify(input.subtaskTitles),
      startDate,
      endDate,
      active: input.active,
      nextDueAt,
    },
  });

  return ok({ template }, 201);
});
