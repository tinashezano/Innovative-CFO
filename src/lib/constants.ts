// Single source of truth for every status/enum-ish string in the app.
// Kept in TypeScript rather than Prisma enums so the schema stays portable
// between SQLite and Postgres.

export const ROLES = ['OWNER', 'MANAGER', 'STAFF'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

/** Higher rank = more access. Used by requireRole(). */
export const ROLE_RANK: Record<Role, number> = { STAFF: 1, MANAGER: 2, OWNER: 3 };

// --- 1. Leads -------------------------------------------------------------

export const LEAD_STAGES = ['NEW', 'DISCOVERY', 'PROPOSAL', 'WON', 'LOST'] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  NEW: 'New lead',
  DISCOVERY: 'Discovery call',
  PROPOSAL: 'Proposal sent',
  WON: 'Won',
  LOST: 'Lost',
};

/** Columns rendered on the lead pipeline board, in order. */
export const LEAD_BOARD_STAGES: LeadStage[] = ['NEW', 'DISCOVERY', 'PROPOSAL', 'WON', 'LOST'];

export const LEAD_SOURCES = [
  'WEBSITE',
  'REFERRAL',
  'LINKEDIN',
  'EVENT',
  'COLD_OUTREACH',
  'INBOUND_CALL',
  'OTHER',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_ACTIVITY_TYPES = [
  'NOTE',
  'CALL',
  'EMAIL',
  'MEETING',
  'STAGE_CHANGE',
  'SYSTEM',
] as const;
export type LeadActivityType = (typeof LEAD_ACTIVITY_TYPES)[number];

export const BOOKING_STATUSES = ['CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_OUTCOMES = ['PROCEED', 'FOLLOW_UP', 'NOT_A_FIT'] as const;
export type BookingOutcome = (typeof BOOKING_OUTCOMES)[number];

// --- 2. Proposals ---------------------------------------------------------

export const PROPOSAL_STATUSES = [
  'DRAFT',
  'SENT',
  'VIEWED',
  'ACCEPTED',
  'SIGNED',
  'PAID',
  'DECLINED',
  'EXPIRED',
] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  VIEWED: 'Viewed',
  ACCEPTED: 'Accepted',
  SIGNED: 'Signed',
  PAID: 'Signed & paid',
  DECLINED: 'Declined',
  EXPIRED: 'Expired',
};

export const BILLING_CYCLES = ['ONE_OFF', 'MONTHLY', 'QUARTERLY', 'ANNUAL'] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  ONE_OFF: 'One-off',
  MONTHLY: 'per month',
  QUARTERLY: 'per quarter',
  ANNUAL: 'per year',
};

export const ENVELOPE_STATUSES = [
  'CREATED',
  'SENT',
  'DELIVERED',
  'COMPLETED',
  'DECLINED',
  'VOIDED',
] as const;
export type EnvelopeStatus = (typeof ENVELOPE_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'PENDING',
  'SUCCESS',
  'FAILED',
  'ABANDONED',
  'REFUNDED',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// --- 3. Clients & onboarding ---------------------------------------------

export const CLIENT_STATUSES = ['ONBOARDING', 'ACTIVE', 'ON_HOLD', 'OFFBOARDED'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const ONBOARDING_STAGES = [
  'INFORMATION_REQUESTED',
  'INFORMATION_RECEIVED',
  'SETUP',
  'REVIEW',
  'COMPLETE',
] as const;
export type OnboardingStage = (typeof ONBOARDING_STAGES)[number];

export const ONBOARDING_STAGE_LABELS: Record<OnboardingStage, string> = {
  INFORMATION_REQUESTED: 'Information requested',
  INFORMATION_RECEIVED: 'Information received',
  SETUP: 'Setup',
  REVIEW: 'Review',
  COMPLETE: 'Complete',
};

export const ONBOARDING_ITEM_STATUSES = ['PENDING', 'RECEIVED', 'APPROVED', 'WAIVED'] as const;
export type OnboardingItemStatus = (typeof ONBOARDING_ITEM_STATUSES)[number];

export const ONBOARDING_ITEM_TYPES = ['DOCUMENT', 'INFO', 'ACTION'] as const;
export type OnboardingItemType = (typeof ONBOARDING_ITEM_TYPES)[number];

// --- 4. Tasks -------------------------------------------------------------

export const TASK_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  TODO: 'To do',
  IN_PROGRESS: 'In progress',
  BLOCKED: 'Blocked',
  REVIEW: 'Review',
  DONE: 'Done',
};

export const TASK_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
};

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  URGENT: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const TASK_CATEGORIES = [
  'BOOKKEEPING',
  'VAT',
  'PAYROLL',
  'ANNUAL_ACCOUNTS',
  'TAX',
  'ADVISORY',
  'COMPLIANCE',
  'ONBOARDING',
  'SALES',
  'OTHER',
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  BOOKKEEPING: 'Bookkeeping',
  VAT: 'VAT',
  PAYROLL: 'Payroll',
  ANNUAL_ACCOUNTS: 'Annual accounts',
  TAX: 'Tax',
  ADVISORY: 'Advisory',
  COMPLIANCE: 'Compliance',
  ONBOARDING: 'Onboarding',
  SALES: 'Sales',
  OTHER: 'Other',
};

export const TASK_SOURCES = ['MANUAL', 'RECURRING', 'ONBOARDING', 'PIPELINE'] as const;
export type TaskSource = (typeof TASK_SOURCES)[number];

export const RECURRENCE_FREQUENCIES = [
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'SEMIANNUAL',
  'ANNUAL',
] as const;
export type RecurrenceFrequency = (typeof RECURRENCE_FREQUENCIES)[number];

export const RECURRENCE_FREQUENCY_LABELS: Record<RecurrenceFrequency, string> = {
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Every 2 weeks',
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  SEMIANNUAL: 'Every 6 months',
  ANNUAL: 'Annually',
};

export const REMINDER_KINDS = ['BEFORE_DUE', 'DUE_TODAY', 'OVERDUE'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

// --- Shared ---------------------------------------------------------------

export const TASK_VIEWS = ['list', 'board', 'calendar', 'timeline'] as const;
export type TaskView = (typeof TASK_VIEWS)[number];

export const CURRENCIES = ['ZAR', 'USD', 'GBP', 'EUR', 'NGN', 'KES', 'GHS'] as const;

export const CURRENCY_SYMBOLS: Record<string, string> = {
  ZAR: 'R',
  USD: '$',
  GBP: '£',
  EUR: '€',
  NGN: '₦',
  KES: 'KSh',
  GHS: 'GH₵',
};

/** Paystack settles in the currency's smallest unit (cents/kobo). */
export const PAYSTACK_SUPPORTED_CURRENCIES = ['ZAR', 'NGN', 'GHS', 'KES', 'USD'];
