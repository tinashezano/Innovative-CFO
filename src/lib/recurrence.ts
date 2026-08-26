import { addDays, addMonths, daysInMonth, startOfDay } from './utils';
import type { RecurrenceFrequency } from './constants';

export type RecurrenceRule = {
  frequency: RecurrenceFrequency;
  interval: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  startDate: Date;
  endDate?: Date | null;
};

const MONTHS_PER_PERIOD: Partial<Record<RecurrenceFrequency, number>> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMIANNUAL: 6,
  ANNUAL: 12,
};

/**
 * Returns the first due date on or after `from` for the given rule, or null
 * once the rule has passed its end date.
 *
 * Month-based rules snap to `dayOfMonth`, clamped to the length of the month
 * (a "31st" rule falls on 28/29 February). Quarterly, semi-annual and annual
 * rules are anchored on `monthOfYear` so a March year-end firm gets Mar/Jun/
 * Sep/Dec rather than whatever month the template happened to be created in.
 */
export function nextOccurrence(rule: RecurrenceRule, from: Date): Date | null {
  const interval = Math.max(1, rule.interval || 1);
  const anchor = startOfDay(rule.startDate);
  const cursorStart = startOfDay(from > anchor ? from : anchor);

  let candidate: Date | null = null;

  switch (rule.frequency) {
    case 'DAILY': {
      const elapsed = Math.floor((cursorStart.getTime() - anchor.getTime()) / 86400000);
      const steps = Math.max(0, Math.ceil(elapsed / interval));
      candidate = addDays(anchor, steps * interval);
      break;
    }

    case 'WEEKLY':
    case 'BIWEEKLY': {
      const weekStep = (rule.frequency === 'BIWEEKLY' ? 2 : 1) * interval;
      const targetDow = rule.dayOfWeek ?? anchor.getDay();

      // First occurrence of the target weekday on or after the anchor.
      let first = startOfDay(anchor);
      const shift = (targetDow - first.getDay() + 7) % 7;
      first = addDays(first, shift);

      if (cursorStart <= first) {
        candidate = first;
      } else {
        const weeksElapsed = Math.floor((cursorStart.getTime() - first.getTime()) / (7 * 86400000));
        const steps = Math.ceil(weeksElapsed / weekStep);
        candidate = addDays(first, steps * weekStep * 7);
        if (candidate < cursorStart) candidate = addDays(candidate, weekStep * 7);
      }
      break;
    }

    case 'MONTHLY':
    case 'QUARTERLY':
    case 'SEMIANNUAL':
    case 'ANNUAL': {
      const monthStep = (MONTHS_PER_PERIOD[rule.frequency] ?? 1) * interval;
      const day = rule.dayOfMonth ?? anchor.getDate();

      // Anchor month: for multi-month cadences honour monthOfYear when given.
      let base = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      if (rule.monthOfYear && monthStep > 1) {
        base = new Date(anchor.getFullYear(), rule.monthOfYear - 1, 1);
        // Walk the anchor back so the first occurrence is never before startDate.
        while (base > anchor) base = addMonths(base, -monthStep);
      }

      let occurrence = withDay(base, day);
      let guard = 0;
      while ((occurrence < cursorStart || occurrence < anchor) && guard < 600) {
        base = addMonths(base, monthStep);
        occurrence = withDay(base, day);
        guard += 1;
      }
      candidate = occurrence;
      break;
    }
  }

  if (!candidate) return null;
  if (rule.endDate && candidate > startOfDay(rule.endDate)) return null;
  return candidate;
}

function withDay(monthStart: Date, day: number): Date {
  const clamped = Math.min(Math.max(1, day), daysInMonth(monthStart.getFullYear(), monthStart.getMonth()));
  return new Date(monthStart.getFullYear(), monthStart.getMonth(), clamped, 0, 0, 0, 0);
}

/**
 * Stable key identifying the period a generated task belongs to. Paired with a
 * unique index on (templateId, periodKey), this makes generation idempotent —
 * running the job twice in one day cannot double up tasks.
 */
export function periodKeyFor(frequency: RecurrenceFrequency, dueDate: Date): string {
  const y = dueDate.getFullYear();
  const m = dueDate.getMonth() + 1;
  const pad = (n: number) => String(n).padStart(2, '0');

  switch (frequency) {
    case 'DAILY':
      return `${y}-${pad(m)}-${pad(dueDate.getDate())}`;
    case 'WEEKLY':
    case 'BIWEEKLY':
      return `${y}-W${pad(isoWeek(dueDate))}`;
    case 'QUARTERLY':
      return `${y}-Q${Math.floor((m - 1) / 3) + 1}`;
    case 'SEMIANNUAL':
      return `${y}-H${m <= 6 ? 1 : 2}`;
    case 'ANNUAL':
      return `${y}`;
    case 'MONTHLY':
    default:
      return `${y}-${pad(m)}`;
  }
}

function isoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function describeRecurrence(rule: {
  frequency: string;
  interval: number;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
}): string {
  const dows = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const every = rule.interval > 1 ? `every ${rule.interval} ` : '';

  switch (rule.frequency) {
    case 'DAILY':
      return rule.interval > 1 ? `Every ${rule.interval} days` : 'Every day';
    case 'WEEKLY':
      return `${every ? `Every ${rule.interval} weeks` : 'Weekly'} on ${dows[rule.dayOfWeek ?? 1]}`;
    case 'BIWEEKLY':
      return `Every 2 weeks on ${dows[rule.dayOfWeek ?? 1]}`;
    case 'MONTHLY':
      return `${every ? `Every ${rule.interval} months` : 'Monthly'} on day ${rule.dayOfMonth ?? 1}`;
    case 'QUARTERLY':
      return `Quarterly on day ${rule.dayOfMonth ?? 1}${rule.monthOfYear ? `, from ${months[rule.monthOfYear - 1]}` : ''}`;
    case 'SEMIANNUAL':
      return `Every 6 months on day ${rule.dayOfMonth ?? 1}${rule.monthOfYear ? `, from ${months[rule.monthOfYear - 1]}` : ''}`;
    case 'ANNUAL':
      return `Annually on ${rule.dayOfMonth ?? 1} ${months[(rule.monthOfYear ?? 1) - 1]}`;
    default:
      return rule.frequency;
  }
}
