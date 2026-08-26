import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { BOOKING_STATUSES } from '@/lib/constants';

const schema = z.object({
  scheduledAt: z.string().optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  meetingLink: z.string().nullable().optional(),
  agenda: z.string().nullable().optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const scheduledAt = input.scheduledAt ? toDate(input.scheduledAt) : undefined;

  const booking = await prisma.discoveryBooking.update({
    where: { id },
    data: {
      ...(scheduledAt ? { scheduledAt } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.meetingLink !== undefined ? { meetingLink: input.meetingLink } : {}),
      ...(input.agenda !== undefined ? { agenda: input.agenda } : {}),
    },
  });

  // Moving the call moves the task that tracks it.
  if (scheduledAt) {
    await prisma.task.updateMany({
      where: { bookingId: id, status: { not: 'DONE' } },
      data: { startDate: scheduledAt, dueDate: scheduledAt },
    });
  }

  return ok({ booking });
});
