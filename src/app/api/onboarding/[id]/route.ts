import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { setOnboardingStage, sendInformationRequest, sendWelcomePack } from '@/lib/workflow';
import { ONBOARDING_STAGES } from '@/lib/constants';

const schema = z.object({
  stage: z.enum(ONBOARDING_STAGES).optional(),
  ownerId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  targetCompleteAt: z.string().nullable().optional(),
  action: z.enum(['resend-information-request', 'resend-welcome-pack']).optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const { stage, action, targetCompleteAt, ...fields } = schema.parse(await request.json());

  if (Object.keys(fields).length || targetCompleteAt !== undefined) {
    await prisma.onboarding.update({
      where: { id },
      data: {
        ...fields,
        ...(targetCompleteAt !== undefined ? { targetCompleteAt: toDate(targetCompleteAt) } : {}),
      },
    });
  }

  if (stage) await setOnboardingStage(id, stage, user.id);

  if (action) {
    const onboarding = await prisma.onboarding.findUniqueOrThrow({ where: { id } });
    if (action === 'resend-information-request') await sendInformationRequest(onboarding.clientId);
    if (action === 'resend-welcome-pack') await sendWelcomePack(onboarding.clientId);
  }

  const onboarding = await prisma.onboarding.findUnique({ where: { id } });
  return ok({ onboarding });
});
