import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { sendDiscoveryInvite } from '@/lib/workflow';

/** Re-sends the discovery-call booking link to the lead. */
export const POST = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  await sendDiscoveryInvite(id);
  return ok({ sent: true });
});
