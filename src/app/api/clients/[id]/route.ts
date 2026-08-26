import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole, requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { CLIENT_STATUSES } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1).optional(),
  legalName: z.string().nullable().optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  financialYearEnd: z.string().nullable().optional(),
  monthlyFee: z.coerce.number().min(0).optional(),
  status: z.enum(CLIENT_STATUSES).optional(),
  ownerId: z.string().nullable().optional(),
  colorTag: z.string().optional(),
  notes: z.string().nullable().optional(),
  startDate: z.string().nullable().optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const { startDate, ...fields } = schema.parse(await request.json());

  const client = await prisma.client.update({
    where: { id },
    data: { ...fields, ...(startDate !== undefined ? { startDate: toDate(startDate) } : {}) },
  });

  return ok({ client });
});

/**
 * Deleting a client removes its tasks and onboarding with it, so it is
 * restricted to managers and above. Offboarding is usually the right move.
 */
export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole('MANAGER');
  const { id } = await ctx.params;
  await prisma.client.delete({ where: { id } });
  return ok({ deleted: true });
});
