import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';

const schema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

/** Marks notifications read. Scoped to the caller — you cannot clear someone else's. */
export const PATCH = handler(async (request: Request) => {
  const user = await requireUser();
  const input = schema.parse(await request.json());

  const result = await prisma.notification.updateMany({
    where: {
      userId: user.id,
      readAt: null,
      ...(input.all ? {} : { id: { in: input.ids ?? [] } }),
    },
    data: { readAt: new Date() },
  });

  return ok({ updated: result.count });
});
