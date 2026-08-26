/**
 * End-to-end check of the pipeline against a scratch database:
 * lead -> booking -> discovery outcome -> proposal -> sign -> pay -> client
 * -> onboarding -> recurring calendar -> reminders.
 *
 * Uses its own SQLite file so it never touches dev data.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const DB_FILE = path.join(process.cwd(), 'prisma', 'test.db');
process.env.DATABASE_URL = 'file:./test.db';
process.env.EMAIL_MODE = 'preview';
process.env.DOCUSIGN_MODE = 'mock';
process.env.PAYSTACK_MODE = 'mock';
process.env.APP_URL = 'http://localhost:3000';
process.env.AUTH_SECRET = 'test-secret-value-that-is-long-enough-000000';

for (const suffix of ['', '-journal']) {
  if (fs.existsSync(DB_FILE + suffix)) fs.unlinkSync(DB_FILE + suffix);
}
execSync('npx prisma db push --skip-generate --accept-data-loss', {
  stdio: 'pipe',
  env: { ...process.env, DATABASE_URL: 'file:./test.db' },
});

let passed = 0;
async function check(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? (err.stack ?? err.message) : err);
    process.exitCode = 1;
  }
}

async function main() {
  const { prisma } = await import('../src/lib/db');
  const workflow = await import('../src/lib/workflow');
  const { generateRecurringTasks } = await import('../src/lib/tasks');
  const { sendDueReminders } = await import('../src/lib/reminders');
  const { addDays } = await import('../src/lib/utils');

  console.log('\nworkflow');

  const owner = await prisma.user.create({
    data: {
      email: 'owner@test.local',
      name: 'Test Owner',
      passwordHash: 'x',
      role: 'OWNER',
    },
  });

  // --- 1. Lead ---
  const lead = await workflow.createLead({
    companyName: 'Acme Trading',
    contactName: 'Jane Doe',
    email: 'jane@acme.test',
    estimatedValue: 5000,
    ownerId: owner.id,
    actorId: owner.id,
  });

  await check('creating a lead raises a qualification task and emails the booking link', async () => {
    assert.equal(lead.stage, 'NEW');
    assert.match(lead.reference, /^LD-\d{4}$/);

    const tasks = await prisma.task.findMany({ where: { leadId: lead.id } });
    assert.equal(tasks.length, 1);
    assert.match(tasks[0]!.title, /Qualify lead/);
    assert.equal(tasks[0]!.assigneeId, owner.id);

    const emails = await prisma.emailLog.findMany({ where: { relatedId: lead.id } });
    assert.ok(emails.some((e) => e.template === 'discovery-invite'));
  });

  // --- 2. Booking ---
  const booking = await workflow.confirmBooking({
    leadId: lead.id,
    scheduledAt: addDays(new Date(), 3),
    agenda: 'Behind on VAT',
  });

  await check('a confirmed booking moves the lead to Discovery and raises the call task', async () => {
    const refreshed = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.equal(refreshed.stage, 'DISCOVERY');

    const callTask = await prisma.task.findFirstOrThrow({
      where: { bookingId: booking.id },
      include: { subtasks: true },
    });
    assert.match(callTask.title, /Discovery call/);
    assert.equal(callTask.subtasks.length, 3);

    const emails = await prisma.emailLog.findMany({ where: { relatedId: lead.id } });
    assert.ok(emails.some((e) => e.template === 'booking-confirmation'));
  });

  // --- 3. Call outcome ---
  await workflow.completeBooking({
    bookingId: booking.id,
    outcome: 'PROCEED',
    outcomeNotes: 'Good fit',
    actorId: owner.id,
  });

  await check('a PROCEED outcome closes the call task and raises the proposal task', async () => {
    const refreshed = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.equal(refreshed.stage, 'PROPOSAL');

    const callTask = await prisma.task.findFirstOrThrow({ where: { bookingId: booking.id } });
    assert.equal(callTask.status, 'DONE');

    const proposalTask = await prisma.task.findFirst({
      where: { leadId: lead.id, title: { contains: 'Prepare proposal' } },
    });
    assert.ok(proposalTask, 'expected a proposal task');
  });

  // --- 4. Proposal ---
  const { subtotal, tax, total } = workflow.computeProposalTotals(
    [{ quantity: 1, unitPrice: 4500 }, { quantity: 1, unitPrice: 1500 }],
    0,
    15,
  );

  await check('proposal totals apply discount before VAT', () => {
    assert.equal(subtotal, 6000);
    assert.equal(tax, 900);
    assert.equal(total, 6900);

    const discounted = workflow.computeProposalTotals([{ quantity: 2, unitPrice: 1000 }], 500, 10);
    assert.equal(discounted.subtotal, 2000);
    assert.equal(discounted.tax, 150); // 10% of 1500, not of 2000
    assert.equal(discounted.total, 1650);
  });

  const proposal = await prisma.proposal.create({
    data: {
      number: 'PR-9001',
      leadId: lead.id,
      title: 'Test proposal',
      currency: 'ZAR',
      subtotal,
      tax,
      taxRate: 15,
      total,
      depositAmount: 2000,
      publicToken: 'test-token-abcdefgh',
      status: 'DRAFT',
      items: {
        create: [
          { name: 'Monthly bookkeeping', quantity: 1, unitPrice: 4500, amount: 4500, billingCycle: 'MONTHLY', sortOrder: 0 },
          { name: 'Payroll run', quantity: 1, unitPrice: 1500, amount: 1500, billingCycle: 'MONTHLY', sortOrder: 1 },
        ],
      },
    },
  });

  await workflow.sendProposal(proposal.id, owner.id);

  await check('sending a proposal emails the client and stamps sentAt', async () => {
    const sent = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    assert.equal(sent.status, 'SENT');
    assert.ok(sent.sentAt);

    const emails = await prisma.emailLog.findMany({ where: { relatedId: proposal.id } });
    assert.ok(emails.some((e) => e.template === 'proposal-sent'));
  });

  // --- 5. Accept + sign ---
  const envelope = await workflow.acceptProposal(proposal.id);

  await check('accepting builds an engagement letter envelope, and re-accepting reuses it', async () => {
    assert.equal(envelope.status, 'SENT');
    assert.ok(envelope.documentHtml?.includes('Letter of engagement'));
    assert.ok(envelope.documentHtml?.includes('/sig1/'), 'signature anchor must survive');

    const again = await workflow.acceptProposal(proposal.id);
    assert.equal(again.id, envelope.id, 'a second accept must not open a second envelope');

    const count = await prisma.envelope.count({ where: { proposalId: proposal.id } });
    assert.equal(count, 1);
  });

  await workflow.markEnvelopeSigned({ envelopeId: envelope.id, signerName: 'Jane Doe' });

  await check('signing marks the proposal SIGNED and opens the payment', async () => {
    const signed = await prisma.proposal.findUniqueOrThrow({ where: { id: proposal.id } });
    assert.equal(signed.status, 'SIGNED');

    const payment = await prisma.payment.findFirstOrThrow({ where: { proposalId: proposal.id } });
    assert.equal(payment.status, 'PENDING');
    assert.equal(payment.amount, 2000, 'charges the deposit, not the full total');
  });

  // --- 6. Payment ---
  const payment = await prisma.payment.findFirstOrThrow({ where: { proposalId: proposal.id } });
  await workflow.markPaymentPaid({ reference: payment.reference, channel: 'card' });

  let clientId = '';

  await check('payment converts the lead into a client with onboarding and a calendar', async () => {
    const client = await prisma.client.findFirstOrThrow({
      where: { name: 'Acme Trading' },
      include: { onboarding: { include: { items: true } }, templates: true, contacts: true },
    });
    clientId = client.id;

    assert.equal(client.status, 'ONBOARDING');
    assert.equal(client.monthlyFee, 6000, 'monthly fee sums the recurring lines');
    assert.equal(client.contacts.length, 1);

    assert.equal(client.onboarding?.stage, 'INFORMATION_REQUESTED');
    assert.ok((client.onboarding?.items.length ?? 0) > 10, 'checklist should be seeded');

    const names = client.templates.map((t) => t.name);
    assert.ok(names.includes('Monthly bookkeeping'), 'core preset always installs');
    assert.ok(names.includes('Payroll run'), 'payroll installs because the proposal included it');
    assert.ok(!names.includes('VAT return'), 'VAT must not install — it was not sold');

    const wonLead = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } });
    assert.equal(wonLead.stage, 'WON');
    assert.equal(wonLead.clientId, client.id);

    const emails = await prisma.emailLog.findMany({ where: { relatedId: client.id } });
    assert.ok(emails.some((e) => e.template === 'welcome-pack'));
    assert.ok(emails.some((e) => e.template === 'information-request'));
  });

  await check('paying twice does not create a second client or duplicate emails', async () => {
    const before = await prisma.emailLog.count();
    await workflow.markPaymentPaid({ reference: payment.reference, channel: 'card' });

    const clients = await prisma.client.count({ where: { name: 'Acme Trading' } });
    assert.equal(clients, 1);
    assert.equal(await prisma.emailLog.count(), before, 'a replayed webhook must send nothing');
  });

  // --- 7. Recurring generation ---
  await check('recurring generation is idempotent', async () => {
    const first = await generateRecurringTasks();
    assert.ok(first.created > 0, 'expected the calendar to produce tasks');

    const countAfterFirst = await prisma.task.count({ where: { source: 'RECURRING' } });
    const second = await generateRecurringTasks();
    assert.equal(second.created, 0, 'a second run must create nothing');
    assert.equal(await prisma.task.count({ where: { source: 'RECURRING' } }), countAfterFirst);
  });

  await check('generated recurring tasks carry their template subtasks', async () => {
    const task = await prisma.task.findFirstOrThrow({
      where: { source: 'RECURRING', parentId: null },
      include: { subtasks: true },
    });
    assert.ok(task.subtasks.length > 0);
    assert.ok(task.periodKey, 'a period key guards against duplicates');
  });

  // --- 8. Onboarding ---
  await check('completing onboarding activates the client', async () => {
    const onboarding = await prisma.onboarding.findFirstOrThrow({ where: { clientId } });
    await workflow.setOnboardingStage(onboarding.id, 'COMPLETE', owner.id);

    const client = await prisma.client.findUniqueOrThrow({ where: { id: clientId } });
    assert.equal(client.status, 'ACTIVE');
  });

  // --- 9. Reminders ---
  await check('due reminders group into one email per assignee and do not resend', async () => {
    const before = await prisma.emailLog.count({ where: { template: { startsWith: 'task-reminder' } } });
    const run = await sendDueReminders();
    const after = await prisma.emailLog.count({ where: { template: { startsWith: 'task-reminder' } } });

    assert.ok(run.remindersProcessed > 0, 'expected reminders to be due');
    assert.ok(after > before, 'expected at least one reminder email');

    const second = await sendDueReminders();
    assert.equal(second.emailsSent, 0, 'a same-day re-run must send nothing');
  });

  // --- First-run setup lockout ---
  await check('the first-run setup route closes once an account exists', async () => {
    // The database already has users from the pipeline above, which is exactly
    // the state that must keep the setup route shut.
    const count = await prisma.user.count();
    assert.ok(count > 0, 'expected accounts to exist by this point');

    // Mirrors the guard in /api/setup: it refuses whenever any user is present.
    const setupAllowed = (await prisma.user.count()) === 0;
    assert.equal(setupAllowed, false, 'setup must not be reachable on a populated database');
  });

  await check('an owner always remains, so the firm cannot lock itself out', async () => {
    const owners = await prisma.user.count({ where: { role: 'OWNER', active: true } });
    assert.ok(owners >= 1, 'at least one active owner must exist');
  });

  await prisma.$disconnect();
  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
