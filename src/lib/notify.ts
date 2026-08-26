import 'server-only';
import { prisma } from './db';

export async function notify(input: {
  userId: string | null | undefined;
  title: string;
  body?: string;
  link?: string;
  kind?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION';
}): Promise<void> {
  if (!input.userId) return;
  await prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      link: input.link,
      kind: input.kind ?? 'INFO',
    },
  });
}

/** Notifies every active Owner and Manager — used for firm-wide events. */
export async function notifyManagers(input: {
  title: string;
  body?: string;
  link?: string;
  kind?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ACTION';
  excludeUserId?: string | null;
}): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { active: true, role: { in: ['OWNER', 'MANAGER'] } },
    select: { id: true },
  });
  const targets = managers.filter((m) => m.id !== input.excludeUserId);
  if (!targets.length) return;

  await prisma.notification.createMany({
    data: targets.map((m) => ({
      userId: m.id,
      title: input.title,
      body: input.body,
      link: input.link,
      kind: input.kind ?? 'INFO',
    })),
  });
}

export async function audit(input: {
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  meta?: unknown;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      meta: input.meta === undefined ? null : JSON.stringify(input.meta),
    },
  });
}
