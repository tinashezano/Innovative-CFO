import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { completeBooking } from '@/lib/workflow';
import { BOOKING_OUTCOMES } from '@/lib/constants';

const schema = z.object({
  outcome: z.enum(BOOKING_OUTCOMES),
  outcomeNotes: z.string().nullable().optional(),
});

export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const booking = await completeBooking({
    bookingId: id,
    outcome: input.outcome,
    outcomeNotes: input.outcomeNotes,
    actorId: user.id,
  });

  return ok({ booking });
});
