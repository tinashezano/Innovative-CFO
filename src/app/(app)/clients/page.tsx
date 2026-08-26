import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { formatMoney } from '@/lib/utils';
import {
  Avatar,
  ClientStatusBadge,
  EmptyState,
  OnboardingStageBadge,
  PageHeader,
  ProgressBar,
  StatCard,
} from '@/components/ui';
import { NewClientButton } from './new-client';

export const dynamic = 'force-dynamic';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await requirePageUser();
  const params = await searchParams;

  const where = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.q
      ? {
          OR: [
            { name: { contains: params.q } },
            { email: { contains: params.q } },
            { reference: { contains: params.q } },
          ],
        }
      : {}),
  };

  const [clients, users, activeCount, onboardingCount] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        owner: { select: { name: true, avatarColor: true } },
        onboarding: { include: { items: { select: { status: true } } } },
        tasks: {
          where: { status: { not: 'DONE' }, parentId: null, archivedAt: null },
          select: { id: true, dueDate: true },
        },
      },
      orderBy: [{ status: 'asc' }, { name: 'asc' }],
    }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.client.count({ where: { status: 'ONBOARDING' } }),
  ]);

  const mrr = clients.filter((c) => c.status === 'ACTIVE').reduce((s, c) => s + c.monthlyFee, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={`${clients.length} on the books`}
        actions={<NewClientButton users={users} />}
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active" value={activeCount} href="/clients?status=ACTIVE" />
        <StatCard label="Onboarding" value={onboardingCount} href="/clients?status=ONBOARDING" tone="warning" />
        <StatCard label="Recurring revenue" value={formatMoney(mrr)} hint="Monthly, active clients" />
        <StatCard
          label="Open client tasks"
          value={clients.reduce((s, c) => s + c.tasks.length, 0)}
          href="/tasks"
        />
      </div>

      {clients.length ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => {
            const items = client.onboarding?.items ?? [];
            const done = items.filter((i) => ['APPROVED', 'WAIVED'].includes(i.status)).length;
            const overdue = client.tasks.filter((t) => t.dueDate && t.dueDate < today).length;

            return (
              <Link
                key={client.id}
                href={`/clients/${client.id}`}
                className="card card-pad block transition hover:border-brand-300 hover:shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <span
                      className="mt-1 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: client.colorTag }}
                      aria-hidden
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{client.name}</p>
                      <p className="text-xs text-slate-400">{client.reference}</p>
                    </div>
                  </div>
                  <ClientStatusBadge status={client.status} />
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-slate-500">Monthly fee</dt>
                    <dd className="font-semibold text-slate-900">
                      {formatMoney(client.monthlyFee, client.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Open tasks</dt>
                    <dd className="font-semibold text-slate-900">
                      {client.tasks.length}
                      {overdue ? <span className="ml-1.5 text-xs text-red-600">{overdue} overdue</span> : null}
                    </dd>
                  </div>
                </dl>

                {client.onboarding && client.onboarding.stage !== 'COMPLETE' ? (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Onboarding</span>
                      <OnboardingStageBadge stage={client.onboarding.stage} />
                    </div>
                    <ProgressBar value={done} max={items.length} />
                  </div>
                ) : null}

                {client.owner ? (
                  <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                    <Avatar name={client.owner.name} color={client.owner.avatarColor} size="sm" />
                    <span className="text-xs text-slate-500">{client.owner.name}</span>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No clients yet"
          description="Clients appear here automatically once a proposal is signed and paid, or you can add an existing one."
        />
      )}
    </>
  );
}
