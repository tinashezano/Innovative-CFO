import { escapeHtml, formatDate, formatMoney } from './utils';
import { BILLING_CYCLE_LABELS, type BillingCycle } from './constants';

export type EngagementLetterInput = {
  firmName: string;
  firmAddress: string;
  firmEmail: string;
  clientName: string;
  clientLegalName?: string | null;
  contactName: string;
  contactEmail: string;
  proposalNumber: string;
  currency: string;
  items: {
    name: string;
    description?: string | null;
    quantity: number;
    unitPrice: number;
    amount: number;
    billingCycle: string;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  taxRate: number;
  total: number;
  depositAmount: number;
  termsHtml: string;
  effectiveDate: Date;
};

/**
 * Renders the engagement letter. The same HTML is used for the in-app mock
 * signing experience and as the document uploaded to DocuSign, so what the
 * client signs is byte-identical in both modes.
 *
 * The /sig1/, /name1/ and /date1/ anchor strings are what DocuSign anchors its
 * signature, name and date tabs to — leave them in place.
 */
export function renderEngagementLetter(v: EngagementLetterInput): string {
  const rows = v.items
    .map(
      (item) => `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e6e9f0;vertical-align:top;">
          <div style="font-weight:600;">${escapeHtml(item.name)}</div>
          ${item.description ? `<div style="color:#6b7385;font-size:13px;margin-top:2px;">${escapeHtml(item.description)}</div>` : ''}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e6e9f0;text-align:center;">${item.quantity}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e6e9f0;text-align:right;white-space:nowrap;">
          ${escapeHtml(formatMoney(item.unitPrice, v.currency))}
          <div style="color:#6b7385;font-size:12px;">${escapeHtml(BILLING_CYCLE_LABELS[item.billingCycle as BillingCycle] ?? '')}</div>
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e6e9f0;text-align:right;white-space:nowrap;font-weight:600;">
          ${escapeHtml(formatMoney(item.amount, v.currency))}
        </td>
      </tr>`,
    )
    .join('');

  return `
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2430;font-size:14px;line-height:1.65;max-width:760px;margin:0 auto;padding:32px;background:#ffffff;">
  <div style="border-bottom:2px solid #1f41f5;padding-bottom:16px;margin-bottom:24px;">
    <div style="font-size:22px;font-weight:700;">${escapeHtml(v.firmName)}</div>
    <div style="color:#6b7385;font-size:13px;">${escapeHtml(v.firmAddress)} &middot; ${escapeHtml(v.firmEmail)}</div>
  </div>

  <h1 style="font-size:20px;margin:0 0 4px;">Letter of engagement</h1>
  <div style="color:#6b7385;font-size:13px;margin-bottom:24px;">
    Reference ${escapeHtml(v.proposalNumber)} &middot; Effective ${escapeHtml(formatDate(v.effectiveDate))}
  </div>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
    <tr>
      <td style="width:50%;vertical-align:top;padding-right:12px;">
        <div style="color:#6b7385;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">Between</div>
        <div style="font-weight:600;">${escapeHtml(v.firmName)}</div>
        <div style="color:#4b5262;">${escapeHtml(v.firmAddress)}</div>
      </td>
      <td style="width:50%;vertical-align:top;">
        <div style="color:#6b7385;font-size:12px;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;">And</div>
        <div style="font-weight:600;">${escapeHtml(v.clientLegalName || v.clientName)}</div>
        <div style="color:#4b5262;">${escapeHtml(v.contactName)} &middot; ${escapeHtml(v.contactEmail)}</div>
      </td>
    </tr>
  </table>

  <h2 style="font-size:16px;margin:28px 0 8px;">Services and fees</h2>
  <table style="width:100%;border-collapse:collapse;">
    <thead>
      <tr style="background:#f5f6fa;">
        <th style="text-align:left;padding:8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7385;">Service</th>
        <th style="text-align:center;padding:8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7385;">Qty</th>
        <th style="text-align:right;padding:8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7385;">Rate</th>
        <th style="text-align:right;padding:8px;font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7385;">Amount</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <table style="width:100%;margin-top:14px;border-collapse:collapse;">
    <tr><td style="text-align:right;padding:3px 8px;color:#6b7385;">Subtotal</td><td style="text-align:right;padding:3px 8px;width:140px;">${escapeHtml(formatMoney(v.subtotal, v.currency))}</td></tr>
    ${v.discount ? `<tr><td style="text-align:right;padding:3px 8px;color:#6b7385;">Discount</td><td style="text-align:right;padding:3px 8px;">-${escapeHtml(formatMoney(v.discount, v.currency))}</td></tr>` : ''}
    ${v.tax ? `<tr><td style="text-align:right;padding:3px 8px;color:#6b7385;">VAT (${v.taxRate}%)</td><td style="text-align:right;padding:3px 8px;">${escapeHtml(formatMoney(v.tax, v.currency))}</td></tr>` : ''}
    <tr><td style="text-align:right;padding:8px;font-weight:700;border-top:2px solid #1f2430;">Total</td><td style="text-align:right;padding:8px;font-weight:700;border-top:2px solid #1f2430;">${escapeHtml(formatMoney(v.total, v.currency))}</td></tr>
    ${v.depositAmount ? `<tr><td style="text-align:right;padding:3px 8px;color:#6b7385;">Payable on signature</td><td style="text-align:right;padding:3px 8px;font-weight:600;">${escapeHtml(formatMoney(v.depositAmount, v.currency))}</td></tr>` : ''}
  </table>

  <h2 style="font-size:16px;margin:32px 0 8px;">Terms</h2>
  <div style="color:#3b4255;">${v.termsHtml}</div>

  <h2 style="font-size:16px;margin:32px 0 8px;">Acceptance</h2>
  <p style="color:#3b4255;">By signing below, ${escapeHtml(v.clientLegalName || v.clientName)} accepts the services, fees and terms set out in this letter.</p>

  <table style="width:100%;margin-top:24px;border-collapse:collapse;">
    <tr>
      <td style="width:50%;padding:16px 12px 0 0;vertical-align:bottom;">
        <div style="border-bottom:1px solid #1f2430;height:44px;">/sig1/</div>
        <div style="color:#6b7385;font-size:12px;margin-top:6px;">Signature</div>
      </td>
      <td style="width:50%;padding:16px 0 0 12px;vertical-align:bottom;">
        <div style="border-bottom:1px solid #1f2430;height:44px;">/name1/</div>
        <div style="color:#6b7385;font-size:12px;margin-top:6px;">Full name</div>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 12px 0 0;">
        <div style="border-bottom:1px solid #1f2430;height:32px;">/date1/</div>
        <div style="color:#6b7385;font-size:12px;margin-top:6px;">Date</div>
      </td>
      <td></td>
    </tr>
  </table>
</div>`.trim();
}
