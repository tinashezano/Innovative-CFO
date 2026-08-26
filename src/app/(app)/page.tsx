import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { formatMoney, formatDayMonth, formatWeekdayDateTime, startOfDay, addDays } from '@/lib/utils';
import {
  Avatar,
  DueDate,
  OnboardingStageBadge,
  PageHeader,
  PriorityBadge,
  StatCard,
} from '@/components/ui';
import { LEAD_BOARD_STAGES, LEAD_STAGE_LABELS } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requirePageUser();
  const settings = await getSettings();

  const today = startOfDay(new Date());
  const weekAhead = addDays(today, 7);

  const [
    leadsByStage,
    openProposals,
    pipelineValue,
    activeClients,
    onboardingClients,
    myOpenTasks,
    overdueTasks,
    dueThisWeek,
    upcomingCalls,
    recentActivity,
    onboardings,
  ] = await Promise.all([
    prisma.lead.groupBy({ by: ['stage'], _count: { _all: true }, _sum: { estimatedValue: true } }),
    prisma.proposal.count({ where: { status: { in: ['SENT', 'VIEWED', 'ACCEPTED', 'SIGNED'] } } }),
    prisma.proposal.aggregate({
      _sum: { total: true },
      where: { status: { in: ['SENT', 'VIEWED', 'ACCEPTED'] } },
    }),
    prisma.client.count({ where: { status: 'ACTIVE' } }),
    prisma.client.count({ where: { status: 'ONBOARDING' } }),
    prisma.task.count({
      where: { assigneeId: user.id, status: { not: 'DONE' }, parentId: null, archivedAt: null },
    }),
    prisma.task.findMany({
      where: { status: { not: 'DONE' }, archivedAt: null, dueDate: { lt: today } },
      include: { client: true, assignee: true },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),
    prisma.task.findMany({
      where: {
        status: { not: 'DONE' },
        archivedAt: null,
        dueDate: { gte: today, lte: weekAhead },
      },
      include: { client: true, assignee: true },
      orderBy: { dueDate: 'asc' },
      take: 8,
    }),
    prisma.discoveryBooking.findMany({
      where: { status: 'CONFIRMED', scheduledAt: { gte: new Date() } },
      include: { lead: true },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
    }),
    prisma.leadActivity.findMany({
      include: { lead: { select: { id: true, companyName: true } }, user: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.onboarding.findMany({
      where: { stage: { not: 'COMPLETE' } },
      include: {
        client: true,
        items: { select: { status: true } },
      },
      orderBy: { startedAt: 'asc' },
      take: 5,
    }),
  ]);

  const stageCount = (stage: string) => leadsByStage.find((s) => s.stage === stage)?._count._all ?? 0;
  const openLeads = stageCount('NEW') + stageCount('DISCOVERY') + stageCount('PROPOSAL');
  const openLeadValue = leadsByStage
    .filter((s) => ['NEW', 'DISCOVERY', 'PROPOSAL'].includes(s.stage))
    .reduce((sum, s) => sum + (s._sum.estimatedValue ?? 0), 0);

  return (
    <>
      <PageHeader
        title={`Good day, ${user.name.split(' ')[0]}`}
        subtitle="Everything moving through the firm right now."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open leads"
          value={openLeads}
          hint={`${formatMoney(openLeadValue, settings.defaultCurrency)} estimated`}
          href="/leads"
        />
        <StatCard
          label="Proposals in play"
          value={openProposals}
          hint={`${formatMoney(pipelineValue._sum.total ?? 0, settings.defaultCurrency)} awaiting decision`}
          href="/proposals"
        />
        <StatCard
          label="Clients"
          value={activeClients}
          hint={`${onboardingClients} still onboarding`}
          href="/clients"
        />
        <StatCard
          label="Your open tasks"
          value={myOpenTasks}
          hint={overdueTasks.length ? `${overdueTasks.length} overdue firm-wide` : 'Nothing overdue'}
          tone={overdueTasks.length ? 'warning' : 'default'}
          href="/tasks?assignee=me"
        />
      </div>

      {/* Pipeline snapshot */}
      <section className="mt-6">
        <div className="card card-pad">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Pipeline</h2>
            <Link href="/leads" className="link text-xs">
              Open the board
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {LEAD_BOARD_STAGES.map((stage) => {
              const row = leadsByStage.find((s) => s.stage === stage);
              return (
                <Link
                  key={stage}
                  href={`/leads?stage=${stage}`}
                  className="rounded-lg border border-slate-200 px-3 py-3 transition hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <p className="text-xs font-medium text-slate-500">{LEAD_STAGE_LABELS[stage]}</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{row?._count._all ?? 0}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {formatMoney(row?._sum.estimatedValue ?? 0, settings.defaultCurrency)}
                  </p>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        {/* Overdue + due this week */}
        <div className="xl:col-span-2 space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Overdue
                {overdueTasks.length ? (
                  <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                    {overdueTasks.length}
                  </span>
                ) : null}
              </h2>
              <Link href="/tasks?view=list&due=overdue" className="link text-xs">
                View all
              </Link>
            </div>
            {overdueTasks.length ? (
              <ul className="divide-y divide-slate-100">
                {overdueTasks.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                Nothing overdue. The whole firm is on schedule.
              </p>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Due in the next 7 days</h2>
              <Link href="/tasks?view=calendar" className="link text-xs">
                Calendar
              </Link>
            </div>
            {dueThisWeek.length ? (
              <ul className="divide-y divide-slate-100">
                {dueThisWeek.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">Nothing due this week.</p>
            )}
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Upcoming discovery calls</h2>
              <Link href="/bookings" className="link text-xs">
                All
              </Link>
            </div>
            {upcomingCalls.length ? (
              <ul className="divide-y divide-slate-100">
                {upcomingCalls.map((booking) => (
                  <li key={booking.id} className="px-5 py-3">
                    <Link href={`/leads/${booking.leadId}`} className="block group">
                      <p className="text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                        {booking.lead.companyName}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {formatWeekdayDateTime(booking.scheduledAt)} · {booking.durationMins} min
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No calls booked.</p>
            )}
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Onboarding in flight</h2>
              <Link href="/onboarding" className="link text-xs">
                Board
              </Link>
            </div>
            {onboardings.length ? (
              <ul className="divide-y divide-slate-100">
                {onboardings.map((ob) => {
                  const done = ob.items.filter((i) => ['APPROVED', 'WAIVED'].includes(i.status)).length;
                  return (
                    <li key={ob.id} className="px-5 py-3">
                      <Link href={`/clients/${ob.clientId}`} className="block group">
                        <div className="flex items-center justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-brand-700">
                            {ob.client.name}
                          </p>
                          <OnboardingStageBadge stage={ob.stage} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {done} of {ob.items.length} checklist items complete
                        </p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No clients onboarding.</p>
            )}
          </section>

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Latest pipeline activity</h2>
            </div>
            {recentActivity.length ? (
              <ul className="divide-y divide-slate-100">
                {recentActivity.map((activity) => (
                  <li key={activity.id} className="px-5 py-3">
                    <p className="text-xs text-slate-600">
                      <Link href={`/leads/${activity.leadId}`} className="font-semibold text-slate-900 hover:text-brand-700">
                        {activity.lead.companyName}
                      </Link>{' '}
                      — {activity.body}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {formatDayMonth(activity.createdAt)}
                      {activity.user ? ` · ${activity.user.name}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No activity yet.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function TaskRow({
  task,
}: {
  task: {
    id: string;
    reference: string;
    title: string;
    priority: string;
    dueDate: Date | null;
    client: { name: string; colorTag: string } | null;
    assignee: { name: string; avatarColor: string } | null;
  };
}) {
  return (
    <li>
      <Link
        href={`/tasks/${task.id}`}
        className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500">
            <span>{task.reference}</span>
            {task.client ? (
              <>
                <span aria-hidden>·</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: task.client.colorTag }}
                    aria-hidden
                  />
                  {task.client.name}
                </span>
              </>
            ) : null}
          </p>
        </div>
        <PriorityBadge priority={task.priority} />
        <DueDate date={task.dueDate} />
        {task.assignee ? <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="sm" /> : null}
        <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
      </Link>
    </li>
  );
}
