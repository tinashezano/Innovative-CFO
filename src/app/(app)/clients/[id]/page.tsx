import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Mail, Phone, Plus } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/utils';
import {
  Avatar,
  ClientStatusBadge,
  DueDate,
  PageHeader,
  PriorityBadge,
  ProposalStatusBadge,
  TaskStatusBadge,
} from '@/components/ui';
import { OnboardingPanel } from './onboarding-panel';
import { ClientStatusControl } from './client-status';
import { describeRecurrence } from '@/lib/recurrence';

export const dynamic = 'force-dynamic';

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser();
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      owner: true,
      contacts: { orderBy: { isPrimary: 'desc' } },
      lead: { select: { id: true, reference: true } },
      onboarding: {
        include: { owner: true, items: { orderBy: [{ sortOrder: 'asc' }] } },
      },
      proposals: { orderBy: { createdAt: 'desc' } },
      payments: { orderBy: { createdAt: 'desc' }, take: 5 },
      templates: { include: { assignee: true }, orderBy: { name: 'asc' } },
      tasks: {
        where: { parentId: null, archivedAt: null },
        include: { assignee: true, subtasks: { select: { status: true } } },
        orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
        take: 25,
      },
    },
  });

  if (!client) notFound();

  const openTasks = client.tasks.filter((t) => t.status !== 'DONE');
  const paidTotal = client.payments
    .filter((p) => p.status === 'SUCCESS')
    .reduce((s, p) => s + p.amount, 0);

  return (
    <>
      <Link href="/clients" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to clients
      </Link>

      <PageHeader
        title={client.name}
        subtitle={`${client.reference}${client.legalName ? ` · ${client.legalName}` : ''}`}
        actions={
          <>
            <ClientStatusControl clientId={client.id} status={client.status} />
            <Link href={`/tasks/new?clientId=${client.id}`} className="btn-primary">
              <Plus className="h-4 w-4" aria-hidden />
              New task
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {client.onboarding ? (
            <OnboardingPanel
              onboardingId={client.onboarding.id}
              stage={client.onboarding.stage}
              ownerName={client.onboarding.owner?.name ?? null}
              targetCompleteAt={client.onboarding.targetCompleteAt?.toISOString() ?? null}
              welcomePackSentAt={client.onboarding.welcomePackSentAt?.toISOString() ?? null}
              items={client.onboarding.items.map((i) => ({
                id: i.id,
                title: i.title,
                description: i.description,
                stage: i.stage,
                type: i.type,
                required: i.required,
                status: i.status,
                dueDate: i.dueDate?.toISOString() ?? null,
              }))}
            />
          ) : null}

          {/* Tasks */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Tasks
                <span className="ml-2 text-xs font-normal text-slate-500">{openTasks.length} open</span>
              </h2>
              <Link href={`/tasks?client=${client.id}`} className="link text-xs">
                Open the board
              </Link>
            </div>
            {client.tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {client.tasks.map((task) => {
                  const done = task.subtasks.filter((s) => s.status === 'DONE').length;
                  return (
                    <li key={task.id}>
                      <Link
                        href={`/tasks/${task.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">{task.title}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {task.reference}
                            {task.subtasks.length ? ` · ${done}/${task.subtasks.length} subtasks` : ''}
                          </p>
                        </div>
                        <TaskStatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        <DueDate date={task.dueDate} done={task.status === 'DONE'} />
                        {task.assignee ? (
                          <Avatar name={task.assignee.name} color={task.assignee.avatarColor} size="sm" />
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">No tasks yet.</p>
            )}
          </section>

          {/* Recurring calendar */}
          <section className="card">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Recurring calendar</h2>
              <Link href={`/recurring?client=${client.id}`} className="link text-xs">
                Manage
              </Link>
            </div>
            {client.templates.length ? (
              <ul className="divide-y divide-slate-100">
                {client.templates.map((template) => (
                  <li key={template.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{template.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {describeRecurrence(template)}
                        {template.assignee ? ` · ${template.assignee.name}` : ''}
                      </p>
                    </div>
                    <span
                      className={`badge shrink-0 ${template.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {template.active ? 'Active' : 'Paused'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-slate-500">
                No recurring work scheduled.{' '}
                <Link href={`/recurring?client=${client.id}`} className="link">
                  Set up the calendar
                </Link>
                .
              </p>
            )}
          </section>
        </div>

        {/* Right rail */}
        <div className="space-y-6">
          <section className="card card-pad">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Overview</h2>
              <ClientStatusBadge status={client.status} />
            </div>
            <dl className="space-y-3 text-sm">
              <Row label="Monthly fee" value={formatMoney(client.monthlyFee, client.currency)} />
              <Row label="Client since" value={formatDate(client.startDate)} />
              {client.industry ? <Row label="Industry" value={client.industry} /> : null}
              {client.financialYearEnd ? <Row label="Year end" value={client.financialYearEnd} /> : null}
              {client.registrationNumber ? <Row label="Registration" value={client.registrationNumber} /> : null}
              {client.taxNumber ? <Row label="Tax number" value={client.taxNumber} /> : null}
              {paidTotal ? <Row label="Collected" value={formatMoney(paidTotal, client.currency)} /> : null}
              <div>
                <dt className="text-xs text-slate-500">Account manager</dt>
                <dd className="mt-0.5">
                  {client.owner ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={client.owner.name} color={client.owner.avatarColor} size="sm" />
                      {client.owner.name}
                    </span>
                  ) : (
                    <span className="text-amber-600">Unassigned</span>
                  )}
                </dd>
              </div>
              {client.lead ? (
                <div>
                  <dt className="text-xs text-slate-500">Came from</dt>
                  <dd>
                    <Link href={`/leads/${client.lead.id}`} className="link">
                      Lead {client.lead.reference}
                    </Link>
                  </dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Contacts</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {client.contacts.map((contact) => (
                <li key={contact.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-slate-900">
                    {contact.name}
                    {contact.isPrimary ? (
                      <span className="ml-2 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">
                        Primary
                      </span>
                    ) : null}
                  </p>
                  {contact.role ? <p className="text-xs text-slate-500">{contact.role}</p> : null}
                  <p className="mt-1 space-x-3 text-xs">
                    <a href={`mailto:${contact.email}`} className="link inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" aria-hidden />
                      {contact.email}
                    </a>
                    {contact.phone ? (
                      <a href={`tel:${contact.phone}`} className="link inline-flex items-center gap-1">
                        <Phone className="h-3 w-3" aria-hidden />
                        {contact.phone}
                      </a>
                    ) : null}
                  </p>
                </li>
              ))}
              {!client.contacts.length ? (
                <li className="px-5 py-6 text-center text-sm text-slate-500">No contacts recorded.</li>
              ) : null}
            </ul>
          </section>

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Proposals</h2>
            </div>
            {client.proposals.length ? (
              <ul className="divide-y divide-slate-100">
                {client.proposals.map((proposal) => (
                  <li key={proposal.id}>
                    <Link
                      href={`/proposals/${proposal.id}`}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-slate-900">{proposal.number}</p>
                        <p className="text-xs text-slate-500">
                          {formatMoney(proposal.total, proposal.currency)}
                        </p>
                      </div>
                      <ProposalStatusBadge status={proposal.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-6 text-center text-sm text-slate-500">No proposals on file.</p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-xs text-slate-500">{label}</dt>
      <dd className="text-right text-sm text-slate-900">{value}</dd>
    </div>
  );
}
