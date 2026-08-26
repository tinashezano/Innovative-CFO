import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { createLead } from '@/lib/workflow';
import { LEAD_SOURCES } from '@/lib/constants';

const createSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  contactName: z.string().min(1, 'Contact name is required'),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().optional().nullable(),
  source: z.enum(LEAD_SOURCES).optional(),
  serviceInterest: z.string().optional().nullable(),
  estimatedValue: z.coerce.number().min(0).optional(),
  notes: z.string().optional().nullable(),
  ownerId: z.string().optional().nullable(),
  sendBookingInvite: z.boolean().optional(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const input = createSchema.parse(await request.json());

  const lead = await createLead({
    ...input,
    ownerId: input.ownerId || user.id,
    actorId: user.id,
  });

  return ok({ lead }, 201);
});
