import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { confirmBooking } from '@/lib/workflow';

const schema = z.object({
  scheduledAt: z.string().min(1, 'Pick a date and time'),
  durationMins: z.coerce.number().int().min(5).max(480).optional(),
  meetingLink: z.string().nullable().optional(),
  agenda: z.string().nullable().optional(),
});

/** Books a discovery call from inside the app (the prospect booked by phone). */
export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const scheduledAt = toDate(input.scheduledAt);
  if (!scheduledAt) throw new Error('That date and time could not be read');

  const booking = await confirmBooking({
    leadId: id,
    scheduledAt,
    durationMins: input.durationMins,
    meetingLink: input.meetingLink,
    agenda: input.agenda,
  });

  return ok({ booking }, 201);
});
