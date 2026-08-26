import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { PageHeader, StatCard } from '@/components/ui';
import { OnboardingBoard } from './onboarding-board';
import { ONBOARDING_STAGES } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  await requirePageUser();

  const onboardings = await prisma.onboarding.findMany({
    include: {
      client: { select: { id: true, name: true, reference: true, colorTag: true, email: true } },
      owner: { select: { name: true, avatarColor: true } },
      items: { select: { status: true, required: true, dueDate: true, stage: true } },
    },
    orderBy: { startedAt: 'asc' },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const cards = onboardings.map((ob) => {
    const done = ob.items.filter((i) => ['APPROVED', 'WAIVED'].includes(i.status)).length;
    const overdue = ob.items.filter(
      (i) => !['APPROVED', 'WAIVED'].includes(i.status) && i.dueDate && i.dueDate < today,
    ).length;

    return {
      id: ob.id,
      clientId: ob.client.id,
      clientName: ob.client.name,
      clientReference: ob.client.reference,
      colorTag: ob.client.colorTag,
      stage: ob.stage,
      ownerName: ob.owner?.name ?? null,
      ownerColor: ob.owner?.avatarColor ?? null,
      startedAt: ob.startedAt.toISOString(),
      targetCompleteAt: ob.targetCompleteAt?.toISOString() ?? null,
      itemsTotal: ob.items.length,
      itemsDone: done,
      overdueItems: overdue,
    };
  });

  const inFlight = cards.filter((c) => c.stage !== 'COMPLETE');
  const blocked = inFlight.filter((c) => c.overdueItems > 0);

  // Median days from start to completion, for the ones that finished.
  const completed = onboardings.filter((o) => o.completedAt);
  const avgDays = completed.length
    ? Math.round(
        completed.reduce(
          (sum, o) => sum + (o.completedAt!.getTime() - o.startedAt.getTime()) / 86400000,
          0,
        ) / completed.length,
      )
    : null;

  return (
    <>
      <PageHeader
        title="Onboarding"
        subtitle="Information requested → received → setup → review → complete."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="In flight" value={inFlight.length} />
        <StatCard
          label="With overdue items"
          value={blocked.length}
          tone={blocked.length ? 'warning' : 'default'}
        />
        <StatCard label="Completed" value={completed.length} tone="positive" />
        <StatCard
          label="Average time to go live"
          value={avgDays === null ? '—' : `${avgDays} days`}
          hint={completed.length ? `Across ${completed.length} clients` : 'No completions yet'}
        />
      </div>

      <OnboardingBoard cards={cards} stages={[...ONBOARDING_STAGES]} />
    </>
  );
}
