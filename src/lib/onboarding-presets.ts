import type { OnboardingItemType, OnboardingStage, RecurrenceFrequency, TaskCategory, TaskPriority } from './constants';

/**
 * The firm's standard onboarding checklist. Cloned onto every new client when
 * onboarding opens, then editable per client.
 */
export const ONBOARDING_CHECKLIST: {
  stage: OnboardingStage;
  title: string;
  description: string;
  type: OnboardingItemType;
  required: boolean;
  dueInDays: number;
}[] = [
  // --- Information requested ---
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'Certificate of incorporation',
    description: 'CIPC registration certificate (CoR 14.3) or equivalent.',
    type: 'DOCUMENT',
    required: true,
    dueInDays: 7,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'Director / member IDs',
    description: 'Certified copies of ID for every director or member.',
    type: 'DOCUMENT',
    required: true,
    dueInDays: 7,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'SARS registration details',
    description: 'Income tax, VAT and PAYE reference numbers.',
    type: 'INFO',
    required: true,
    dueInDays: 7,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'Bank statements — last 12 months',
    description: 'PDF or CSV statements for every business account.',
    type: 'DOCUMENT',
    required: true,
    dueInDays: 10,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'Prior year financial statements',
    description: 'Signed annual financial statements for the last completed year.',
    type: 'DOCUMENT',
    required: false,
    dueInDays: 10,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'Accounting system access',
    description: 'Invite us to your Xero / QuickBooks / Sage file as an adviser.',
    type: 'ACTION',
    required: true,
    dueInDays: 7,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'Payroll register',
    description: 'Current employee list, salaries and payroll history.',
    type: 'DOCUMENT',
    required: false,
    dueInDays: 10,
  },
  {
    stage: 'INFORMATION_REQUESTED',
    title: 'FICA / KYC pack',
    description: 'Proof of address and beneficial ownership declaration.',
    type: 'DOCUMENT',
    required: true,
    dueInDays: 7,
  },

  // --- Information received ---
  {
    stage: 'INFORMATION_RECEIVED',
    title: 'Verify documents received',
    description: 'Check every required item is present, legible and current.',
    type: 'ACTION',
    required: true,
    dueInDays: 12,
  },
  {
    stage: 'INFORMATION_RECEIVED',
    title: 'Complete client acceptance checks',
    description: 'Independence, conflict and risk assessment sign-off.',
    type: 'ACTION',
    required: true,
    dueInDays: 12,
  },

  // --- Setup ---
  {
    stage: 'SETUP',
    title: 'Create the ledger file',
    description: 'Set up the accounting file, chart of accounts and tax rates.',
    type: 'ACTION',
    required: true,
    dueInDays: 16,
  },
  {
    stage: 'SETUP',
    title: 'Load opening balances',
    description: 'Capture opening trial balance from the prior year statements.',
    type: 'ACTION',
    required: true,
    dueInDays: 16,
  },
  {
    stage: 'SETUP',
    title: 'Connect bank feeds',
    description: 'Establish live bank feeds for every account.',
    type: 'ACTION',
    required: true,
    dueInDays: 16,
  },
  {
    stage: 'SETUP',
    title: 'Configure the reporting pack',
    description: 'Management accounts template and reporting calendar.',
    type: 'ACTION',
    required: true,
    dueInDays: 18,
  },

  // --- Review ---
  {
    stage: 'REVIEW',
    title: 'Internal quality review',
    description: 'Manager review of setup, balances and compliance calendar.',
    type: 'ACTION',
    required: true,
    dueInDays: 20,
  },
  {
    stage: 'REVIEW',
    title: 'Client walkthrough call',
    description: 'Walk the client through their reporting pack and deadlines.',
    type: 'ACTION',
    required: true,
    dueInDays: 21,
  },

  // --- Complete ---
  {
    stage: 'COMPLETE',
    title: 'Confirm go-live',
    description: 'Client moves to Active and the recurring calendar takes over.',
    type: 'ACTION',
    required: true,
    dueInDays: 21,
  },
];

/**
 * The recurring compliance calendar installed for a new client.
 *
 * Presets without `matchKeywords` are installed for every client. The rest only
 * appear when the signed proposal actually included that service, so a
 * bookkeeping-only client does not get payroll tasks.
 *
 * Dates follow the South African compliance calendar; adjust in Settings or per
 * client from the Recurring tab.
 */
export const RECURRING_TEMPLATE_PRESETS: {
  name: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  frequency: RecurrenceFrequency;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  leadTimeDays: number;
  subtasks: string[];
  matchKeywords?: string[];
}[] = [
  {
    name: 'Monthly bookkeeping',
    description: 'Process the month, reconcile every account and close the period.',
    category: 'BOOKKEEPING',
    priority: 'HIGH',
    frequency: 'MONTHLY',
    dayOfMonth: 7,
    leadTimeDays: 7,
    subtasks: [
      'Import and categorise bank transactions',
      'Reconcile bank and credit card accounts',
      'Reconcile debtors and creditors',
      'Post accruals and prepayments',
      'Lock the period',
    ],
  },
  {
    name: 'Management accounts',
    description: 'Prepare and issue the monthly management reporting pack.',
    category: 'ADVISORY',
    priority: 'MEDIUM',
    frequency: 'MONTHLY',
    dayOfMonth: 12,
    leadTimeDays: 5,
    subtasks: [
      'Prepare the reporting pack',
      'Write the commentary',
      'Manager review',
      'Issue to the client',
    ],
  },
  {
    name: 'VAT return',
    description: 'Prepare, review and submit the VAT201 return.',
    category: 'VAT',
    priority: 'URGENT',
    frequency: 'QUARTERLY',
    dayOfMonth: 25,
    monthOfYear: 2,
    leadTimeDays: 10,
    subtasks: [
      'Reconcile the VAT control account',
      'Review input and output VAT',
      'Prepare the VAT201',
      'Client approval',
      'Submit to SARS and file the confirmation',
    ],
    matchKeywords: ['vat', 'tax', 'compliance'],
  },
  {
    name: 'Payroll run',
    description: 'Process payroll, issue payslips and file the monthly EMP201.',
    category: 'PAYROLL',
    priority: 'URGENT',
    frequency: 'MONTHLY',
    dayOfMonth: 20,
    leadTimeDays: 5,
    subtasks: [
      'Collect payroll changes',
      'Process the payroll run',
      'Issue payslips',
      'Prepare and submit the EMP201',
      'Load the salary payment file',
    ],
    matchKeywords: ['payroll', 'salary', 'emp'],
  },
  {
    name: 'Provisional tax return',
    description: 'Prepare and submit the IRP6 provisional tax return.',
    category: 'TAX',
    priority: 'URGENT',
    frequency: 'SEMIANNUAL',
    dayOfMonth: 25,
    monthOfYear: 2,
    leadTimeDays: 14,
    subtasks: [
      'Estimate taxable income',
      'Calculate the provisional payment',
      'Client approval',
      'Submit the IRP6',
      'Confirm payment to SARS',
    ],
    matchKeywords: ['tax', 'provisional', 'compliance'],
  },
  {
    name: 'Annual financial statements',
    description: 'Compile the annual financial statements and the income tax return.',
    category: 'ANNUAL_ACCOUNTS',
    priority: 'HIGH',
    frequency: 'ANNUAL',
    dayOfMonth: 30,
    monthOfYear: 9,
    leadTimeDays: 45,
    subtasks: [
      'Prepare the year-end file',
      'Post year-end journals',
      'Draft the financial statements',
      'Partner review',
      'Client sign-off',
      'Submit the ITR14',
    ],
  },
  {
    name: 'CIPC annual return',
    description: 'File the annual return with CIPC before the anniversary date.',
    category: 'COMPLIANCE',
    priority: 'HIGH',
    frequency: 'ANNUAL',
    dayOfMonth: 15,
    monthOfYear: 6,
    leadTimeDays: 30,
    subtasks: ['Confirm company details', 'Calculate the fee', 'File and pay', 'File the confirmation'],
  },
  {
    name: 'Quarterly client review call',
    description: 'Structured review of performance, cash flow and upcoming deadlines.',
    category: 'ADVISORY',
    priority: 'MEDIUM',
    frequency: 'QUARTERLY',
    dayOfMonth: 20,
    monthOfYear: 3,
    leadTimeDays: 7,
    subtasks: ['Prepare the review pack', 'Hold the call', 'Circulate actions'],
  },
];
