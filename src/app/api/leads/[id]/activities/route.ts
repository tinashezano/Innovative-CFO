import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { LEAD_ACTIVITY_TYPES } from '@/lib/constants';

const schema = z.object({
  type: z.enum(LEAD_ACTIVITY_TYPES).default('NOTE'),
  body: z.string().min(1, 'Write something first'),
});

export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const activity = await prisma.leadActivity.create({
    data: { leadId: id, userId: user.id, type: input.type, body: input.body },
  });

  return ok({ activity }, 201);
});
