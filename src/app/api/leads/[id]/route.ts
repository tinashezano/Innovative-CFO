import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { setLeadStage } from '@/lib/workflow';
import { LEAD_SOURCES, LEAD_STAGES } from '@/lib/constants';

const patchSchema = z.object({
  companyName: z.string().min(1).optional(),
  contactName: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().nullable().optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  serviceInterest: z.string().nullable().optional(),
  estimatedValue: z.coerce.number().min(0).optional(),
  notes: z.string().nullable().optional(),
  ownerId: z.string().nullable().optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  lostReason: z.string().nullable().optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { stage, lostReason, ...fields } = patchSchema.parse(await request.json());

  if (Object.keys(fields).length) {
    await prisma.lead.update({ where: { id }, data: fields });
  }

  // Stage changes go through the workflow so activity and automation fire.
  if (stage) {
    await setLeadStage(id, stage, { actorId: user.id, lostReason });
  }

  const lead = await prisma.lead.findUnique({ where: { id } });
  return ok({ lead });
});

export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  await prisma.lead.delete({ where: { id } });
  return ok({ deleted: true });
});
