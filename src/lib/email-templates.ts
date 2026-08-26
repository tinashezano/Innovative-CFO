import { escapeHtml, formatDate, formatDateTime, formatMoney } from './utils';

/** Wraps body HTML in a plain, client-safe shell. Inline styles only. */
export function layout(opts: {
  firmName: string;
  firmEmail: string;
  firmPhone?: string;
  preheader?: string;
  body: string;
}): string {
  return `
<div style="background:#f5f6fa;padding:32px 12px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2430;">
  ${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>` : ''}
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e4e7ee;">
    <div style="background:#1f41f5;padding:20px 28px;">
      <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.01em;">${escapeHtml(opts.firmName)}</div>
    </div>
    <div style="padding:28px;font-size:15px;line-height:1.6;">
      ${opts.body}
    </div>
    <div style="padding:18px 28px;background:#fafbfd;border-top:1px solid #e4e7ee;font-size:12px;color:#6b7385;">
      ${escapeHtml(opts.firmName)} &middot; ${escapeHtml(opts.firmEmail)}${opts.firmPhone ? ` &middot; ${escapeHtml(opts.firmPhone)}` : ''}
    </div>
  </div>
</div>`.trim();
}

export function button(href: string, label: string): string {
  return `<p style="margin:24px 0;"><a href="${escapeHtml(href)}" style="background:#1f41f5;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block;">${escapeHtml(label)}</a></p>`;
}

/** Replaces {{token}} placeholders. Values are escaped unless the key ends in Html. */
export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    if (value === undefined) return '';
    return key.endsWith('Html') ? value : escapeHtml(value);
  });
}

// --- Pipeline emails ------------------------------------------------------

export function discoveryInviteEmail(v: {
  contactName: string;
  companyName: string;
  bookingUrl: string;
  ownerName: string;
}): { subject: string; html: string } {
  return {
    subject: `Let's book your discovery call`,
    html: `
<p>Hi ${escapeHtml(v.contactName)},</p>
<p>Thank you for your interest in working with us on ${escapeHtml(v.companyName)}. The next step is a short discovery call so we understand your numbers, your deadlines and where you want the business to go.</p>
<p>Pick a time that suits you:</p>
${button(v.bookingUrl, 'Book your discovery call')}
<p>The call takes about 30 minutes. If none of the times work, just reply to this email and we will find one that does.</p>
<p>Kind regards,<br/>${escapeHtml(v.ownerName)}</p>`.trim(),
  };
}

export function bookingConfirmationEmail(v: {
  contactName: string;
  scheduledAt: Date;
  durationMins: number;
  meetingLink?: string | null;
  ownerName: string;
}): { subject: string; html: string } {
  return {
    subject: `Your discovery call is confirmed — ${formatDateTime(v.scheduledAt)}`,
    html: `
<p>Hi ${escapeHtml(v.contactName)},</p>
<p>Your discovery call is confirmed.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 16px 4px 0;color:#6b7385;">When</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(formatDateTime(v.scheduledAt))}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7385;">Duration</td><td style="padding:4px 0;font-weight:600;">${v.durationMins} minutes</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7385;">With</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(v.ownerName)}</td></tr>
</table>
${v.meetingLink ? button(v.meetingLink, 'Join the call') : ''}
<p>To get the most out of the call, have your latest management accounts and a sense of your upcoming deadlines to hand.</p>
<p>Speak soon,<br/>${escapeHtml(v.ownerName)}</p>`.trim(),
  };
}

export function proposalEmail(v: {
  contactName: string;
  companyName: string;
  proposalUrl: string;
  total: number;
  currency: string;
  validUntil: Date | null;
  ownerName: string;
}): { subject: string; html: string } {
  return {
    subject: `Your proposal from us — ${escapeHtml(v.companyName)}`,
    html: `
<p>Hi ${escapeHtml(v.contactName)},</p>
<p>Thank you for your time on the discovery call. Your proposal is ready to review.</p>
<p>Everything happens on one page: read the scope, sign the engagement letter electronically and settle the first payment. It takes a few minutes.</p>
${button(v.proposalUrl, 'Review, sign and pay')}
<p style="color:#6b7385;font-size:14px;">Total: <strong style="color:#1f2430;">${escapeHtml(formatMoney(v.total, v.currency))}</strong>${v.validUntil ? ` &middot; valid until ${escapeHtml(formatDate(v.validUntil))}` : ''}</p>
<p>Any questions at all, just reply to this email.</p>
<p>Kind regards,<br/>${escapeHtml(v.ownerName)}</p>`.trim(),
  };
}

export function paymentReceiptEmail(v: {
  contactName: string;
  amount: number;
  currency: string;
  reference: string;
  paidAt: Date;
}): { subject: string; html: string } {
  return {
    subject: `Payment received — ${escapeHtml(v.reference)}`,
    html: `
<p>Hi ${escapeHtml(v.contactName)},</p>
<p>We have received your payment. Thank you.</p>
<table style="border-collapse:collapse;margin:16px 0;">
  <tr><td style="padding:4px 16px 4px 0;color:#6b7385;">Amount</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(formatMoney(v.amount, v.currency))}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7385;">Reference</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(v.reference)}</td></tr>
  <tr><td style="padding:4px 16px 4px 0;color:#6b7385;">Date</td><td style="padding:4px 0;font-weight:600;">${escapeHtml(formatDateTime(v.paidAt))}</td></tr>
</table>
<p>Your onboarding starts now — we will be in touch shortly with your welcome pack.</p>`.trim(),
  };
}

export function informationRequestEmail(v: {
  clientName: string;
  contactName: string;
  items: { title: string; description?: string | null }[];
  ownerName: string;
  dueDate?: Date | null;
}): { subject: string; html: string } {
  const list = v.items
    .map(
      (i) =>
        `<li style="margin-bottom:6px;"><strong>${escapeHtml(i.title)}</strong>${i.description ? `<br/><span style="color:#6b7385;">${escapeHtml(i.description)}</span>` : ''}</li>`,
    )
    .join('');
  return {
    subject: `Information we need to get ${escapeHtml(v.clientName)} started`,
    html: `
<p>Hi ${escapeHtml(v.contactName)},</p>
<p>To set up your file we need the following${v.dueDate ? ` by <strong>${escapeHtml(formatDate(v.dueDate))}</strong>` : ''}:</p>
<ul style="padding-left:18px;">${list}</ul>
<p>Reply to this email with the documents attached and we will confirm as each item lands.</p>
<p>Kind regards,<br/>${escapeHtml(v.ownerName)}</p>`.trim(),
  };
}

// --- Task reminders -------------------------------------------------------

export function taskReminderEmail(v: {
  assigneeName: string;
  tasks: {
    reference: string;
    title: string;
    clientName: string | null;
    dueDate: Date | null;
    priority: string;
    url: string;
    subtaskSummary?: string;
  }[];
  kind: 'BEFORE_DUE' | 'DUE_TODAY' | 'OVERDUE';
  boardUrl: string;
}): { subject: string; html: string } {
  const heading =
    v.kind === 'OVERDUE'
      ? 'Overdue tasks need your attention'
      : v.kind === 'DUE_TODAY'
        ? 'Tasks due today'
        : 'Tasks coming up';

  const rows = v.tasks
    .map(
      (t) => `
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #eef0f5;">
    <a href="${escapeHtml(t.url)}" style="color:#1f41f5;text-decoration:none;font-weight:600;">${escapeHtml(t.title)}</a>
    <div style="color:#6b7385;font-size:13px;margin-top:2px;">
      ${escapeHtml(t.reference)}${t.clientName ? ` &middot; ${escapeHtml(t.clientName)}` : ''} &middot; ${escapeHtml(t.priority)}
      ${t.subtaskSummary ? ` &middot; ${escapeHtml(t.subtaskSummary)}` : ''}
    </div>
  </td>
  <td style="padding:10px 0;border-bottom:1px solid #eef0f5;text-align:right;white-space:nowrap;color:${v.kind === 'OVERDUE' ? '#c1121f' : '#1f2430'};font-weight:600;font-size:14px;">
    ${escapeHtml(formatDate(t.dueDate))}
  </td>
</tr>`,
    )
    .join('');

  return {
    subject:
      v.kind === 'OVERDUE'
        ? `${v.tasks.length} overdue task${v.tasks.length === 1 ? '' : 's'}`
        : v.kind === 'DUE_TODAY'
          ? `${v.tasks.length} task${v.tasks.length === 1 ? '' : 's'} due today`
          : `${v.tasks.length} task${v.tasks.length === 1 ? '' : 's'} due soon`,
    html: `
<p>Hi ${escapeHtml(v.assigneeName)},</p>
<h3 style="margin:16px 0 8px;font-size:17px;">${escapeHtml(heading)}</h3>
<table style="width:100%;border-collapse:collapse;">${rows}</table>
${button(v.boardUrl, 'Open your board')}`.trim(),
  };
}

export function internalNotificationEmail(v: {
  recipientName: string;
  title: string;
  lines: string[];
  actionUrl?: string;
  actionLabel?: string;
}): { subject: string; html: string } {
  return {
    subject: v.title,
    html: `
<p>Hi ${escapeHtml(v.recipientName)},</p>
<h3 style="margin:14px 0 8px;font-size:17px;">${escapeHtml(v.title)}</h3>
<ul style="padding-left:18px;color:#3b4255;">${v.lines.map((l) => `<li style="margin-bottom:4px;">${escapeHtml(l)}</li>`).join('')}</ul>
${v.actionUrl ? button(v.actionUrl, v.actionLabel || 'Open in app') : ''}`.trim(),
  };
}
