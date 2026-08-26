'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard, FileSignature, Loader2, ShieldCheck } from 'lucide-react';
import { formatDate, formatMoney, cn } from '@/lib/utils';
import { BILLING_CYCLE_LABELS, type BillingCycle } from '@/lib/constants';

type Item = {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  billingCycle: string;
};

type Props = {
  token: string;
  firm: { name: string; email: string; phone: string; address: string };
  proposal: {
    id: string;
    number: string;
    title: string;
    summary: string | null;
    scopeHtml: string | null;
    currency: string;
    subtotal: number;
    discount: number;
    tax: number;
    taxRate: number;
    total: number;
    depositAmount: number;
    status: string;
    validUntil: string | null;
    declineReason: string | null;
    items: Item[];
  };
  recipient: { contactName: string; companyName: string; ownerName: string; ownerTitle: string | null };
  envelope: { id: string; status: string; signedAt: string | null } | null;
  payment: { reference: string; status: string; amount: number; authorizationUrl: string | null } | null;
  expired: boolean;
};

const STEPS = ['Review', 'Sign', 'Pay', 'Done'] as const;

export function ProposalClient(props: Props) {
  const { proposal, recipient, firm } = props;

  const [envelope, setEnvelope] = useState(props.envelope);
  const [payment, setPayment] = useState(props.payment);
  const [status, setStatus] = useState(proposal.status);
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);

  const signed = status === 'SIGNED' || status === 'PAID' || envelope?.status === 'COMPLETED';
  const paid = status === 'PAID' || payment?.status === 'SUCCESS';
  const declined = status === 'DECLINED';

  const step = paid ? 3 : signed ? 2 : status === 'ACCEPTED' ? 1 : 0;

  // The embedded signing window posts back when the client finishes, and the
  // payment redirect returns with ?paid=1 — poll briefly so the page catches up
  // with the webhook that is landing at the same time.
  useEffect(() => {
    if (paid || declined) return;
    if (!signed && status !== 'ACCEPTED') return;

    const timer = setInterval(async () => {
      const res = await fetch(`/api/public/proposal?token=${props.token}`);
      if (!res.ok) return;
      const data = await res.json();
      setStatus(data.status);
      setEnvelope(data.envelope);
      setPayment(data.payment);
      if (data.status === 'PAID') clearInterval(timer);
    }, 4000);

    return () => clearInterval(timer);
  }, [props.token, signed, paid, declined, status]);

  async function post(action: string, body: Record<string, unknown> = {}) {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/public/proposal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: props.token, action, ...body }),
    });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? 'Something went wrong. Please try again.');
      return null;
    }
    return data;
  }

  async function accept() {
    const data = await post('accept');
    if (!data) return;
    setStatus('ACCEPTED');
    setEnvelope(data.envelope);
    setSigningUrl(data.signingUrl);
  }

  async function startPayment() {
    const data = await post('pay');
    if (!data) return;
    setPayment(data.payment);
    if (data.payment?.authorizationUrl) window.location.href = data.payment.authorizationUrl;
  }

  async function decline(reason: string) {
    const data = await post('decline', { reason });
    if (!data) return;
    setStatus('DECLINED');
    setDeclineOpen(false);
  }

  const recurringTotal = proposal.items
    .filter((i) => i.billingCycle === 'MONTHLY')
    .reduce((s, i) => s + i.amount, 0);

  return (
    <main className="min-h-screen bg-slate-50 pb-16">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              IC
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{firm.name}</p>
              <p className="text-xs text-slate-500">Proposal {proposal.number}</p>
            </div>
          </div>
          {proposal.validUntil && !paid ? (
            <p className={cn('text-xs', props.expired ? 'text-red-600' : 'text-slate-500')}>
              {props.expired ? 'Expired' : 'Valid until'} {formatDate(proposal.validUntil)}
            </p>
          ) : null}
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {/* Progress */}
        <ol className="mb-8 flex items-center gap-2" aria-label="Progress">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-1 items-center gap-2">
              <div className="flex flex-1 flex-col gap-1.5">
                <div
                  className={cn(
                    'h-1.5 rounded-full transition',
                    index <= step ? 'bg-brand-600' : 'bg-slate-200',
                  )}
                />
                <span
                  className={cn(
                    'text-[11px] font-semibold',
                    index <= step ? 'text-brand-700' : 'text-slate-400',
                  )}
                >
                  {label}
                </span>
              </div>
            </li>
          ))}
        </ol>

        {declined ? (
          <div className="card px-6 py-12 text-center">
            <h1 className="text-lg font-bold text-slate-900">Proposal declined</h1>
            <p className="mt-2 text-sm text-slate-600">
              Thank you for letting us know. If circumstances change, {recipient.ownerName} is on{' '}
              <a href={`mailto:${firm.email}`} className="link">
                {firm.email}
              </a>
              .
            </p>
          </div>
        ) : paid ? (
          <div className="card px-6 py-12 text-center">
            <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-500" aria-hidden />
            <h1 className="text-xl font-bold text-slate-900">You&rsquo;re all set</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your engagement letter is signed and your payment has gone through. Your welcome pack is on its
              way, and {recipient.ownerName} will be in touch to start onboarding.
            </p>
            {payment ? (
              <p className="mt-4 text-xs text-slate-400">Payment reference {payment.reference}</p>
            ) : null}
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">{proposal.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Prepared for {recipient.companyName} · {recipient.ownerName}
              {recipient.ownerTitle ? `, ${recipient.ownerTitle}` : ''}
            </p>

            {proposal.summary ? (
              <p className="mt-5 rounded-xl border border-slate-200 bg-white p-5 text-sm leading-relaxed text-slate-700">
                {proposal.summary}
              </p>
            ) : null}

            {proposal.scopeHtml ? (
              <div
                className="prose-doc mt-5 rounded-xl border border-slate-200 bg-white p-5"
                dangerouslySetInnerHTML={{ __html: proposal.scopeHtml }}
              />
            ) : null}

            {/* Pricing */}
            <section className="card mt-6 overflow-hidden">
              <div className="border-b border-slate-200 px-5 py-3.5">
                <h2 className="text-sm font-semibold text-slate-900">What&rsquo;s included</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="th">Service</th>
                      <th className="th text-center">Qty</th>
                      <th className="th text-right">Rate</th>
                      <th className="th text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {proposal.items.map((item) => (
                      <tr key={item.id}>
                        <td className="td">
                          <p className="font-medium text-slate-900">{item.name}</p>
                          {item.description ? (
                            <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
                          ) : null}
                        </td>
                        <td className="td text-center">{item.quantity}</td>
                        <td className="td text-right">
                          {formatMoney(item.unitPrice, proposal.currency)}
                          <span className="block text-[11px] text-slate-400">
                            {BILLING_CYCLE_LABELS[item.billingCycle as BillingCycle]}
                          </span>
                        </td>
                        <td className="td text-right font-semibold">
                          {formatMoney(item.amount, proposal.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
                <dl className="ml-auto max-w-xs space-y-1.5 text-sm">
                  <Line label="Subtotal" value={formatMoney(proposal.subtotal, proposal.currency)} />
                  {proposal.discount ? (
                    <Line label="Discount" value={`-${formatMoney(proposal.discount, proposal.currency)}`} />
                  ) : null}
                  {proposal.tax ? (
                    <Line label={`VAT (${proposal.taxRate}%)`} value={formatMoney(proposal.tax, proposal.currency)} />
                  ) : null}
                  <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold text-slate-900">
                    <dt>Total</dt>
                    <dd>{formatMoney(proposal.total, proposal.currency)}</dd>
                  </div>
                  {recurringTotal ? (
                    <p className="pt-1 text-right text-[11px] text-slate-500">
                      Includes {formatMoney(recurringTotal, proposal.currency)} of recurring monthly fees
                    </p>
                  ) : null}
                  {proposal.depositAmount ? (
                    <p className="pt-1 text-right text-xs font-semibold text-brand-700">
                      {formatMoney(proposal.depositAmount, proposal.currency)} payable on signature
                    </p>
                  ) : null}
                </dl>
              </div>
            </section>

            {/* Action panel */}
            <section className="card mt-6 p-6">
              {error ? (
                <p role="alert" className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {!signed && !signingUrl ? (
                <>
                  <h2 className="text-base font-bold text-slate-900">Ready to go ahead?</h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Accepting opens your engagement letter for electronic signature. Once it&rsquo;s signed
                    you&rsquo;ll be able to pay securely and we&rsquo;ll start onboarding straight away.
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      className="btn-primary"
                      onClick={accept}
                      disabled={busy || props.expired}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <FileSignature className="h-4 w-4" aria-hidden />
                      )}
                      Accept and sign
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setDeclineOpen(true)}
                      disabled={busy}
                    >
                      Decline
                    </button>
                  </div>
                  {props.expired ? (
                    <p className="mt-3 text-xs text-red-600">
                      This proposal has expired. Contact {recipient.ownerName} for a fresh one.
                    </p>
                  ) : null}
                </>
              ) : null}

              {/* Embedded signing */}
              {signingUrl && !signed ? (
                <>
                  <h2 className="text-base font-bold text-slate-900">Sign your engagement letter</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Read it through and sign at the bottom. This window is your signing session.
                  </p>
                  <iframe
                    src={signingUrl}
                    title="Engagement letter signing"
                    className="mt-4 h-[640px] w-full rounded-lg border border-slate-300 bg-white"
                  />
                </>
              ) : null}

              {signed && !paid ? (
                <>
                  <div className="mb-4 flex items-start gap-2.5 rounded-lg bg-emerald-50 p-3.5">
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
                    <div>
                      <p className="text-sm font-semibold text-emerald-900">Engagement letter signed</p>
                      <p className="text-xs text-emerald-700">
                        {envelope?.signedAt ? formatDate(envelope.signedAt) : 'Just now'} — a copy is on file.
                      </p>
                    </div>
                  </div>

                  <h2 className="text-base font-bold text-slate-900">One last step: payment</h2>
                  <p className="mt-1.5 text-sm text-slate-600">
                    Pay{' '}
                    <strong className="text-slate-900">
                      {formatMoney(payment?.amount ?? (proposal.depositAmount || proposal.total), proposal.currency)}
                    </strong>{' '}
                    securely through Paystack to activate your engagement.
                  </p>
                  <button type="button" className="btn-primary mt-5" onClick={startPayment} disabled={busy}>
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    ) : (
                      <CreditCard className="h-4 w-4" aria-hidden />
                    )}
                    Pay now
                  </button>
                </>
              ) : null}
            </section>
          </>
        )}

        <p className="mt-8 text-center text-xs text-slate-400">
          {firm.name} · {firm.address} · {firm.email}
          {firm.phone ? ` · ${firm.phone}` : ''}
        </p>
      </div>

      {declineOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-900/40"
            aria-label="Close"
            onClick={() => setDeclineOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-slate-900">Decline this proposal</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const reason = new FormData(e.currentTarget).get('reason') as string;
                void decline(reason);
              }}
              className="mt-4 space-y-4"
            >
              <label className="block">
                <span className="label">Anything you&rsquo;d like us to know? (optional)</span>
                <textarea name="reason" rows={3} className="input" autoFocus />
              </label>
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setDeclineOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-danger" disabled={busy}>
                  Decline proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
