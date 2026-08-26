'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { Field, FormError, submitJson } from '@/components/forms';
import { formatMoney, isoDate, addDays } from '@/lib/utils';
import { BILLING_CYCLES, BILLING_CYCLE_LABELS, type BillingCycle } from '@/lib/constants';

type Service = {
  id: string;
  name: string;
  description: string | null;
  defaultPrice: number;
  billingCycle: string;
};

type Line = {
  key: string;
  serviceId: string | null;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  billingCycle: string;
};

let lineCounter = 0;
const newLine = (partial: Partial<Line> = {}): Line => ({
  key: `line-${(lineCounter += 1)}`,
  serviceId: null,
  name: '',
  description: '',
  quantity: 1,
  unitPrice: 0,
  billingCycle: 'MONTHLY',
  ...partial,
});

export function ProposalBuilder({
  services,
  leads,
  clients,
  defaultLeadId,
  defaultClientId,
  defaultTitle,
  currency,
  defaultTerms,
  validityDays,
}: {
  services: Service[];
  leads: { id: string; companyName: string; contactName: string; serviceInterest: string | null }[];
  clients: { id: string; name: string }[];
  defaultLeadId: string | null;
  defaultClientId: string | null;
  defaultTitle: string;
  currency: string;
  defaultTerms: string;
  validityDays: number;
}) {
  const router = useRouter();

  const [leadId, setLeadId] = useState(defaultLeadId ?? '');
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [title, setTitle] = useState(defaultTitle);
  const [summary, setSummary] = useState('');
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [discount, setDiscount] = useState(0);
  const [taxRate, setTaxRate] = useState(15);
  const [depositMode, setDepositMode] = useState<'none' | 'first-month' | 'custom'>('first-month');
  const [customDeposit, setCustomDeposit] = useState(0);
  const [validUntil, setValidUntil] = useState(isoDate(addDays(new Date(), validityDays)));
  const [terms, setTerms] = useState(defaultTerms);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const subtotal = lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    const afterDiscount = Math.max(0, subtotal - discount);
    const tax = Math.round(afterDiscount * (taxRate / 100) * 100) / 100;
    const total = Math.round((afterDiscount + tax) * 100) / 100;
    const monthly = lines
      .filter((l) => l.billingCycle === 'MONTHLY')
      .reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);
    return { subtotal, tax, total, monthly };
  }, [lines, discount, taxRate]);

  const deposit =
    depositMode === 'none' ? 0 : depositMode === 'custom' ? customDeposit : Math.round(totals.monthly * 1.15 * 100) / 100;

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function pickService(key: string, serviceId: string) {
    const service = services.find((s) => s.id === serviceId);
    if (!service) {
      updateLine(key, { serviceId: null });
      return;
    }
    updateLine(key, {
      serviceId: service.id,
      name: service.name,
      description: service.description ?? '',
      unitPrice: service.defaultPrice,
      billingCycle: service.billingCycle,
    });
  }

  async function save(send: boolean) {
    const usable = lines.filter((l) => l.name.trim());
    if (!usable.length) {
      setError('Add at least one line item.');
      return;
    }
    if (!leadId && !clientId) {
      setError('Pick the lead or client this proposal is for.');
      return;
    }

    setBusy(true);
    setError(null);

    const result = await submitJson('/api/proposals', {
      leadId: leadId || null,
      clientId: clientId || null,
      title,
      summary: summary || null,
      currency,
      discount,
      taxRate,
      depositAmount: deposit,
      validUntil,
      termsHtml: terms,
      items: usable.map((l) => ({
        serviceId: l.serviceId,
        name: l.name,
        description: l.description || null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        billingCycle: l.billingCycle,
      })),
    });

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    const proposalId = (result.data as { proposal: { id: string } }).proposal.id;

    if (send) {
      const sent = await submitJson(`/api/proposals/${proposalId}/send`, {});
      if (!sent.ok) {
        setBusy(false);
        setError(`Proposal saved as a draft, but sending failed: ${sent.error}`);
        router.push(`/proposals/${proposalId}`);
        return;
      }
    }

    router.push(`/proposals/${proposalId}`);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card card-pad space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Who is it for?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Lead">
              <select
                className="input"
                value={leadId}
                onChange={(e) => {
                  setLeadId(e.target.value);
                  if (e.target.value) setClientId('');
                }}
              >
                <option value="">— none —</option>
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.companyName} ({lead.contactName})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Or an existing client" hint="Use this for an upsell to a client you already have.">
              <select
                className="input"
                value={clientId}
                onChange={(e) => {
                  setClientId(e.target.value);
                  if (e.target.value) setLeadId('');
                }}
              >
                <option value="">— none —</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Title" required>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </Field>

          <Field label="Opening summary" hint="The first thing the client reads. Keep it about them.">
            <textarea
              className="input"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Based on our conversation, here's how we'd take the finance function off your plate…"
            />
          </Field>
        </section>

        <section className="card">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">Services and pricing</h2>
            <button type="button" className="btn-secondary btn-sm" onClick={() => setLines((l) => [...l, newLine()])}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add line
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {lines.map((line) => (
              <div key={line.key} className="flex items-start gap-3 px-5 py-4">
                <GripVertical className="mt-2 h-4 w-4 shrink-0 text-slate-300" aria-hidden />

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <select
                      className="input"
                      value={line.serviceId ?? ''}
                      onChange={(e) => pickService(line.key, e.target.value)}
                      aria-label="Pick from the service catalogue"
                    >
                      <option value="">— custom line —</option>
                      {services.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="input"
                      placeholder="Line name"
                      value={line.name}
                      onChange={(e) => updateLine(line.key, { name: e.target.value })}
                      aria-label="Line name"
                    />
                  </div>

                  <input
                    className="input"
                    placeholder="Description (optional)"
                    value={line.description}
                    onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    aria-label="Line description"
                  />

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <label className="block">
                      <span className="label">Qty</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        className="input"
                        value={line.quantity}
                        onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Unit price</span>
                      <input
                        type="number"
                        min="0"
                        step="50"
                        className="input"
                        value={line.unitPrice}
                        onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                      />
                    </label>
                    <label className="block">
                      <span className="label">Cycle</span>
                      <select
                        className="input"
                        value={line.billingCycle}
                        onChange={(e) => updateLine(line.key, { billingCycle: e.target.value })}
                      >
                        {BILLING_CYCLES.map((cycle) => (
                          <option key={cycle} value={cycle}>
                            {BILLING_CYCLE_LABELS[cycle as BillingCycle]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div>
                      <span className="label">Amount</span>
                      <p className="pt-2 text-sm font-semibold text-slate-900">
                        {formatMoney(line.quantity * line.unitPrice, currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setLines((current) => (current.length > 1 ? current.filter((l) => l.key !== line.key) : current))}
                  className="btn-ghost btn-sm mt-1 shrink-0 text-slate-400 hover:text-red-600"
                  aria-label="Remove line"
                  disabled={lines.length === 1}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="card card-pad">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Engagement letter terms</h2>
          <p className="mb-3 text-xs text-slate-500">
            These terms go into the engagement letter the client signs. Edit the firm-wide default in
            Settings; changes here apply to this proposal only. HTML is supported.
          </p>
          <textarea
            className="input font-mono text-xs"
            rows={12}
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            aria-label="Engagement letter terms"
          />
        </section>
      </div>

      {/* Summary rail */}
      <div className="space-y-6">
        <section className="card card-pad lg:sticky lg:top-6">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Totals</h2>

          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-600">Discount</dt>
              <dd>
                <input
                  type="number"
                  min="0"
                  step="100"
                  className="input w-28 py-1 text-right text-sm"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  aria-label="Discount"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-600">VAT %</dt>
              <dd>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  className="input w-28 py-1 text-right text-sm"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  aria-label="VAT rate"
                />
              </dd>
            </div>
            <Row label="VAT" value={formatMoney(totals.tax, currency)} />
            <div className="flex justify-between border-t border-slate-200 pt-2.5 text-base font-bold text-slate-900">
              <dt>Total</dt>
              <dd>{formatMoney(totals.total, currency)}</dd>
            </div>
          </dl>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <span className="label">Payable on signature</span>
            <select
              className="input"
              value={depositMode}
              onChange={(e) => setDepositMode(e.target.value as typeof depositMode)}
            >
              <option value="first-month">First month, incl. VAT</option>
              <option value="custom">A set amount</option>
              <option value="none">Nothing up front</option>
            </select>
            {depositMode === 'custom' ? (
              <input
                type="number"
                min="0"
                step="100"
                className="input mt-2"
                value={customDeposit}
                onChange={(e) => setCustomDeposit(Number(e.target.value))}
                aria-label="Deposit amount"
              />
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              The client pays {formatMoney(deposit || totals.total, currency)} through Paystack straight after
              signing.
            </p>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-4">
            <Field label="Valid until">
              <input
                type="date"
                className="input"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </Field>
          </div>

          <FormError message={error} />

          <div className="mt-5 space-y-2">
            <button type="button" className="btn-primary w-full" onClick={() => save(true)} disabled={busy}>
              {busy ? 'Working…' : 'Save and send'}
            </button>
            <button type="button" className="btn-secondary w-full" onClick={() => save(false)} disabled={busy}>
              Save as draft
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-600">
      <dt>{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}
