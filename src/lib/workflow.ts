import 'server-only';
import { prisma, nextReference } from './db';
import { addDays, appUrl, formatDateTime, parseJson, randomToken } from './utils';
import { getSettings } from './settings';
import { sendEmail } from './email';
import {
  bookingConfirmationEmail,
  discoveryInviteEmail,
  informationRequestEmail,
  internalNotificationEmail,
  layout,
  paymentReceiptEmail,
  proposalEmail,
  render,
} from './email-templates';
import { renderEngagementLetter } from './documents';
import { createEnvelope } from './docusign';
import { buildReference, initializeTransaction } from './paystack';
import { createTask } from './tasks';
import { audit, notify, notifyManagers } from './notify';
import { ONBOARDING_CHECKLIST, RECURRING_TEMPLATE_PRESETS } from './onboarding-presets';

/**
 * The automation chain that carries a prospect from first contact to a live,
 * task-managed client:
 *
 *   createLead        -> CRM record + booking link + "call the lead" task
 *   confirmBooking    -> discovery call task on the calendar
 *   completeBooking   -> "build the proposal" task (when the outcome is PROCEED)
 *   sendProposal      -> emails the public proposal / sign / pay page
 *   acceptProposal    -> DocuSign envelope for the engagement letter
 *   markEnvelopeSigned-> Paystack payment link
 *   markPaymentPaid   -> client + onboarding + welcome pack + recurring calendar
 *
 * Each step is written to be safe to call twice; the webhooks that drive the
 * last two steps can and do deliver duplicates.
 */

// ---------------------------------------------------------------------------
// 1. Lead & qualification
// ---------------------------------------------------------------------------

export async function createLead(input: {
  companyName: string;
  contactName: string;
  email: string;
  phone?: string | null;
  source?: string;
  serviceInterest?: string | null;
  estimatedValue?: number;
  currency?: string;
  notes?: string | null;
  ownerId?: string | null;
  actorId?: string | null;
  sendBookingInvite?: boolean;
}) {
  const settings = await getSettings();
  const reference = await nextReference('lead', 'LD');

  const lead = await prisma.lead.create({
    data: {
      reference,
      companyName: input.companyName,
      contactName: input.contactName,
      email: input.email,
      phone: input.phone ?? null,
      source: input.source ?? 'WEBSITE',
      serviceInterest: input.serviceInterest ?? null,
      estimatedValue: input.estimatedValue ?? 0,
      currency: input.currency ?? settings.defaultCurrency,
      notes: input.notes ?? null,
      ownerId: input.ownerId ?? null,
      bookingToken: randomToken(16),
      stage: 'NEW',
    },
    include: { owner: true },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      userId: input.actorId ?? null,
      type: 'SYSTEM',
      body: `Lead created from ${lead.source.toLowerCase().replace(/_/g, ' ')}.`,
    },
  });

  // Every new lead gets an owned follow-up task so nothing sits untouched.
  await createTask({
    title: `Qualify lead: ${lead.companyName}`,
    description: `Contact ${lead.contactName} (${lead.email}) and book a discovery call.`,
    category: 'SALES',
    priority: 'HIGH',
    assigneeId: lead.ownerId,
    createdById: input.actorId ?? null,
    dueDate: addDays(new Date(), 2),
    source: 'PIPELINE',
    leadId: lead.id,
  });

  if (input.sendBookingInvite !== false) {
    await sendDiscoveryInvite(lead.id);
  }

  await notify({
    userId: lead.ownerId,
    title: `New lead assigned: ${lead.companyName}`,
    body: `${lead.contactName} — ${lead.email}`,
    link: `/leads/${lead.id}`,
    kind: 'ACTION',
  });

  await audit({
    userId: input.actorId,
    action: 'lead.created',
    entityType: 'Lead',
    entityId: lead.id,
    meta: { reference },
  });

  return lead;
}

export async function sendDiscoveryInvite(leadId: string): Promise<void> {
  const settings = await getSettings();
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { owner: true } });
  if (!lead) return;

  const bookingUrl = appUrl(`/book/${lead.bookingToken}`);
  const { subject, html } = discoveryInviteEmail({
    contactName: lead.contactName,
    companyName: lead.companyName,
    bookingUrl,
    ownerName: lead.owner?.name ?? settings.firmName,
  });

  await sendEmail({
    to: lead.email,
    subject,
    html: layout({
      firmName: settings.firmName,
      firmEmail: settings.firmEmail,
      firmPhone: settings.firmPhone,
      preheader: 'Book a 30 minute discovery call',
      body: html,
    }),
    template: 'discovery-invite',
    relatedType: 'Lead',
    relatedId: lead.id,
  });

  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: 'EMAIL', body: `Discovery call booking link sent to ${lead.email}.` },
  });
}

export async function setLeadStage(
  leadId: string,
  stage: string,
  opts: { actorId?: string | null; lostReason?: string | null } = {},
) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.stage === stage) return lead;

  const now = new Date();
  const lead2 = await prisma.lead.update({
    where: { id: leadId },
    data: {
      stage,
      lostReason: stage === 'LOST' ? (opts.lostReason ?? lead.lostReason) : null,
      qualifiedAt: stage === 'DISCOVERY' && !lead.qualifiedAt ? now : lead.qualifiedAt,
      wonAt: stage === 'WON' ? now : stage === 'LOST' ? null : lead.wonAt,
      lostAt: stage === 'LOST' ? now : null,
    },
  });

  await prisma.leadActivity.create({
    data: {
      leadId,
      userId: opts.actorId ?? null,
      type: 'STAGE_CHANGE',
      body: `Stage moved from ${lead.stage} to ${stage}${opts.lostReason ? ` — ${opts.lostReason}` : ''}.`,
    },
  });

  await audit({
    userId: opts.actorId,
    action: 'lead.stage_changed',
    entityType: 'Lead',
    entityId: leadId,
    meta: { from: lead.stage, to: stage },
  });

  return lead2;
}

/** A prospect picked a slot on the public booking page. */
export async function confirmBooking(input: {
  leadId: string;
  scheduledAt: Date;
  durationMins?: number;
  meetingLink?: string | null;
  agenda?: string | null;
  bookedByName?: string | null;
  bookedByEmail?: string | null;
}) {
  const settings = await getSettings();
  const lead = await prisma.lead.findUnique({ where: { id: input.leadId }, include: { owner: true } });
  if (!lead) throw new Error('Lead not found');

  const booking = await prisma.discoveryBooking.create({
    data: {
      leadId: lead.id,
      scheduledAt: input.scheduledAt,
      durationMins: input.durationMins ?? settings.discoveryDurationMins,
      meetingLink: input.meetingLink ?? null,
      agenda: input.agenda ?? null,
      bookedByName: input.bookedByName ?? lead.contactName,
      bookedByEmail: input.bookedByEmail ?? lead.email,
      status: 'CONFIRMED',
    },
  });

  if (lead.stage === 'NEW') await setLeadStage(lead.id, 'DISCOVERY');

  // Booking confirmed -> discovery call task, due at the call itself.
  await createTask({
    title: `Discovery call: ${lead.companyName}`,
    description: [
      `Call with ${lead.contactName} (${lead.email}${lead.phone ? `, ${lead.phone}` : ''}).`,
      input.agenda ? `\nWhat they want to discuss:\n${input.agenda}` : '',
    ]
      .join('')
      .trim(),
    category: 'SALES',
    priority: 'HIGH',
    assigneeId: lead.ownerId,
    startDate: input.scheduledAt,
    dueDate: input.scheduledAt,
    source: 'PIPELINE',
    leadId: lead.id,
    bookingId: booking.id,
    subtaskTitles: [
      'Review the prospect’s website and filings',
      'Run the discovery call',
      'Capture the call outcome in the CRM',
    ],
  });

  await prisma.leadActivity.create({
    data: {
      leadId: lead.id,
      type: 'MEETING',
      body: `Discovery call booked for ${input.scheduledAt.toISOString()}.`,
    },
  });

  const { subject, html } = bookingConfirmationEmail({
    contactName: lead.contactName,
    scheduledAt: input.scheduledAt,
    durationMins: booking.durationMins,
    meetingLink: booking.meetingLink,
    ownerName: lead.owner?.name ?? settings.firmName,
  });

  await sendEmail({
    to: lead.email,
    subject,
    html: layout({
      firmName: settings.firmName,
      firmEmail: settings.firmEmail,
      firmPhone: settings.firmPhone,
      body: html,
    }),
    template: 'booking-confirmation',
    relatedType: 'Lead',
    relatedId: lead.id,
  });

  if (lead.owner) {
    const internal = internalNotificationEmail({
      recipientName: lead.owner.name,
      title: `Discovery call booked — ${lead.companyName}`,
      lines: [
        `${lead.contactName} booked ${formatDateTime(input.scheduledAt)}`,
        `${lead.email}${lead.phone ? ` · ${lead.phone}` : ''}`,
        input.agenda ? `Agenda: ${input.agenda}` : 'No agenda supplied',
      ],
      actionUrl: appUrl(`/leads/${lead.id}`),
      actionLabel: 'Open the lead',
    });
    await sendEmail({
      to: lead.owner.email,
      subject: internal.subject,
      html: layout({
        firmName: settings.firmName,
        firmEmail: settings.firmEmail,
        body: internal.html,
      }),
      template: 'internal-booking',
      relatedType: 'Lead',
      relatedId: lead.id,
    });
  }

  await notify({
    userId: lead.ownerId,
    title: `Discovery call booked — ${lead.companyName}`,
    body: formatDateTime(input.scheduledAt),
    link: `/leads/${lead.id}`,
    kind: 'ACTION',
  });

  return booking;
}

/** The call happened. A PROCEED outcome raises the "write the proposal" task. */
export async function completeBooking(input: {
  bookingId: string;
  outcome: string;
  outcomeNotes?: string | null;
  actorId?: string | null;
}) {
  const booking = await prisma.discoveryBooking.findUnique({
    where: { id: input.bookingId },
    include: { lead: { include: { owner: true } } },
  });
  if (!booking) throw new Error('Booking not found');

  await prisma.discoveryBooking.update({
    where: { id: booking.id },
    data: {
      status: input.outcome === 'NOT_A_FIT' ? 'COMPLETED' : 'COMPLETED',
      outcome: input.outcome,
      outcomeNotes: input.outcomeNotes ?? null,
      completedAt: new Date(),
    },
  });

  // Close out the discovery call task.
  await prisma.task.updateMany({
    where: { bookingId: booking.id, status: { not: 'DONE' } },
    data: { status: 'DONE', completedAt: new Date() },
  });

  await prisma.leadActivity.create({
    data: {
      leadId: booking.leadId,
      userId: input.actorId ?? null,
      type: 'CALL',
      body: `Discovery call completed — outcome ${input.outcome}.${input.outcomeNotes ? ` ${input.outcomeNotes}` : ''}`,
    },
  });

  if (input.outcome === 'PROCEED') {
    await setLeadStage(booking.leadId, 'PROPOSAL', { actorId: input.actorId });
    await createTask({
      title: `Prepare proposal: ${booking.lead.companyName}`,
      description: `Discovery call complete. Build and send the proposal to ${booking.lead.contactName}.`,
      category: 'SALES',
      priority: 'HIGH',
      assigneeId: booking.lead.ownerId,
      createdById: input.actorId ?? null,
      dueDate: addDays(new Date(), 3),
      source: 'PIPELINE',
      leadId: booking.leadId,
      subtaskTitles: ['Draft the scope and pricing', 'Internal review', 'Send to the prospect'],
    });
    await notify({
      userId: booking.lead.ownerId,
      title: `Proposal needed — ${booking.lead.companyName}`,
      link: `/leads/${booking.leadId}`,
      kind: 'ACTION',
    });
  } else if (input.outcome === 'NOT_A_FIT') {
    await setLeadStage(booking.leadId, 'LOST', {
      actorId: input.actorId,
      lostReason: input.outcomeNotes || 'Not a fit after discovery call',
    });
  }

  return booking;
}

// ---------------------------------------------------------------------------
// 2. Proposal & engagement
// ---------------------------------------------------------------------------

export function computeProposalTotals(
  items: { quantity: number; unitPrice: number }[],
  discount: number,
  taxRate: number,
) {
  const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
  const afterDiscount = Math.max(0, subtotal - (discount || 0));
  const tax = Math.round(afterDiscount * ((taxRate || 0) / 100) * 100) / 100;
  const total = Math.round((afterDiscount + tax) * 100) / 100;
  return { subtotal: Math.round(subtotal * 100) / 100, tax, total };
}

export async function sendProposal(proposalId: string, actorId?: string | null) {
  const settings = await getSettings();
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: { include: { owner: true } }, client: true, items: true },
  });
  if (!proposal) throw new Error('Proposal not found');

  const recipientEmail = proposal.lead?.email ?? proposal.client?.email;
  const recipientName = proposal.lead?.contactName ?? proposal.client?.name;
  if (!recipientEmail || !recipientName) throw new Error('Proposal has no recipient');

  const validUntil = proposal.validUntil ?? addDays(new Date(), settings.proposalValidityDays);

  await prisma.proposal.update({
    where: { id: proposalId },
    data: { status: 'SENT', sentAt: new Date(), validUntil },
  });

  const { subject, html } = proposalEmail({
    contactName: recipientName,
    companyName: proposal.lead?.companyName ?? proposal.client?.name ?? '',
    proposalUrl: appUrl(`/p/${proposal.publicToken}`),
    total: proposal.total,
    currency: proposal.currency,
    validUntil,
    ownerName: proposal.lead?.owner?.name ?? settings.firmName,
  });

  await sendEmail({
    to: recipientEmail,
    subject,
    html: layout({
      firmName: settings.firmName,
      firmEmail: settings.firmEmail,
      firmPhone: settings.firmPhone,
      preheader: 'Review, sign and pay in one place',
      body: html,
    }),
    template: 'proposal-sent',
    relatedType: 'Proposal',
    relatedId: proposal.id,
  });

  if (proposal.leadId) {
    await setLeadStage(proposal.leadId, 'PROPOSAL', { actorId });
    await prisma.leadActivity.create({
      data: {
        leadId: proposal.leadId,
        userId: actorId ?? null,
        type: 'EMAIL',
        body: `Proposal ${proposal.number} sent to ${recipientEmail}.`,
      },
    });
  }

  await audit({
    userId: actorId,
    action: 'proposal.sent',
    entityType: 'Proposal',
    entityId: proposal.id,
  });

  return proposal;
}

/**
 * The client clicked "Accept" on the public proposal page. Builds the
 * engagement letter, opens a DocuSign envelope and returns the embedded
 * signing URL. Re-accepting reuses the open envelope rather than creating
 * a second one.
 */
export async function acceptProposal(proposalId: string) {
  const settings = await getSettings();
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: true, client: true, items: { orderBy: { sortOrder: 'asc' } }, envelopes: true },
  });
  if (!proposal) throw new Error('Proposal not found');

  const open = proposal.envelopes.find(
    (e) => e.kind === 'ENGAGEMENT_LETTER' && ['CREATED', 'SENT', 'DELIVERED'].includes(e.status),
  );
  if (open) return open;

  const recipientEmail = proposal.lead?.email ?? proposal.client?.email ?? '';
  const recipientName = proposal.lead?.contactName ?? proposal.client?.name ?? '';
  const clientName = proposal.lead?.companyName ?? proposal.client?.name ?? '';

  const documentHtml = renderEngagementLetter({
    firmName: settings.firmName,
    firmAddress: settings.firmAddress,
    firmEmail: settings.firmEmail,
    clientName,
    clientLegalName: proposal.client?.legalName,
    contactName: recipientName,
    contactEmail: recipientEmail,
    proposalNumber: proposal.number,
    currency: proposal.currency,
    items: proposal.items,
    subtotal: proposal.subtotal,
    discount: proposal.discount,
    tax: proposal.tax,
    taxRate: proposal.taxRate,
    total: proposal.total,
    depositAmount: proposal.depositAmount,
    termsHtml: render(proposal.termsHtml || settings.engagementTermsHtml, {
      firmName: settings.firmName,
      clientName,
    }),
    effectiveDate: new Date(),
  });

  const envelope = await prisma.envelope.create({
    data: {
      proposalId: proposal.id,
      kind: 'ENGAGEMENT_LETTER',
      recipientName,
      recipientEmail,
      subject: `Engagement letter — ${clientName}`,
      documentHtml,
      status: 'CREATED',
    },
  });

  const result = await createEnvelope({
    envelopeId: envelope.id,
    subject: `Engagement letter — ${clientName}`,
    documentHtml,
    documentName: `Engagement letter ${proposal.number}.html`,
    recipientName,
    recipientEmail,
    clientUserId: envelope.id,
  });

  const updated = await prisma.envelope.update({
    where: { id: envelope.id },
    data: { externalId: result.externalId, status: 'SENT', sentAt: new Date() },
  });

  await prisma.proposal.update({
    where: { id: proposal.id },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  });

  await audit({
    action: 'proposal.accepted',
    entityType: 'Proposal',
    entityId: proposal.id,
    meta: { envelopeId: updated.id, mode: result.mode },
  });

  return { ...updated, signingUrl: result.signingUrl };
}

/** Returns the URL the client should be sent to in order to sign. */
export async function signingUrlFor(envelopeId: string): Promise<string> {
  const envelope = await prisma.envelope.findUnique({ where: { id: envelopeId } });
  if (!envelope) throw new Error('Envelope not found');
  if (envelope.externalId?.startsWith('mock-')) return appUrl(`/sign/${envelope.id}`);
  // Live DocuSign recipient views are short lived, so mint a fresh one.
  const proposal = await prisma.proposal.findUnique({
    where: { id: envelope.proposalId },
    select: { number: true },
  });
  const result = await createEnvelope({
    envelopeId: envelope.id,
    subject: envelope.subject ?? `Engagement letter ${proposal?.number ?? ''}`,
    documentHtml: envelope.documentHtml ?? '',
    documentName: 'Engagement letter.html',
    recipientName: envelope.recipientName,
    recipientEmail: envelope.recipientEmail,
    clientUserId: envelope.id,
  });
  return result.signingUrl;
}

/**
 * The engagement letter is signed. Marks the proposal SIGNED and opens the
 * Paystack transaction so the client can pay immediately. Idempotent.
 */
export async function markEnvelopeSigned(input: {
  envelopeId: string;
  signerName?: string | null;
  signerIp?: string | null;
  raw?: unknown;
}) {
  const envelope = await prisma.envelope.findUnique({
    where: { id: input.envelopeId },
    include: { proposal: { include: { lead: { include: { owner: true } }, client: true } } },
  });
  if (!envelope) throw new Error('Envelope not found');

  if (envelope.status !== 'COMPLETED') {
    await prisma.envelope.update({
      where: { id: envelope.id },
      data: {
        status: 'COMPLETED',
        signedAt: new Date(),
        signerName: input.signerName ?? envelope.recipientName,
        signerIp: input.signerIp ?? null,
        lastEventRaw: input.raw ? JSON.stringify(input.raw) : envelope.lastEventRaw,
      },
    });
  }

  const proposal = envelope.proposal;
  if (proposal.status !== 'PAID') {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'SIGNED', signedAt: proposal.signedAt ?? new Date() },
    });
  }

  const payment = await ensurePayment(proposal.id);

  if (proposal.leadId) {
    await prisma.leadActivity.create({
      data: {
        leadId: proposal.leadId,
        type: 'SYSTEM',
        body: `Engagement letter signed by ${input.signerName ?? envelope.recipientName}.`,
      },
    });
  }

  await notifyManagers({
    title: `Engagement letter signed — ${proposal.lead?.companyName ?? proposal.client?.name ?? proposal.number}`,
    body: 'Awaiting payment to activate the client.',
    link: `/proposals/${proposal.id}`,
    kind: 'SUCCESS',
  });

  await audit({
    action: 'envelope.signed',
    entityType: 'Envelope',
    entityId: envelope.id,
    meta: { proposalId: proposal.id },
  });

  return { envelope, payment };
}

/** Creates (or returns) the pending Paystack transaction for a proposal. */
export async function ensurePayment(proposalId: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: true, client: true, payments: true },
  });
  if (!proposal) throw new Error('Proposal not found');

  const existing = proposal.payments.find((p) => ['PENDING', 'SUCCESS'].includes(p.status));
  if (existing) return existing;

  const amount = proposal.depositAmount > 0 ? proposal.depositAmount : proposal.total;
  const email = proposal.lead?.email ?? proposal.client?.email ?? '';
  const reference = buildReference(proposal.number);

  const init = await initializeTransaction({
    email,
    amount,
    currency: proposal.currency,
    reference,
    callbackUrl: appUrl(`/p/${proposal.publicToken}?paid=1`),
    metadata: { proposalId: proposal.id, proposalNumber: proposal.number },
  });

  return prisma.payment.create({
    data: {
      proposalId: proposal.id,
      clientId: proposal.clientId,
      provider: 'PAYSTACK',
      reference: init.reference,
      accessCode: init.accessCode,
      authorizationUrl: init.authorizationUrl,
      amount,
      currency: proposal.currency,
      customerEmail: email,
      status: 'PENDING',
    },
  });
}

// ---------------------------------------------------------------------------
// 3. Payment -> client -> onboarding
// ---------------------------------------------------------------------------

/**
 * Payment succeeded. This is the hinge of the whole system: it converts the
 * lead into a client, opens onboarding with its checklist, sends the welcome
 * pack, notifies the responsible team member and seeds the recurring
 * compliance calendar.
 *
 * Safe to call repeatedly — Paystack retries webhooks.
 */
export async function markPaymentPaid(input: {
  reference: string;
  channel?: string | null;
  paidAt?: Date;
  raw?: unknown;
}) {
  const payment = await prisma.payment.findUnique({
    where: { reference: input.reference },
    include: {
      proposal: {
        include: { lead: { include: { owner: true } }, client: true, items: true },
      },
    },
  });
  if (!payment) throw new Error(`Payment ${input.reference} not found`);

  const alreadyPaid = payment.status === 'SUCCESS';

  if (!alreadyPaid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'SUCCESS',
        channel: input.channel ?? payment.channel,
        paidAt: input.paidAt ?? new Date(),
        lastEventRaw: input.raw ? JSON.stringify(input.raw) : payment.lastEventRaw,
      },
    });
  }

  const proposal = payment.proposal;
  if (!proposal) return { payment, client: null };

  if (proposal.status !== 'PAID') {
    await prisma.proposal.update({
      where: { id: proposal.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
  }

  // If the client already exists this proposal is an upsell — no new record.
  if (proposal.clientId) {
    const client = await prisma.client.findUnique({ where: { id: proposal.clientId } });
    if (!alreadyPaid) await sendPaymentReceipt(payment.id);
    return { payment, client };
  }

  const client = await convertToClient(proposal.id);
  if (!alreadyPaid) await sendPaymentReceipt(payment.id);
  return { payment, client };
}

async function sendPaymentReceipt(paymentId: string) {
  const settings = await getSettings();
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { proposal: { include: { lead: true, client: true } } },
  });
  if (!payment?.customerEmail) return;

  const contactName =
    payment.proposal?.lead?.contactName ?? payment.proposal?.client?.name ?? 'there';

  const { subject, html } = paymentReceiptEmail({
    contactName,
    amount: payment.amount,
    currency: payment.currency,
    reference: payment.reference,
    paidAt: payment.paidAt ?? new Date(),
  });

  await sendEmail({
    to: payment.customerEmail,
    subject,
    html: layout({ firmName: settings.firmName, firmEmail: settings.firmEmail, body: html }),
    template: 'payment-receipt',
    relatedType: 'Payment',
    relatedId: payment.id,
  });
}

/**
 * Creates the client, its onboarding record and checklist, sends the welcome
 * pack, notifies the account manager and installs the recurring calendar.
 */
export async function convertToClient(proposalId: string) {
  const settings = await getSettings();
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: { include: { owner: true } }, items: true },
  });
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.clientId) return prisma.client.findUnique({ where: { id: proposal.clientId } });

  const lead = proposal.lead;
  const reference = await nextReference('client', 'CL');

  const monthly = proposal.items
    .filter((i) => i.billingCycle === 'MONTHLY')
    .reduce((sum, i) => sum + i.amount, 0);

  const client = await prisma.client.create({
    data: {
      reference,
      name: lead?.companyName ?? proposal.title,
      email: lead?.email ?? '',
      phone: lead?.phone ?? null,
      status: 'ONBOARDING',
      currency: proposal.currency,
      monthlyFee: monthly,
      ownerId: lead?.ownerId ?? null,
      startDate: new Date(),
      contacts: lead
        ? {
            create: [
              {
                name: lead.contactName,
                email: lead.email,
                phone: lead.phone,
                role: 'Primary contact',
                isPrimary: true,
              },
            ],
          }
        : undefined,
    },
  });

  await prisma.proposal.update({ where: { id: proposal.id }, data: { clientId: client.id } });
  await prisma.payment.updateMany({ where: { proposalId: proposal.id }, data: { clientId: client.id } });

  if (lead) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { clientId: client.id, stage: 'WON', wonAt: new Date() },
    });
    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: 'SYSTEM',
        body: `Won. Converted to client ${client.reference}.`,
      },
    });
  }

  const onboarding = await startOnboarding(client.id, lead?.ownerId ?? null);
  await sendWelcomePack(client.id);
  await seedRecurringCalendar(client.id, proposal.items.map((i) => i.name));

  // Notify the responsible team member.
  if (client.ownerId) {
    const owner = await prisma.user.findUnique({ where: { id: client.ownerId } });
    if (owner) {
      const internal = internalNotificationEmail({
        recipientName: owner.name,
        title: `New client signed & paid — ${client.name}`,
        lines: [
          `Reference ${client.reference}`,
          `Proposal ${proposal.number} · ${proposal.currency} ${proposal.total.toFixed(2)}`,
          'Onboarding has been opened with the standard checklist.',
          'Recurring compliance tasks have been scheduled.',
        ],
        actionUrl: appUrl(`/clients/${client.id}`),
        actionLabel: 'Open the client',
      });
      await sendEmail({
        to: owner.email,
        subject: internal.subject,
        html: layout({ firmName: settings.firmName, firmEmail: settings.firmEmail, body: internal.html }),
        template: 'internal-new-client',
        relatedType: 'Client',
        relatedId: client.id,
      });
    }
  }

  await notifyManagers({
    title: `New client: ${client.name}`,
    body: `Signed and paid. Onboarding ${onboarding.id} opened.`,
    link: `/clients/${client.id}`,
    kind: 'SUCCESS',
  });

  await audit({
    action: 'client.created',
    entityType: 'Client',
    entityId: client.id,
    meta: { proposalId: proposal.id, reference },
  });

  return client;
}

// ---------------------------------------------------------------------------
// 4. Onboarding
// ---------------------------------------------------------------------------

export async function startOnboarding(clientId: string, ownerId: string | null) {
  const existing = await prisma.onboarding.findUnique({ where: { clientId } });
  if (existing) return existing;

  const onboarding = await prisma.onboarding.create({
    data: {
      clientId,
      ownerId,
      stage: 'INFORMATION_REQUESTED',
      targetCompleteAt: addDays(new Date(), 21),
      items: {
        create: ONBOARDING_CHECKLIST.map((item, index) => ({
          stage: item.stage,
          title: item.title,
          description: item.description,
          type: item.type,
          required: item.required,
          sortOrder: index,
          dueDate: addDays(new Date(), item.dueInDays),
        })),
      },
    },
  });

  const client = await prisma.client.findUnique({ where: { id: clientId } });

  // One task per onboarding stage so the work shows up on the team's board.
  const stageTasks: { title: string; days: number; subtasks: string[] }[] = [
    {
      title: 'Collect onboarding information',
      days: 7,
      subtasks: ['Send the information request', 'Chase outstanding items', 'File received documents'],
    },
    {
      title: 'Set up ledger and reporting pack',
      days: 14,
      subtasks: ['Create the ledger', 'Load the chart of accounts', 'Configure the reporting pack'],
    },
    {
      title: 'Review setup with the client',
      days: 21,
      subtasks: ['Internal quality review', 'Walkthrough call with the client', 'Confirm the reporting calendar'],
    },
  ];

  for (const stage of stageTasks) {
    await createTask({
      title: `${stage.title} — ${client?.name ?? ''}`.trim(),
      clientId,
      category: 'ONBOARDING',
      priority: 'HIGH',
      assigneeId: ownerId,
      dueDate: addDays(new Date(), stage.days),
      source: 'ONBOARDING',
      onboardingId: onboarding.id,
      subtaskTitles: stage.subtasks,
    });
  }

  return onboarding;
}

export async function sendWelcomePack(clientId: string) {
  const settings = await getSettings();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { owner: true, contacts: true, onboarding: true },
  });
  if (!client) return;

  const contact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  const to = contact?.email ?? client.email;
  if (!to) return;

  const body = render(settings.welcomePackHtml, {
    firmName: settings.firmName,
    firmEmail: settings.firmEmail,
    clientName: client.name,
    contactName: contact?.name ?? client.name,
    ownerName: client.owner?.name ?? settings.firmName,
  });

  await sendEmail({
    to,
    subject: `Welcome to ${settings.firmName}`,
    html: layout({
      firmName: settings.firmName,
      firmEmail: settings.firmEmail,
      firmPhone: settings.firmPhone,
      preheader: 'Your welcome pack and what happens next',
      body,
    }),
    template: 'welcome-pack',
    relatedType: 'Client',
    relatedId: client.id,
  });

  if (client.onboarding) {
    await prisma.onboarding.update({
      where: { id: client.onboarding.id },
      data: { welcomePackSentAt: new Date() },
    });
  }

  // The information request is the first real onboarding action.
  await sendInformationRequest(clientId);
}

export async function sendInformationRequest(clientId: string) {
  const settings = await getSettings();
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: {
      owner: true,
      contacts: true,
      onboarding: { include: { items: { orderBy: { sortOrder: 'asc' } } } },
    },
  });
  if (!client?.onboarding) return;

  const outstanding = client.onboarding.items.filter(
    (i) => i.status === 'PENDING' && i.stage === 'INFORMATION_REQUESTED',
  );
  if (!outstanding.length) return;

  const contact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  const to = contact?.email ?? client.email;
  if (!to) return;

  const { subject, html } = informationRequestEmail({
    clientName: client.name,
    contactName: contact?.name ?? client.name,
    items: outstanding.map((i) => ({ title: i.title, description: i.description })),
    ownerName: client.owner?.name ?? settings.firmName,
    dueDate: outstanding[0]?.dueDate ?? null,
  });

  await sendEmail({
    to,
    subject,
    html: layout({
      firmName: settings.firmName,
      firmEmail: settings.firmEmail,
      firmPhone: settings.firmPhone,
      body: html,
    }),
    template: 'information-request',
    relatedType: 'Client',
    relatedId: client.id,
  });
}

export async function setOnboardingStage(
  onboardingId: string,
  stage: string,
  actorId?: string | null,
) {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: onboardingId },
    include: { client: true },
  });
  if (!onboarding) throw new Error('Onboarding not found');

  const complete = stage === 'COMPLETE';

  const updated = await prisma.onboarding.update({
    where: { id: onboardingId },
    data: { stage, completedAt: complete ? new Date() : null },
  });

  if (complete) {
    // Onboarding done -> the client goes live and its recurring calendar runs.
    await prisma.client.update({
      where: { id: onboarding.clientId },
      data: { status: 'ACTIVE' },
    });
    await notifyManagers({
      title: `${onboarding.client.name} is live`,
      body: 'Onboarding complete — the client has moved to Active.',
      link: `/clients/${onboarding.clientId}`,
      kind: 'SUCCESS',
    });
  }

  await audit({
    userId: actorId,
    action: 'onboarding.stage_changed',
    entityType: 'Onboarding',
    entityId: onboardingId,
    meta: { from: onboarding.stage, to: stage },
  });

  return updated;
}

/** Installs the firm's standard recurring compliance calendar for a client. */
export async function seedRecurringCalendar(clientId: string, serviceNames: string[] = []) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) return;

  const haystack = serviceNames.join(' ').toLowerCase();

  for (const preset of RECURRING_TEMPLATE_PRESETS) {
    // Always install the core presets; the conditional ones only when the
    // proposal actually included that service.
    if (preset.matchKeywords && !preset.matchKeywords.some((k) => haystack.includes(k))) continue;

    const exists = await prisma.recurringTaskTemplate.findFirst({
      where: { clientId, name: preset.name },
      select: { id: true },
    });
    if (exists) continue;

    await prisma.recurringTaskTemplate.create({
      data: {
        name: preset.name,
        description: preset.description,
        clientId,
        category: preset.category,
        priority: preset.priority,
        assigneeId: client.ownerId,
        frequency: preset.frequency,
        interval: 1,
        dayOfWeek: preset.dayOfWeek ?? null,
        dayOfMonth: preset.dayOfMonth ?? null,
        monthOfYear: preset.monthOfYear ?? null,
        leadTimeDays: preset.leadTimeDays,
        subtaskTitles: JSON.stringify(preset.subtasks),
        startDate: new Date(),
        active: true,
      },
    });
  }
}

export { parseJson };
