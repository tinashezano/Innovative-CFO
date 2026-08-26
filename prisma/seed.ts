/**
 * Seeds a demo firm: users, a service catalogue, leads at every pipeline stage,
 * two live clients (one mid-onboarding, one active with a full recurring
 * calendar) and a spread of tasks so every view has something to show.
 *
 * Safe to re-run: it clears the demo data first.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const DEMO_PASSWORD = 'ChangeMe123!';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function at(date: Date, hour: number, minute = 0): Date {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function token(n = 16): string {
  let out = '';
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < n * 2; i += 1) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

let taskCounter = 0;
let leadCounter = 0;
let clientCounter = 0;
let proposalCounter = 0;

const ref = {
  task: () => `TK-${String((taskCounter += 1)).padStart(4, '0')}`,
  lead: () => `LD-${String((leadCounter += 1)).padStart(4, '0')}`,
  client: () => `CL-${String((clientCounter += 1)).padStart(4, '0')}`,
  proposal: () => `PR-${String((proposalCounter += 1)).padStart(4, '0')}`,
};

async function main() {
  console.log('Clearing existing data…');
  // Order matters: children before parents.
  await prisma.taskReminder.deleteMany();
  await prisma.taskComment.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.task.deleteMany();
  await prisma.recurringTaskTemplate.deleteMany();
  await prisma.onboardingItem.deleteMany();
  await prisma.onboarding.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.envelope.deleteMany();
  await prisma.proposalItem.deleteMany();
  await prisma.proposal.deleteMany();
  await prisma.discoveryBooking.deleteMany();
  await prisma.leadActivity.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.emailLog.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.webhookEvent.deleteMany();
  await prisma.counter.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const now = new Date();

  console.log('Creating users…');
  const owner = await prisma.user.create({
    data: {
      email: 'admin@innovativecfo.co.za',
      name: 'Tinashe Zano',
      passwordHash,
      role: 'OWNER',
      jobTitle: 'Managing Director',
      avatarColor: '#1f41f5',
    },
  });

  const manager = await prisma.user.create({
    data: {
      email: 'manager@innovativecfo.co.za',
      name: 'Naledi Mokoena',
      passwordHash,
      role: 'MANAGER',
      jobTitle: 'Client Services Manager',
      avatarColor: '#0f9d58',
    },
  });

  const staff = await prisma.user.create({
    data: {
      email: 'accountant@innovativecfo.co.za',
      name: 'Sipho Dlamini',
      passwordHash,
      role: 'STAFF',
      jobTitle: 'Senior Accountant',
      avatarColor: '#f4511e',
    },
  });

  console.log('Creating the service catalogue…');
  const services = await Promise.all(
    [
      { name: 'Monthly bookkeeping', description: 'Full transaction processing and reconciliations.', defaultPrice: 4500, billingCycle: 'MONTHLY', sortOrder: 1 },
      { name: 'Management accounts', description: 'Monthly reporting pack with commentary.', defaultPrice: 2500, billingCycle: 'MONTHLY', sortOrder: 2 },
      { name: 'Payroll (up to 10 staff)', description: 'Payslips, EMP201 filing and payment file.', defaultPrice: 1800, billingCycle: 'MONTHLY', sortOrder: 3 },
      { name: 'VAT returns', description: 'VAT201 preparation, review and submission.', defaultPrice: 1500, billingCycle: 'MONTHLY', sortOrder: 4 },
      { name: 'Annual financial statements', description: 'Compilation of AFS and the ITR14 return.', defaultPrice: 18000, billingCycle: 'ANNUAL', sortOrder: 5 },
      { name: 'Tax compliance', description: 'Provisional tax, income tax and SARS correspondence.', defaultPrice: 2200, billingCycle: 'MONTHLY', sortOrder: 6 },
      { name: 'Virtual CFO advisory', description: 'Board pack, forecasting and quarterly strategy sessions.', defaultPrice: 12000, billingCycle: 'MONTHLY', sortOrder: 7 },
      { name: 'Company setup & registration', description: 'CIPC registration, tax and bank account setup.', defaultPrice: 6500, billingCycle: 'ONE_OFF', sortOrder: 8 },
    ].map((s) => prisma.service.create({ data: s })),
  );

  const byName = (name: string) => services.find((s) => s.name === name)!;

  console.log('Creating leads…');

  // --- NEW lead ---
  const leadNew = await prisma.lead.create({
    data: {
      reference: ref.lead(),
      companyName: 'Umoya Logistics',
      contactName: 'Thandeka Nkosi',
      email: 'thandeka@umoyalogistics.co.za',
      phone: '+27 82 555 0142',
      source: 'WEBSITE',
      serviceInterest: 'Monthly bookkeeping, VAT',
      estimatedValue: 7500,
      stage: 'NEW',
      ownerId: manager.id,
      bookingToken: token(),
      notes: 'Filled in the website enquiry form. 14 vehicles, VAT registered, currently on spreadsheets.',
      createdAt: addDays(now, -2),
    },
  });

  // --- DISCOVERY lead, with an upcoming call ---
  const leadDiscovery = await prisma.lead.create({
    data: {
      reference: ref.lead(),
      companyName: 'Kalahari Coffee Roasters',
      contactName: 'Pieter van Wyk',
      email: 'pieter@kalaharicoffee.co.za',
      phone: '+27 83 555 0198',
      source: 'REFERRAL',
      serviceInterest: 'Bookkeeping, payroll, management accounts',
      estimatedValue: 11500,
      stage: 'DISCOVERY',
      ownerId: owner.id,
      bookingToken: token(),
      qualifiedAt: addDays(now, -4),
      notes: 'Referred by an existing client. Two retail sites, 18 staff, outgrowing their current bookkeeper.',
      createdAt: addDays(now, -6),
    },
  });

  await prisma.discoveryBooking.create({
    data: {
      leadId: leadDiscovery.id,
      scheduledAt: at(addDays(now, 2), 10),
      durationMins: 30,
      meetingLink: 'https://meet.google.com/demo-discovery',
      status: 'CONFIRMED',
      bookedByName: 'Pieter van Wyk',
      bookedByEmail: 'pieter@kalaharicoffee.co.za',
      agenda: 'Wants monthly management accounts and payroll taken off his plate before the new site opens.',
    },
  });

  // --- PROPOSAL lead, proposal sent and waiting ---
  const leadProposal = await prisma.lead.create({
    data: {
      reference: ref.lead(),
      companyName: 'Sandton Dental Group',
      contactName: 'Dr Aisha Patel',
      email: 'aisha@sandtondental.co.za',
      phone: '+27 84 555 0177',
      source: 'LINKEDIN',
      serviceInterest: 'Full outsourced finance function',
      estimatedValue: 21000,
      stage: 'PROPOSAL',
      ownerId: owner.id,
      bookingToken: token(),
      qualifiedAt: addDays(now, -12),
      notes: 'Three practices. Wants one consolidated view and a proper board pack.',
      createdAt: addDays(now, -15),
    },
  });

  await prisma.discoveryBooking.create({
    data: {
      leadId: leadProposal.id,
      scheduledAt: at(addDays(now, -8), 14),
      durationMins: 45,
      status: 'COMPLETED',
      outcome: 'PROCEED',
      outcomeNotes: 'Strong fit. Wants a consolidated group view across three practices plus quarterly board packs.',
      completedAt: addDays(now, -8),
    },
  });

  const proposalItems = [
    { service: 'Monthly bookkeeping', quantity: 3, unitPrice: 4500 },
    { service: 'Management accounts', quantity: 1, unitPrice: 2500 },
    { service: 'Payroll (up to 10 staff)', quantity: 3, unitPrice: 1800 },
    { service: 'Virtual CFO advisory', quantity: 1, unitPrice: 12000 },
  ];
  const subtotal = proposalItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discount = 3000;
  const taxRate = 15;
  const tax = Math.round((subtotal - discount) * (taxRate / 100) * 100) / 100;
  const total = subtotal - discount + tax;

  const proposalSent = await prisma.proposal.create({
    data: {
      number: ref.proposal(),
      leadId: leadProposal.id,
      title: 'Outsourced finance function — Sandton Dental Group',
      summary: 'A single finance function across all three practices, with a consolidated monthly pack and quarterly board reporting.',
      currency: 'ZAR',
      subtotal,
      discount,
      taxRate,
      tax,
      total,
      depositAmount: Math.round(total / 3),
      status: 'SENT',
      publicToken: token(),
      sentAt: addDays(now, -5),
      viewedAt: addDays(now, -4),
      validUntil: addDays(now, 25),
      createdById: owner.id,
      items: {
        create: proposalItems.map((i, index) => ({
          serviceId: byName(i.service).id,
          name: i.service,
          description: byName(i.service).description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          amount: i.quantity * i.unitPrice,
          billingCycle: byName(i.service).billingCycle,
          sortOrder: index,
        })),
      },
    },
  });

  await prisma.leadActivity.createMany({
    data: [
      { leadId: leadProposal.id, userId: owner.id, type: 'SYSTEM', body: 'Lead created from LinkedIn outreach.', createdAt: addDays(now, -15) },
      { leadId: leadProposal.id, userId: owner.id, type: 'CALL', body: 'Discovery call completed — outcome PROCEED.', createdAt: addDays(now, -8) },
      { leadId: leadProposal.id, userId: owner.id, type: 'EMAIL', body: `Proposal ${proposalSent.number} sent to aisha@sandtondental.co.za.`, createdAt: addDays(now, -5) },
      { leadId: leadProposal.id, type: 'SYSTEM', body: 'Proposal opened by the client.', createdAt: addDays(now, -4) },
    ],
  });

  // --- LOST lead ---
  await prisma.lead.create({
    data: {
      reference: ref.lead(),
      companyName: 'Bright Spark Electrical',
      contactName: 'Johan Botha',
      email: 'johan@brightspark.co.za',
      source: 'COLD_OUTREACH',
      estimatedValue: 4500,
      stage: 'LOST',
      lostReason: 'Went with a cheaper freelance bookkeeper.',
      lostAt: addDays(now, -20),
      ownerId: manager.id,
      bookingToken: token(),
      createdAt: addDays(now, -35),
    },
  });

  console.log('Creating clients…');

  // --- Client 1: mid-onboarding ---
  const clientOnboarding = await prisma.client.create({
    data: {
      reference: ref.client(),
      name: 'Zwelakhe Construction',
      legalName: 'Zwelakhe Construction (Pty) Ltd',
      email: 'finance@zwelakhe.co.za',
      phone: '+27 11 555 0110',
      address: '18 Rivonia Road, Sandton, 2196',
      industry: 'Construction',
      taxNumber: '9012345678',
      registrationNumber: '2019/123456/07',
      status: 'ONBOARDING',
      monthlyFee: 9800,
      ownerId: manager.id,
      colorTag: '#f4511e',
      financialYearEnd: 'February',
      startDate: addDays(now, -10),
      contacts: {
        create: [
          { name: 'Lerato Mahlangu', email: 'lerato@zwelakhe.co.za', phone: '+27 82 555 0120', role: 'Financial Manager', isPrimary: true },
          { name: 'Sizwe Zwelakhe', email: 'sizwe@zwelakhe.co.za', role: 'Managing Director' },
        ],
      },
    },
  });

  const onboarding1 = await prisma.onboarding.create({
    data: {
      clientId: clientOnboarding.id,
      ownerId: manager.id,
      stage: 'INFORMATION_RECEIVED',
      startedAt: addDays(now, -10),
      targetCompleteAt: addDays(now, 11),
      welcomePackSentAt: addDays(now, -10),
      notes: 'Bank statements still outstanding for the second account.',
    },
  });

  const checklist: [string, string, string, string, boolean, number][] = [
    ['INFORMATION_REQUESTED', 'Certificate of incorporation', 'CIPC registration certificate.', 'DOCUMENT', true, -3],
    ['INFORMATION_REQUESTED', 'Director / member IDs', 'Certified ID copies for every director.', 'DOCUMENT', true, -3],
    ['INFORMATION_REQUESTED', 'SARS registration details', 'Income tax, VAT and PAYE references.', 'INFO', true, -3],
    ['INFORMATION_REQUESTED', 'Bank statements — last 12 months', 'Every business account.', 'DOCUMENT', true, 4],
    ['INFORMATION_REQUESTED', 'Prior year financial statements', 'Signed AFS for the last completed year.', 'DOCUMENT', false, 4],
    ['INFORMATION_REQUESTED', 'Accounting system access', 'Adviser invite to the Xero file.', 'ACTION', true, -3],
    ['INFORMATION_REQUESTED', 'FICA / KYC pack', 'Proof of address and beneficial ownership.', 'DOCUMENT', true, 4],
    ['INFORMATION_RECEIVED', 'Verify documents received', 'Check every item is present and current.', 'ACTION', true, 2],
    ['INFORMATION_RECEIVED', 'Complete client acceptance checks', 'Independence and risk sign-off.', 'ACTION', true, 2],
    ['SETUP', 'Create the ledger file', 'Chart of accounts and tax rates.', 'ACTION', true, 6],
    ['SETUP', 'Load opening balances', 'Opening trial balance from prior AFS.', 'ACTION', true, 6],
    ['SETUP', 'Connect bank feeds', 'Live feeds on every account.', 'ACTION', true, 6],
    ['SETUP', 'Configure the reporting pack', 'Management accounts template.', 'ACTION', true, 8],
    ['REVIEW', 'Internal quality review', 'Manager review of the setup.', 'ACTION', true, 10],
    ['REVIEW', 'Client walkthrough call', 'Walk through the pack and deadlines.', 'ACTION', true, 11],
    ['COMPLETE', 'Confirm go-live', 'Client moves to Active.', 'ACTION', true, 11],
  ];

  for (const [index, [stage, title, description, type, required, dueOffset]] of checklist.entries()) {
    // Everything requested more than three days ago has landed, bar the bank statements.
    const received = dueOffset < 0;
    await prisma.onboardingItem.create({
      data: {
        onboardingId: onboarding1.id,
        stage,
        title,
        description,
        type,
        required,
        sortOrder: index,
        dueDate: addDays(now, dueOffset),
        status: received ? 'APPROVED' : 'PENDING',
        receivedAt: received ? addDays(now, dueOffset - 1) : null,
        approvedAt: received ? addDays(now, dueOffset) : null,
      },
    });
  }

  // --- Client 2: active, running on the recurring calendar ---
  const clientActive = await prisma.client.create({
    data: {
      reference: ref.client(),
      name: 'Ubuntu Health Clinics',
      legalName: 'Ubuntu Health Clinics (Pty) Ltd',
      email: 'accounts@ubuntuhealth.co.za',
      phone: '+27 21 555 0130',
      address: '5 Long Street, Cape Town, 8001',
      industry: 'Healthcare',
      taxNumber: '9087654321',
      registrationNumber: '2016/654321/07',
      status: 'ACTIVE',
      monthlyFee: 14300,
      ownerId: owner.id,
      colorTag: '#0f9d58',
      financialYearEnd: 'February',
      startDate: addDays(now, -400),
      contacts: {
        create: [
          { name: 'Dr Nomsa Khumalo', email: 'nomsa@ubuntuhealth.co.za', phone: '+27 82 555 0131', role: 'Managing Director', isPrimary: true },
        ],
      },
    },
  });

  await prisma.onboarding.create({
    data: {
      clientId: clientActive.id,
      ownerId: owner.id,
      stage: 'COMPLETE',
      startedAt: addDays(now, -400),
      completedAt: addDays(now, -380),
      welcomePackSentAt: addDays(now, -400),
    },
  });

  // --- Client 3: active, smaller ---
  const clientSmall = await prisma.client.create({
    data: {
      reference: ref.client(),
      name: 'Thabo Digital',
      legalName: 'Thabo Digital CC',
      email: 'thabo@thabodigital.co.za',
      industry: 'Marketing',
      status: 'ACTIVE',
      monthlyFee: 4500,
      ownerId: staff.id,
      colorTag: '#7c4dff',
      financialYearEnd: 'February',
      startDate: addDays(now, -200),
      contacts: { create: [{ name: 'Thabo Mahlangu', email: 'thabo@thabodigital.co.za', role: 'Owner', isPrimary: true }] },
    },
  });

  console.log('Creating recurring templates…');
  const templates: {
    name: string;
    clientId: string;
    category: string;
    priority: string;
    frequency: string;
    dayOfMonth?: number;
    monthOfYear?: number;
    leadTimeDays: number;
    assigneeId: string;
    subtasks: string[];
  }[] = [
    {
      name: 'Monthly bookkeeping',
      clientId: clientActive.id,
      category: 'BOOKKEEPING',
      priority: 'HIGH',
      frequency: 'MONTHLY',
      dayOfMonth: 7,
      leadTimeDays: 7,
      assigneeId: staff.id,
      subtasks: ['Import and categorise bank transactions', 'Reconcile bank and credit cards', 'Reconcile debtors and creditors', 'Post accruals', 'Lock the period'],
    },
    {
      name: 'Management accounts',
      clientId: clientActive.id,
      category: 'ADVISORY',
      priority: 'MEDIUM',
      frequency: 'MONTHLY',
      dayOfMonth: 12,
      leadTimeDays: 5,
      assigneeId: manager.id,
      subtasks: ['Prepare the pack', 'Write commentary', 'Manager review', 'Issue to the client'],
    },
    {
      name: 'VAT return',
      clientId: clientActive.id,
      category: 'VAT',
      priority: 'URGENT',
      frequency: 'QUARTERLY',
      dayOfMonth: 25,
      monthOfYear: 2,
      leadTimeDays: 10,
      assigneeId: staff.id,
      subtasks: ['Reconcile the VAT control account', 'Review input and output VAT', 'Prepare the VAT201', 'Client approval', 'Submit to SARS'],
    },
    {
      name: 'Payroll run',
      clientId: clientActive.id,
      category: 'PAYROLL',
      priority: 'URGENT',
      frequency: 'MONTHLY',
      dayOfMonth: 20,
      leadTimeDays: 5,
      assigneeId: staff.id,
      subtasks: ['Collect payroll changes', 'Process the run', 'Issue payslips', 'Submit the EMP201', 'Load the payment file'],
    },
    {
      name: 'Annual financial statements',
      clientId: clientActive.id,
      category: 'ANNUAL_ACCOUNTS',
      priority: 'HIGH',
      frequency: 'ANNUAL',
      dayOfMonth: 30,
      monthOfYear: 9,
      leadTimeDays: 45,
      assigneeId: manager.id,
      subtasks: ['Prepare the year-end file', 'Post year-end journals', 'Draft the statements', 'Partner review', 'Client sign-off', 'Submit the ITR14'],
    },
    {
      name: 'Monthly bookkeeping',
      clientId: clientSmall.id,
      category: 'BOOKKEEPING',
      priority: 'MEDIUM',
      frequency: 'MONTHLY',
      dayOfMonth: 10,
      leadTimeDays: 7,
      assigneeId: staff.id,
      subtasks: ['Import transactions', 'Reconcile the bank', 'Lock the period'],
    },
  ];

  for (const t of templates) {
    await prisma.recurringTaskTemplate.create({
      data: {
        name: t.name,
        description: `${t.name} for the client's compliance calendar.`,
        clientId: t.clientId,
        category: t.category,
        priority: t.priority,
        assigneeId: t.assigneeId,
        frequency: t.frequency,
        interval: 1,
        dayOfMonth: t.dayOfMonth ?? null,
        monthOfYear: t.monthOfYear ?? null,
        leadTimeDays: t.leadTimeDays,
        subtaskTitles: JSON.stringify(t.subtasks),
        // Start from today so generation runs forward rather than
        // backfilling periods that have already been dealt with.
        startDate: now,
        active: true,
      },
    });
  }

  console.log('Creating tasks…');

  async function makeTask(data: {
    title: string;
    description?: string;
    clientId?: string;
    status?: string;
    priority?: string;
    category?: string;
    assigneeId?: string;
    dueDate?: Date;
    startDate?: Date;
    completedAt?: Date;
    source?: string;
    leadId?: string;
    onboardingId?: string;
    estimateHours?: number;
    position: number;
    subtasks?: string[];
    subtasksDone?: number;
  }) {
    const task = await prisma.task.create({
      data: {
        reference: ref.task(),
        title: data.title,
        description: data.description,
        clientId: data.clientId,
        status: data.status ?? 'TODO',
        priority: data.priority ?? 'MEDIUM',
        category: data.category ?? 'OTHER',
        assigneeId: data.assigneeId,
        createdById: owner.id,
        startDate: data.startDate,
        dueDate: data.dueDate,
        completedAt: data.completedAt,
        estimateHours: data.estimateHours,
        source: data.source ?? 'MANUAL',
        leadId: data.leadId,
        onboardingId: data.onboardingId,
        position: data.position,
      },
    });

    for (const [i, title] of (data.subtasks ?? []).entries()) {
      const done = i < (data.subtasksDone ?? 0);
      await prisma.task.create({
        data: {
          reference: ref.task(),
          title,
          clientId: data.clientId,
          parentId: task.id,
          status: done ? 'DONE' : 'TODO',
          completedAt: done ? addDays(now, -1) : null,
          priority: task.priority,
          category: task.category,
          assigneeId: task.assigneeId,
          createdById: owner.id,
          dueDate: data.dueDate,
          position: (i + 1) * 1000,
          source: task.source,
        },
      });
    }
    return task;
  }

  let pos = 1000;
  const next = () => (pos += 1000);

  // Sales pipeline tasks
  await makeTask({
    title: 'Qualify lead: Umoya Logistics',
    description: 'Contact Thandeka Nkosi and book a discovery call.',
    category: 'SALES',
    priority: 'HIGH',
    assigneeId: manager.id,
    dueDate: addDays(now, 1),
    source: 'PIPELINE',
    leadId: leadNew.id,
    position: next(),
  });

  await makeTask({
    title: 'Discovery call: Kalahari Coffee Roasters',
    description: 'Call with Pieter van Wyk. Two retail sites, 18 staff.',
    category: 'SALES',
    priority: 'HIGH',
    assigneeId: owner.id,
    startDate: at(addDays(now, 2), 10),
    dueDate: at(addDays(now, 2), 10),
    source: 'PIPELINE',
    leadId: leadDiscovery.id,
    position: next(),
    subtasks: ['Review the prospect’s website and filings', 'Run the discovery call', 'Capture the outcome in the CRM'],
    subtasksDone: 1,
  });

  await makeTask({
    title: 'Follow up on proposal: Sandton Dental Group',
    description: 'Proposal opened four days ago with no response. Call Dr Patel.',
    category: 'SALES',
    priority: 'URGENT',
    status: 'IN_PROGRESS',
    assigneeId: owner.id,
    dueDate: addDays(now, -1),
    source: 'PIPELINE',
    leadId: leadProposal.id,
    position: next(),
  });

  // Onboarding tasks
  await makeTask({
    title: 'Collect onboarding information — Zwelakhe Construction',
    clientId: clientOnboarding.id,
    category: 'ONBOARDING',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assigneeId: manager.id,
    dueDate: addDays(now, 4),
    source: 'ONBOARDING',
    onboardingId: onboarding1.id,
    estimateHours: 3,
    position: next(),
    subtasks: ['Send the information request', 'Chase outstanding items', 'File received documents'],
    subtasksDone: 1,
  });

  await makeTask({
    title: 'Set up ledger and reporting pack — Zwelakhe Construction',
    clientId: clientOnboarding.id,
    category: 'ONBOARDING',
    priority: 'HIGH',
    assigneeId: staff.id,
    dueDate: addDays(now, 8),
    source: 'ONBOARDING',
    onboardingId: onboarding1.id,
    estimateHours: 6,
    position: next(),
    subtasks: ['Create the ledger', 'Load the chart of accounts', 'Configure the reporting pack'],
  });

  await makeTask({
    title: 'Review setup with the client — Zwelakhe Construction',
    clientId: clientOnboarding.id,
    category: 'ONBOARDING',
    priority: 'MEDIUM',
    assigneeId: manager.id,
    dueDate: addDays(now, 11),
    source: 'ONBOARDING',
    onboardingId: onboarding1.id,
    position: next(),
  });

  // Recurring-style client work
  await makeTask({
    title: 'Monthly bookkeeping — August',
    clientId: clientActive.id,
    category: 'BOOKKEEPING',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    assigneeId: staff.id,
    startDate: addDays(now, -3),
    dueDate: addDays(now, 4),
    source: 'RECURRING',
    estimateHours: 8,
    position: next(),
    subtasks: ['Import and categorise bank transactions', 'Reconcile bank and credit cards', 'Reconcile debtors and creditors', 'Post accruals', 'Lock the period'],
    subtasksDone: 2,
  });

  await makeTask({
    title: 'VAT return — Q2',
    clientId: clientActive.id,
    category: 'VAT',
    priority: 'URGENT',
    status: 'REVIEW',
    assigneeId: staff.id,
    dueDate: addDays(now, 2),
    source: 'RECURRING',
    estimateHours: 4,
    position: next(),
    subtasks: ['Reconcile the VAT control account', 'Review input and output VAT', 'Prepare the VAT201', 'Client approval', 'Submit to SARS'],
    subtasksDone: 3,
  });

  await makeTask({
    title: 'Payroll run — August',
    clientId: clientActive.id,
    category: 'PAYROLL',
    priority: 'URGENT',
    assigneeId: staff.id,
    dueDate: addDays(now, -2),
    source: 'RECURRING',
    estimateHours: 3,
    position: next(),
    subtasks: ['Collect payroll changes', 'Process the run', 'Issue payslips', 'Submit the EMP201'],
    subtasksDone: 1,
  });

  await makeTask({
    title: 'Management accounts — July',
    clientId: clientActive.id,
    category: 'ADVISORY',
    priority: 'MEDIUM',
    status: 'DONE',
    assigneeId: manager.id,
    dueDate: addDays(now, -14),
    completedAt: addDays(now, -13),
    source: 'RECURRING',
    position: next(),
  });

  await makeTask({
    title: 'Monthly bookkeeping — August',
    clientId: clientSmall.id,
    category: 'BOOKKEEPING',
    priority: 'MEDIUM',
    assigneeId: staff.id,
    dueDate: addDays(now, 7),
    source: 'RECURRING',
    estimateHours: 3,
    position: next(),
    subtasks: ['Import transactions', 'Reconcile the bank', 'Lock the period'],
  });

  await makeTask({
    title: 'SARS query — additional assessment',
    description: 'SARS raised an additional assessment for the 2024 year. Draft the objection.',
    clientId: clientActive.id,
    category: 'TAX',
    priority: 'URGENT',
    status: 'BLOCKED',
    assigneeId: manager.id,
    dueDate: addDays(now, 5),
    estimateHours: 6,
    position: next(),
  });

  await makeTask({
    title: 'CIPC annual return',
    clientId: clientSmall.id,
    category: 'COMPLIANCE',
    priority: 'HIGH',
    assigneeId: staff.id,
    dueDate: addDays(now, 18),
    source: 'RECURRING',
    position: next(),
  });

  await makeTask({
    title: 'Annual financial statements — FY2026',
    clientId: clientActive.id,
    category: 'ANNUAL_ACCOUNTS',
    priority: 'HIGH',
    assigneeId: manager.id,
    startDate: addDays(now, 10),
    dueDate: addDays(now, 35),
    source: 'RECURRING',
    estimateHours: 24,
    position: next(),
    subtasks: ['Prepare the year-end file', 'Post year-end journals', 'Draft the statements', 'Partner review', 'Client sign-off', 'Submit the ITR14'],
  });

  console.log('Creating notifications…');
  await prisma.notification.createMany({
    data: [
      { userId: owner.id, title: 'Proposal opened', body: 'Sandton Dental Group opened proposal PR-0001.', link: `/proposals/${proposalSent.id}`, kind: 'INFO' },
      { userId: manager.id, title: 'Onboarding item overdue', body: 'Bank statements still outstanding for Zwelakhe Construction.', link: `/clients/${clientOnboarding.id}`, kind: 'WARNING' },
      { userId: staff.id, title: 'Payroll run overdue', body: 'Ubuntu Health Clinics payroll was due two days ago.', link: '/tasks?view=list', kind: 'WARNING' },
    ],
  });

  // Counters must continue from the seeded references.
  await prisma.counter.createMany({
    data: [
      { name: 'lead', value: leadCounter },
      { name: 'client', value: clientCounter },
      { name: 'proposal', value: proposalCounter },
      { name: 'task', value: taskCounter },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    leads: await prisma.lead.count(),
    clients: await prisma.client.count(),
    proposals: await prisma.proposal.count(),
    tasks: await prisma.task.count(),
    templates: await prisma.recurringTaskTemplate.count(),
  };

  console.log('\nSeed complete:', counts);
  console.log('\nSign in with:');
  console.log(`  Owner    admin@innovativecfo.co.za      / ${DEMO_PASSWORD}`);
  console.log(`  Manager  manager@innovativecfo.co.za    / ${DEMO_PASSWORD}`);
  console.log(`  Staff    accountant@innovativecfo.co.za / ${DEMO_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
