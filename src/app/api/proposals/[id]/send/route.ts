import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { sendProposal } from '@/lib/workflow';

export const POST = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  await sendProposal(id, user.id);
  return ok({ sent: true });
});
