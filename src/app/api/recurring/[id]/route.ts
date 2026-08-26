import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { nextOccurrence } from '@/lib/recurrence';
import { RECURRENCE_FREQUENCIES, TASK_CATEGORIES, TASK_PRIORITIES } from '@/lib/constants';
import type { RecurrenceFrequency } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  category: z.enum(TASK_CATEGORIES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  frequency: z.enum(RECURRENCE_FREQUENCIES).optional(),
  interval: z.coerce.number().int().min(1).max(52).optional(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).nullable().optional(),
  dayOfMonth: z.coerce.number().int().min(1).max(31).nullable().optional(),
  monthOfYear: z.coerce.number().int().min(1).max(12).nullable().optional(),
  leadTimeDays: z.coerce.number().int().min(0).max(120).optional(),
  estimateHours: z.coerce.number().min(0).nullable().optional(),
  subtaskTitles: z.array(z.string().min(1)).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  active: z.boolean().optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const existing = await prisma.recurringTaskTemplate.findUnique({ where: { id } });
  if (!existing) throw new Error('Template not found');

  const startDate = input.startDate !== undefined ? (toDate(input.startDate) ?? existing.startDate) : existing.startDate;
  const endDate = input.endDate !== undefined ? toDate(input.endDate) : existing.endDate;

  const merged = {
    frequency: (input.frequency ?? existing.frequency) as RecurrenceFrequency,
    interval: input.interval ?? existing.interval,
    dayOfWeek: input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek,
    dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth,
    monthOfYear: input.monthOfYear !== undefined ? input.monthOfYear : existing.monthOfYear,
    startDate,
    endDate,
  };

  const template = await prisma.recurringTaskTemplate.update({
    where: { id },
    data: {
      ...(input.name ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.category ? { category: input.category } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
      ...(input.estimateHours !== undefined ? { estimateHours: input.estimateHours } : {}),
      ...(input.subtaskTitles ? { subtaskTitles: JSON.stringify(input.subtaskTitles) } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      frequency: merged.frequency,
      interval: merged.interval,
      dayOfWeek: merged.dayOfWeek,
      dayOfMonth: merged.dayOfMonth,
      monthOfYear: merged.monthOfYear,
      startDate,
      endDate,
      // Recompute so a changed schedule takes effect on the next run.
      nextDueAt: nextOccurrence(merged, new Date()),
    },
  });

  return ok({ template });
});

/**
 * Deleting a template leaves the tasks it already generated in place — they
 * are real work someone may be part-way through. Only the schedule goes.
 */
export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  await prisma.recurringTaskTemplate.delete({ where: { id } });
  return ok({ deleted: true });
});
