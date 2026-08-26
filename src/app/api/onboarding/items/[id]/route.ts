import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { ONBOARDING_ITEM_STATUSES } from '@/lib/constants';

const schema = z.object({
  status: z.enum(ONBOARDING_ITEM_STATUSES).optional(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const { status, dueDate, ...fields } = schema.parse(await request.json());

  const now = new Date();

  const item = await prisma.onboardingItem.update({
    where: { id },
    data: {
      ...fields,
      ...(dueDate !== undefined ? { dueDate: toDate(dueDate) } : {}),
      ...(status
        ? {
            status,
            // Stamp the moment an item lands and the moment it is signed off,
            // so the checklist shows how long each step actually took.
            receivedAt: ['RECEIVED', 'APPROVED'].includes(status) ? now : null,
            approvedAt: status === 'APPROVED' ? now : null,
          }
        : {}),
    },
  });

  return ok({ item });
});

export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  await prisma.onboardingItem.delete({ where: { id } });
  return ok({ deleted: true });
});
