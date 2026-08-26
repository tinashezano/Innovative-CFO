import 'server-only';
import { prisma } from './db';
import { parseJson } from './utils';

export type FirmSettings = {
  firmName: string;
  firmEmail: string;
  firmPhone: string;
  firmAddress: string;
  defaultCurrency: string;
  /** Days before a task's due date that reminder emails fire. */
  reminderOffsetDays: number[];
  overdueRemindersEnabled: boolean;
  /** Weekday indexes (0=Sun) the team accepts discovery calls on. */
  discoveryDays: number[];
  discoveryStartHour: number;
  discoveryEndHour: number;
  discoveryDurationMins: number;
  discoverySlotMinutes: number;
  proposalValidityDays: number;
  welcomePackHtml: string;
  engagementTermsHtml: string;
};

const KEY = 'firm';

function envDefaults(): FirmSettings {
  const offsets = (process.env.REMINDER_OFFSET_DAYS || '7,3,1,0')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n >= 0);

  return {
    firmName: process.env.FIRM_NAME || 'Innovative CFO',
    firmEmail: process.env.FIRM_EMAIL || 'hello@innovativecfo.co.za',
    firmPhone: process.env.FIRM_PHONE || '',
    firmAddress: process.env.FIRM_ADDRESS || '',
    defaultCurrency: process.env.DEFAULT_CURRENCY || 'ZAR',
    reminderOffsetDays: offsets.length ? Array.from(new Set(offsets)).sort((a, b) => b - a) : [7, 3, 1, 0],
    overdueRemindersEnabled: (process.env.REMINDER_OVERDUE_ENABLED || 'true') === 'true',
    discoveryDays: [1, 2, 3, 4, 5],
    discoveryStartHour: 9,
    discoveryEndHour: 16,
    discoveryDurationMins: 30,
    discoverySlotMinutes: 30,
    proposalValidityDays: 30,
    welcomePackHtml: DEFAULT_WELCOME_PACK,
    engagementTermsHtml: DEFAULT_ENGAGEMENT_TERMS,
  };
}

export async function getSettings(): Promise<FirmSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const defaults = envDefaults();
  if (!row) return defaults;
  return { ...defaults, ...parseJson<Partial<FirmSettings>>(row.value, {}) };
}

export async function saveSettings(patch: Partial<FirmSettings>): Promise<FirmSettings> {
  const current = await getSettings();
  const next = { ...current, ...patch };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: JSON.stringify(next) },
    update: { value: JSON.stringify(next) },
  });
  return next;
}

export const DEFAULT_WELCOME_PACK = `
<h2>Welcome to {{firmName}}</h2>
<p>Hi {{clientName}},</p>
<p>Thank you for signing your engagement letter and settling your first invoice — we are delighted to be working with you.</p>
<h3>What happens next</h3>
<ol>
  <li><strong>Information request</strong> — we will email a short checklist of the documents and access we need.</li>
  <li><strong>Setup</strong> — we configure your ledger, chart of accounts and reporting pack.</li>
  <li><strong>Review</strong> — we walk you through the setup and confirm your reporting calendar.</li>
  <li><strong>Go live</strong> — your recurring compliance calendar starts running automatically.</li>
</ol>
<h3>Your team</h3>
<p>{{ownerName}} is your account manager and your first point of contact on {{firmEmail}}.</p>
<p>We look forward to a long partnership.</p>
<p>— The {{firmName}} team</p>
`.trim();

export const DEFAULT_ENGAGEMENT_TERMS = `
<h3>1. Scope of services</h3>
<p>{{firmName}} ("the Firm") will provide {{clientName}} ("the Client") with the services set out in the accompanying proposal. Any work outside that scope will be quoted separately and agreed in writing before it begins.</p>
<h3>2. Fees and payment</h3>
<p>Fees are as stated in the proposal. Recurring fees are billed in advance on the first business day of each period and are payable on receipt. The Firm may suspend services on accounts more than 30 days in arrears.</p>
<h3>3. Client responsibilities</h3>
<p>The Client is responsible for the completeness and accuracy of the records, information and explanations supplied to the Firm, and for maintaining an adequate system of internal control. The Client will provide requested information within a reasonable time so that statutory deadlines can be met.</p>
<h3>4. Firm responsibilities</h3>
<p>The Firm will perform the services with reasonable professional skill and care, in accordance with applicable professional standards. Unless expressly stated, the engagement does not constitute an audit and cannot be relied upon to detect fraud or error.</p>
<h3>5. Confidentiality and data protection</h3>
<p>Each party will keep the other's confidential information secure and use it only for the purposes of this engagement, except where disclosure is required by law or regulation. Personal information is processed in line with applicable data protection legislation.</p>
<h3>6. Limitation of liability</h3>
<p>The Firm's aggregate liability arising from this engagement is limited to the fees paid by the Client in the twelve months preceding the event giving rise to the claim, save for liability that cannot lawfully be excluded.</p>
<h3>7. Term and termination</h3>
<p>This engagement continues until terminated by either party on 30 days' written notice. Fees for work performed up to the termination date remain payable.</p>
<h3>8. Governing law</h3>
<p>This engagement is governed by the laws of the Republic of South Africa.</p>
`.trim();
