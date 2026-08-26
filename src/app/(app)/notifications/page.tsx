import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { PageHeader } from '@/components/ui';
import { NotificationList } from './notification-list';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const user = await requirePageUser();

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : 'You are all caught up.'}
      />
      <NotificationList
        notifications={notifications.map((n) => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.link,
          kind: n.kind,
          read: Boolean(n.readAt),
          createdAt: n.createdAt.toISOString(),
        }))}
      />
    </>
  );
}
