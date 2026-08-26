import { z } from 'zod';
import { prisma } from '@/lib/db';
import { handler, ok, toDate } from '@/lib/api';
import { confirmBooking } from '@/lib/workflow';

const schema = z.object({
  token: z.string().min(8),
  scheduledAt: z.string().min(1),
  agenda: z.string().max(2000).optional(),
});

/**
 * Public endpoint behind the emailed booking link. The token is the only
 * credential, so it is the only thing we look the lead up by — no lead id is
 * ever accepted from the request body.
 */
export const POST = handler(async (request: Request) => {
  const input = schema.parse(await request.json());

  const lead = await prisma.lead.findUnique({ where: { bookingToken: input.token } });
  if (!lead) return ok({ error: 'That booking link is no longer valid' }, 404);

  const scheduledAt = toDate(input.scheduledAt);
  if (!scheduledAt) return ok({ error: 'Pick a valid time slot' }, 400);
  if (scheduledAt < new Date()) return ok({ error: 'That time has already passed' }, 400);

  // Someone else may have taken the slot between page load and submit.
  const clash = await prisma.discoveryBooking.findFirst({
    where: { scheduledAt, status: 'CONFIRMED' },
    select: { id: true },
  });
  if (clash) return ok({ error: 'That slot has just been taken. Please pick another.' }, 409);

  const booking = await confirmBooking({
    leadId: lead.id,
    scheduledAt,
    agenda: input.agenda ?? null,
    bookedByName: lead.contactName,
    bookedByEmail: lead.email,
  });

  return ok({ booked: true, scheduledAt: booking.scheduledAt }, 201);
});
