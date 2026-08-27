import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { PageHeader } from '@/components/ui';
import { SettingsTabs } from './settings-tabs';
import { docusignMode, docusignConfigured } from '@/lib/docusign';
import { paystackMode, paystackConfigured } from '@/lib/paystack';
import { googleConfigured, googleConnectionFor } from '@/lib/google-calendar';
import { canManage } from '@/lib/auth';
import type { Role } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requirePageUser();
  const settings = await getSettings();
  const google = await googleConnectionFor(user.id);

  const [users, services, lastRun, emailCount, recentEmails] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobTitle: true,
        active: true,
        avatarColor: true,
        lastLoginAt: true,
      },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.service.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.auditLog.findFirst({
      where: { action: { in: ['cron.run', 'cron.failed'] } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.emailLog.count(),
    prisma.emailLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 25,
      select: { id: true, to: true, subject: true, status: true, template: true, sentAt: true },
    }),
  ]);

  return (
    <>
      <PageHeader title="Settings" subtitle="Firm details, automation, integrations and your team." />

      <SettingsTabs
        canManage={canManage(user.role as Role)}
        isOwner={user.role === 'OWNER'}
        currentUserId={user.id}
        settings={settings}
        users={users.map((u) => ({ ...u, lastLoginAt: u.lastLoginAt?.toISOString() ?? null }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          defaultPrice: s.defaultPrice,
          billingCycle: s.billingCycle,
          active: s.active,
        }))}
        integrations={{
          docusign: { mode: docusignMode(), configured: docusignConfigured() },
          paystack: { mode: paystackMode(), configured: paystackConfigured() },
          email: {
            mode: process.env.EMAIL_MODE === 'smtp' ? 'smtp' : 'preview',
            configured: Boolean(process.env.SMTP_HOST),
          },
        }}
        google={{
          configured: googleConfigured(),
          connected: google.connected,
          email: google.email,
          connectedAt: google.connectedAt?.toISOString() ?? null,
        }}
        job={{
          lastRunAt: lastRun?.createdAt.toISOString() ?? null,
          lastRunAction: lastRun?.action ?? null,
          lastRunMeta: lastRun?.meta ?? null,
        }}
        emailCount={emailCount}
        recentEmails={recentEmails.map((e) => ({
          id: e.id,
          to: e.to,
          subject: e.subject,
          status: e.status,
          template: e.template,
          sentAt: e.sentAt.toISOString(),
        }))}
      />
    </>
  );
}
