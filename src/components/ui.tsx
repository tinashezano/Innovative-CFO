import Link from 'next/link';
import { cn, formatDayMonth } from '@/lib/utils';
import {
  LEAD_STAGE_LABELS,
  ONBOARDING_STAGE_LABELS,
  PROPOSAL_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type LeadStage,
  type OnboardingStage,
  type ProposalStatus,
  type TaskPriority,
  type TaskStatus,
} from '@/lib/constants';

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center justify-center px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      {description ? <p className="mt-1 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone = 'default',
}: {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: 'default' | 'positive' | 'warning' | 'danger';
}) {
  const toneClass = {
    default: 'text-slate-900',
    positive: 'text-emerald-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
  }[tone];

  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={cn('mt-2 text-2xl font-bold tracking-tight', toneClass)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="card card-pad block transition hover:border-brand-300 hover:shadow">
        {body}
      </Link>
    );
  }
  return <div className="card card-pad">{body}</div>;
}

// --- Status pills ---------------------------------------------------------

const LEAD_STAGE_CLASSES: Record<LeadStage, string> = {
  NEW: 'bg-slate-100 text-slate-700',
  DISCOVERY: 'bg-sky-100 text-sky-800',
  PROPOSAL: 'bg-violet-100 text-violet-800',
  WON: 'bg-emerald-100 text-emerald-800',
  LOST: 'bg-red-100 text-red-800',
};

export function LeadStageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn('badge', LEAD_STAGE_CLASSES[stage as LeadStage] ?? 'bg-slate-100 text-slate-700')}>
      {LEAD_STAGE_LABELS[stage as LeadStage] ?? stage}
    </span>
  );
}

const PROPOSAL_STATUS_CLASSES: Record<ProposalStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-sky-100 text-sky-800',
  VIEWED: 'bg-indigo-100 text-indigo-800',
  ACCEPTED: 'bg-violet-100 text-violet-800',
  SIGNED: 'bg-amber-100 text-amber-800',
  PAID: 'bg-emerald-100 text-emerald-800',
  DECLINED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-slate-200 text-slate-600',
};

export function ProposalStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', PROPOSAL_STATUS_CLASSES[status as ProposalStatus] ?? 'bg-slate-100 text-slate-700')}>
      {PROPOSAL_STATUS_LABELS[status as ProposalStatus] ?? status}
    </span>
  );
}

const TASK_STATUS_CLASSES: Record<TaskStatus, string> = {
  TODO: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-sky-100 text-sky-800',
  BLOCKED: 'bg-red-100 text-red-800',
  REVIEW: 'bg-amber-100 text-amber-800',
  DONE: 'bg-emerald-100 text-emerald-800',
};

export function TaskStatusBadge({ status }: { status: string }) {
  return (
    <span className={cn('badge', TASK_STATUS_CLASSES[status as TaskStatus] ?? 'bg-slate-100 text-slate-700')}>
      {TASK_STATUS_LABELS[status as TaskStatus] ?? status}
    </span>
  );
}

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-sky-100 text-sky-700',
  HIGH: 'bg-amber-100 text-amber-800',
  URGENT: 'bg-red-100 text-red-800',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={cn('badge', PRIORITY_CLASSES[priority as TaskPriority] ?? 'bg-slate-100 text-slate-600')}>
      {TASK_PRIORITY_LABELS[priority as TaskPriority] ?? priority}
    </span>
  );
}

const ONBOARDING_STAGE_CLASSES: Record<OnboardingStage, string> = {
  INFORMATION_REQUESTED: 'bg-slate-100 text-slate-700',
  INFORMATION_RECEIVED: 'bg-sky-100 text-sky-800',
  SETUP: 'bg-violet-100 text-violet-800',
  REVIEW: 'bg-amber-100 text-amber-800',
  COMPLETE: 'bg-emerald-100 text-emerald-800',
};

export function OnboardingStageBadge({ stage }: { stage: string }) {
  return (
    <span className={cn('badge', ONBOARDING_STAGE_CLASSES[stage as OnboardingStage] ?? 'bg-slate-100 text-slate-700')}>
      {ONBOARDING_STAGE_LABELS[stage as OnboardingStage] ?? stage}
    </span>
  );
}

export function ClientStatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    ONBOARDING: 'bg-amber-100 text-amber-800',
    ACTIVE: 'bg-emerald-100 text-emerald-800',
    ON_HOLD: 'bg-slate-200 text-slate-700',
    OFFBOARDED: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    ONBOARDING: 'Onboarding',
    ACTIVE: 'Active',
    ON_HOLD: 'On hold',
    OFFBOARDED: 'Offboarded',
  };
  return <span className={cn('badge', classes[status] ?? 'bg-slate-100')}>{labels[status] ?? status}</span>;
}

export function Avatar({ name, color, size = 'md' }: { name: string; color?: string; size?: 'sm' | 'md' }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white',
        size === 'sm' ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-xs',
      )}
      style={{ backgroundColor: color || '#64748b' }}
      title={name}
    >
      {letters || '?'}
    </span>
  );
}

export function DueDate({ date, done }: { date: Date | string | null | undefined; done?: boolean }) {
  if (!date) return <span className="text-xs text-slate-400">No due date</span>;
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diff = Math.round((target.getTime() - today.getTime()) / 86400000);

  const tone = done
    ? 'text-slate-400'
    : diff < 0
      ? 'text-red-600 font-semibold'
      : diff === 0
        ? 'text-amber-600 font-semibold'
        : diff <= 3
          ? 'text-amber-600'
          : 'text-slate-500';

  const label = formatDayMonth(d);
  const suffix = done ? '' : diff < 0 ? ` · ${Math.abs(diff)}d overdue` : diff === 0 ? ' · today' : '';

  return (
    <span className={cn('text-xs', tone)}>
      {label}
      {suffix}
    </span>
  );
}

export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 text-xs font-medium text-slate-500">{pct}%</span>
    </div>
  );
}
