import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { disconnectGoogle } from '@/lib/google-calendar';
import { audit } from '@/lib/notify';

/**
 * Forgets the stored tokens. Existing calendar events are left alone — they are
 * real meetings in someone's diary, and silently deleting them on disconnect
 * would be a nasty surprise.
 */
export const POST = handler(async () => {
  const user = await requireUser();
  await disconnectGoogle(user.id);
  await audit({
    userId: user.id,
    action: 'google.disconnected',
    entityType: 'User',
    entityId: user.id,
  });
  return ok({ disconnected: true });
});
