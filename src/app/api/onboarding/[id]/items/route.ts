import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { ONBOARDING_ITEM_TYPES, ONBOARDING_STAGES } from '@/lib/constants';

const schema = z.object({
  title: z.string().min(1, 'Give the item a title'),
  description: z.string().nullable().optional(),
  stage: z.enum(ONBOARDING_STAGES).default('INFORMATION_REQUESTED'),
  type: z.enum(ONBOARDING_ITEM_TYPES).default('DOCUMENT'),
  required: z.boolean().default(true),
  dueDate: z.string().nullable().optional(),
});

export const POST = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const last = await prisma.onboardingItem.findFirst({
    where: { onboardingId: id },
    orderBy: { sortOrder: 'desc' },
    select: { sortOrder: true },
  });

  const item = await prisma.onboardingItem.create({
    data: {
      onboardingId: id,
      title: input.title,
      description: input.description || null,
      stage: input.stage,
      type: input.type,
      required: input.required,
      dueDate: toDate(input.dueDate ?? null),
      sortOrder: (last?.sortOrder ?? 0) + 1,
    },
  });

  return ok({ item }, 201);
});
