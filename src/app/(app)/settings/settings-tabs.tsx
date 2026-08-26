'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Mail, PlayCircle, RefreshCw, TriangleAlert } from 'lucide-react';
import { Avatar } from '@/components/ui';
import { Field, FormError, submitJson } from '@/components/forms';
import { Modal } from '@/components/modal';
import { cn, formatDateTime, parseJson } from '@/lib/utils';
import { CURRENCIES, ROLES, ROLE_LABELS, type Role } from '@/lib/constants';

type Settings = {
  firmName: string;
  firmEmail: string;
  firmPhone: string;
  firmAddress: string;
  defaultCurrency: string;
  reminderOffsetDays: number[];
  overdueRemindersEnabled: boolean;
  discoveryDays: number[];
  discoveryStartHour: number;
  discoveryEndHour: number;
  discoveryDurationMins: number;
  discoverySlotMinutes: number;
  proposalValidityDays: number;
  welcomePackHtml: string;
  engagementTermsHtml: string;
};

const TABS = ['Firm', 'Automation', 'Templates', 'Team', 'Integrations', 'Email log'] as const;
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function SettingsTabs({
  canManage,
  isOwner,
  currentUserId,
  settings,
  users,
  services,
  integrations,
  job,
  emailCount,
  recentEmails,
}: {
  canManage: boolean;
  isOwner: boolean;
  currentUserId: string;
  settings: Settings;
  users: {
    id: string;
    name: string;
    email: string;
    role: string;
    jobTitle: string | null;
    active: boolean;
    avatarColor: string;
    lastLoginAt: string | null;
  }[];
  services: {
    id: string;
    name: string;
    description: string | null;
    defaultPrice: number;
    billingCycle: string;
    active: boolean;
  }[];
  integrations: {
    docusign: { mode: string; configured: boolean };
    paystack: { mode: string; configured: boolean };
    email: { mode: string; configured: boolean };
  };
  job: { lastRunAt: string | null; lastRunAction: string | null; lastRunMeta: string | null };
  emailCount: number;
  recentEmails: {
    id: string;
    to: string;
    subject: string;
    status: string;
    template: string | null;
    sentAt: string;
  }[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Firm');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offsets, setOffsets] = useState(settings.reminderOffsetDays.join(', '));
  const [days, setDays] = useState<number[]>(settings.discoveryDays);
  const [newUserOpen, setNewUserOpen] = useState(false);

  async function save(patch: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const result = await submitJson('/api/settings', patch, 'PATCH');
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setNotice('Saved.');
    setTimeout(() => setNotice(null), 3000);
    router.refresh();
    return true;
  }

  async function runJob() {
    setBusy(true);
    setError(null);
    const res = await fetch('/api/cron/run', { method: 'POST' });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) {
      setError(data?.error ?? 'The job could not be run.');
      return;
    }
    setNotice(
      `Created ${data.recurringTasksCreated} task(s), sent ${data.reminderEmailsSent} reminder email(s), expired ${data.proposalsExpired} proposal(s).`,
    );
    router.refresh();
  }

  const lastRunSummary = job.lastRunMeta
    ? parseJson<Record<string, number | string>>(job.lastRunMeta, {})
    : null;

  return (
    <>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setTab(name)}
            aria-current={tab === name ? 'page' : undefined}
            className={cn(
              '-mb-px border-b-2 px-3.5 py-2 text-sm font-semibold transition',
              tab === name
                ? 'border-brand-600 text-brand-700'
                : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
            )}
          >
            {name}
          </button>
        ))}
      </div>

      {notice ? (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</p>
      ) : null}
      <FormError message={error} />

      {!canManage ? (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You can view these settings but only managers and owners can change them.
        </p>
      ) : null}

      {/* --- Firm --- */}
      {tab === 'Firm' ? (
        <form
          className="card card-pad max-w-2xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = new FormData(e.currentTarget);
            void save({
              firmName: form.get('firmName'),
              firmEmail: form.get('firmEmail'),
              firmPhone: form.get('firmPhone'),
              firmAddress: form.get('firmAddress'),
              defaultCurrency: form.get('defaultCurrency'),
              proposalValidityDays: Number(form.get('proposalValidityDays')),
            });
          }}
        >
          <h2 className="text-sm font-semibold text-slate-900">Firm details</h2>
          <p className="text-xs text-slate-500">
            These appear on proposals, engagement letters and every email you send.
          </p>

          <Field label="Firm name" required>
            <input name="firmName" className="input" defaultValue={settings.firmName} disabled={!canManage} required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email">
              <input name="firmEmail" type="email" className="input" defaultValue={settings.firmEmail} disabled={!canManage} />
            </Field>
            <Field label="Phone">
              <input name="firmPhone" className="input" defaultValue={settings.firmPhone} disabled={!canManage} />
            </Field>
          </div>
          <Field label="Address">
            <input name="firmAddress" className="input" defaultValue={settings.firmAddress} disabled={!canManage} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Default currency">
              <select name="defaultCurrency" className="input" defaultValue={settings.defaultCurrency} disabled={!canManage}>
                {CURRENCIES.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Proposals valid for (days)">
              <input
                name="proposalValidityDays"
                type="number"
                min="1"
                max="365"
                className="input"
                defaultValue={settings.proposalValidityDays}
                disabled={!canManage}
              />
            </Field>
          </div>

          {canManage ? (
            <button type="submit" className="btn-primary" disabled={busy}>
              Save firm details
            </button>
          ) : null}
        </form>
      ) : null}

      {/* --- Automation --- */}
      {tab === 'Automation' ? (
        <div className="max-w-2xl space-y-6">
          <form
            className="card card-pad space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              const parsed = offsets
                .split(',')
                .map((value) => Number(value.trim()))
                .filter((value) => Number.isFinite(value) && value >= 0);
              void save({
                reminderOffsetDays: parsed,
                overdueRemindersEnabled: form.get('overdueRemindersEnabled') === 'on',
              });
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">Task reminder emails</h2>
            <p className="text-xs text-slate-500">
              Reminders are grouped per person, so someone with eight tasks due tomorrow gets one email
              listing all eight.
            </p>

            <Field
              label="Send this many days before the due date"
              hint="Comma separated. 0 means on the day itself."
            >
              <input
                className="input"
                value={offsets}
                onChange={(e) => setOffsets(e.target.value)}
                disabled={!canManage}
                placeholder="7, 3, 1, 0"
              />
            </Field>

            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                name="overdueRemindersEnabled"
                defaultChecked={settings.overdueRemindersEnabled}
                disabled={!canManage}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-600"
              />
              <span className="text-sm text-slate-600">
                Chase overdue tasks daily
                <span className="mt-0.5 block text-xs text-slate-400">
                  Repeats every day until the task is done or archived.
                </span>
              </span>
            </label>

            {canManage ? (
              <button type="submit" className="btn-primary" disabled={busy}>
                Save reminder settings
              </button>
            ) : null}
          </form>

          <form
            className="card card-pad space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save({
                discoveryDays: days,
                discoveryStartHour: Number(form.get('discoveryStartHour')),
                discoveryEndHour: Number(form.get('discoveryEndHour')),
                discoveryDurationMins: Number(form.get('discoveryDurationMins')),
                discoverySlotMinutes: Number(form.get('discoverySlotMinutes')),
              });
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">Discovery call availability</h2>
            <p className="text-xs text-slate-500">
              Controls the slots offered on the public booking page. Slots already taken are hidden.
            </p>

            <div>
              <span className="label">Days you take calls</span>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map((label, index) => (
                  <button
                    key={label}
                    type="button"
                    disabled={!canManage}
                    aria-pressed={days.includes(index)}
                    onClick={() =>
                      setDays((current) =>
                        current.includes(index) ? current.filter((d) => d !== index) : [...current, index],
                      )
                    }
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
                      days.includes(index)
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From (hour)">
                <input
                  name="discoveryStartHour"
                  type="number"
                  min="0"
                  max="23"
                  className="input"
                  defaultValue={settings.discoveryStartHour}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Until (hour)">
                <input
                  name="discoveryEndHour"
                  type="number"
                  min="1"
                  max="24"
                  className="input"
                  defaultValue={settings.discoveryEndHour}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Call length (minutes)">
                <input
                  name="discoveryDurationMins"
                  type="number"
                  min="5"
                  step="5"
                  className="input"
                  defaultValue={settings.discoveryDurationMins}
                  disabled={!canManage}
                />
              </Field>
              <Field label="Slot spacing (minutes)">
                <input
                  name="discoverySlotMinutes"
                  type="number"
                  min="5"
                  step="5"
                  className="input"
                  defaultValue={settings.discoverySlotMinutes}
                  disabled={!canManage}
                />
              </Field>
            </div>

            {canManage ? (
              <button type="submit" className="btn-primary" disabled={busy}>
                Save availability
              </button>
            ) : null}
          </form>

          <section className="card card-pad">
            <h2 className="text-sm font-semibold text-slate-900">Scheduled job</h2>
            <p className="mt-1 text-xs text-slate-500">
              Generates recurring tasks, sends reminder emails and expires stale proposals. Run it once a day.
            </p>

            {job.lastRunAt ? (
              <dl className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs">
                <div className="flex justify-between">
                  <dt className="text-slate-500">Last run</dt>
                  <dd className="font-medium text-slate-900">{formatDateTime(job.lastRunAt)}</dd>
                </div>
                {job.lastRunAction === 'cron.failed' ? (
                  <p className="text-red-700">The last run failed. See the audit log.</p>
                ) : lastRunSummary ? (
                  <>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Tasks created</dt>
                      <dd className="font-medium">{String(lastRunSummary.recurringTasksCreated ?? 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Reminder emails</dt>
                      <dd className="font-medium">{String(lastRunSummary.reminderEmailsSent ?? 0)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-500">Proposals expired</dt>
                      <dd className="font-medium">{String(lastRunSummary.proposalsExpired ?? 0)}</dd>
                    </div>
                  </>
                ) : null}
              </dl>
            ) : (
              <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                The job has never run. Schedule a daily call to{' '}
                <code className="font-mono">/api/cron/run</code>, or run{' '}
                <code className="font-mono">npm run scheduler</code>.
              </p>
            )}

            <button type="button" className="btn-secondary mt-4" onClick={runJob} disabled={busy}>
              <PlayCircle className="h-4 w-4" aria-hidden />
              Run it now
            </button>
          </section>
        </div>
      ) : null}

      {/* --- Templates --- */}
      {tab === 'Templates' ? (
        <div className="max-w-3xl space-y-6">
          <form
            className="card card-pad space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save({ welcomePackHtml: form.get('welcomePackHtml') });
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">Welcome pack</h2>
            <p className="text-xs text-slate-500">
              Sent automatically the moment a proposal is signed and paid. Placeholders:{' '}
              <code className="font-mono">{'{{firmName}}'}</code>{' '}
              <code className="font-mono">{'{{clientName}}'}</code>{' '}
              <code className="font-mono">{'{{contactName}}'}</code>{' '}
              <code className="font-mono">{'{{ownerName}}'}</code>{' '}
              <code className="font-mono">{'{{firmEmail}}'}</code>
            </p>
            <textarea
              name="welcomePackHtml"
              rows={14}
              className="input font-mono text-xs"
              defaultValue={settings.welcomePackHtml}
              disabled={!canManage}
            />
            {canManage ? (
              <button type="submit" className="btn-primary" disabled={busy}>
                Save welcome pack
              </button>
            ) : null}
          </form>

          <form
            className="card card-pad space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              void save({ engagementTermsHtml: form.get('engagementTermsHtml') });
            }}
          >
            <h2 className="text-sm font-semibold text-slate-900">Engagement letter terms</h2>
            <p className="text-xs text-slate-500">
              The default terms for every new proposal. Existing proposals keep the terms they were created
              with, so changing this never alters a contract someone has already signed.
            </p>
            <textarea
              name="engagementTermsHtml"
              rows={18}
              className="input font-mono text-xs"
              defaultValue={settings.engagementTermsHtml}
              disabled={!canManage}
            />
            {canManage ? (
              <button type="submit" className="btn-primary" disabled={busy}>
                Save terms
              </button>
            ) : null}
          </form>

          <section className="card">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">Service catalogue</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {services.map((service) => (
                <li key={service.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{service.name}</p>
                    {service.description ? (
                      <p className="mt-0.5 text-xs text-slate-500">{service.description}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {settings.defaultCurrency} {service.defaultPrice.toLocaleString('en-ZA')}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {service.billingCycle.toLowerCase().replace(/_/g, ' ')}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {/* --- Team --- */}
      {tab === 'Team' ? (
        <div className="max-w-3xl">
          {isOwner ? (
            <div className="mb-4 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setNewUserOpen(true)}>
                Add a team member
              </button>
            </div>
          ) : null}

          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Name</th>
                    <th className="th">Role</th>
                    <th className="th">Last signed in</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((member) => (
                    <tr key={member.id} className={cn(!member.active && 'opacity-50')}>
                      <td className="td">
                        <span className="inline-flex items-center gap-2.5">
                          <Avatar name={member.name} color={member.avatarColor} size="sm" />
                          <span>
                            <span className="block font-medium text-slate-900">{member.name}</span>
                            <span className="block text-xs text-slate-500">{member.email}</span>
                          </span>
                        </span>
                      </td>
                      <td className="td">
                        {isOwner ? (
                          <select
                            className="input w-auto py-1 text-xs"
                            defaultValue={member.role}
                            disabled={busy}
                            aria-label={`Role for ${member.name}`}
                            onChange={async (e) => {
                              setBusy(true);
                              const result = await submitJson(
                                `/api/users/${member.id}`,
                                { role: e.target.value },
                                'PATCH',
                              );
                              setBusy(false);
                              if (!result.ok) setError(result.error);
                              router.refresh();
                            }}
                          >
                            {ROLES.map((role) => (
                              <option key={role} value={role}>
                                {ROLE_LABELS[role as Role]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-sm">{ROLE_LABELS[member.role as Role] ?? member.role}</span>
                        )}
                      </td>
                      <td className="td text-xs text-slate-500">
                        {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : 'Never'}
                      </td>
                      <td className="td">
                        {isOwner && member.id !== currentUserId ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            disabled={busy}
                            onClick={async () => {
                              setBusy(true);
                              const result = await submitJson(
                                `/api/users/${member.id}`,
                                { active: !member.active },
                                'PATCH',
                              );
                              setBusy(false);
                              if (!result.ok) setError(result.error);
                              router.refresh();
                            }}
                          >
                            {member.active ? 'Deactivate' : 'Reactivate'}
                          </button>
                        ) : (
                          <span
                            className={cn(
                              'badge',
                              member.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600',
                            )}
                          >
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <Modal open={newUserOpen} onClose={() => setNewUserOpen(false)} title="Add a team member">
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                setBusy(true);
                setError(null);
                const result = await submitJson('/api/users', {
                  name: form.get('name'),
                  email: form.get('email'),
                  password: form.get('password'),
                  role: form.get('role'),
                  jobTitle: form.get('jobTitle') || null,
                });
                setBusy(false);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                setNewUserOpen(false);
                router.refresh();
              }}
            >
              <Field label="Name" required>
                <input name="name" className="input" required autoFocus />
              </Field>
              <Field label="Email" required>
                <input name="email" type="email" className="input" required />
              </Field>
              <Field label="Job title">
                <input name="jobTitle" className="input" />
              </Field>
              <Field label="Role">
                <select name="role" className="input" defaultValue="STAFF">
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role as Role]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Temporary password" required hint="At least 10 characters. Ask them to change it.">
                <input name="password" type="text" className="input" required minLength={10} />
              </Field>
              <FormError message={error} />
              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setNewUserOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={busy}>
                  Add member
                </button>
              </div>
            </form>
          </Modal>
        </div>
      ) : null}

      {/* --- Integrations --- */}
      {tab === 'Integrations' ? (
        <div className="max-w-2xl space-y-4">
          <IntegrationCard
            title="DocuSign"
            purpose="Embedded e-signature for engagement letters."
            mode={integrations.docusign.mode}
            configured={integrations.docusign.configured}
            liveHint="Set DOCUSIGN_MODE=live with your integration key, user id, account id and RSA private key. Grant consent once via the OAuth consent URL, then point a Connect subscription at /api/webhooks/docusign with HMAC signing on."
            mockHint="Engagement letters are rendered and signed inside the app. The same document, the same webhook handler — only the signing surface differs."
          />
          <IntegrationCard
            title="Paystack"
            purpose="Payment collected the moment the engagement letter is signed."
            mode={integrations.paystack.mode}
            configured={integrations.paystack.configured}
            liveHint="Set PAYSTACK_MODE=live with your secret key, and point your Paystack dashboard webhook at /api/webhooks/paystack."
            mockHint="A local checkout page stands in for Paystack so the sign-then-pay flow can be exercised without keys."
          />
          <IntegrationCard
            title="Email (SMTP)"
            purpose="Booking links, proposals, welcome packs and task reminders."
            mode={integrations.email.mode}
            configured={integrations.email.configured}
            liveHint="Set EMAIL_MODE=smtp with your SMTP host, port and credentials."
            mockHint={`Nothing leaves this machine. All ${emailCount} messages are recorded in the Email log tab instead.`}
          />
        </div>
      ) : null}

      {/* --- Email log --- */}
      {tab === 'Email log' ? (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
            <h2 className="text-sm font-semibold text-slate-900">
              Recent emails
              <span className="ml-2 text-xs font-normal text-slate-500">{emailCount} total</span>
            </h2>
            <button type="button" className="btn-ghost btn-sm" onClick={() => router.refresh()}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              Refresh
            </button>
          </div>
          {recentEmails.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px]">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="th">Sent</th>
                    <th className="th">To</th>
                    <th className="th">Subject</th>
                    <th className="th">Template</th>
                    <th className="th">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentEmails.map((entry) => (
                    <tr key={entry.id}>
                      <td className="td text-xs text-slate-500">{formatDateTime(entry.sentAt)}</td>
                      <td className="td text-xs">{entry.to}</td>
                      <td className="td text-xs text-slate-900">{entry.subject}</td>
                      <td className="td text-xs text-slate-500">{entry.template ?? '—'}</td>
                      <td className="td">
                        <span
                          className={cn(
                            'badge',
                            entry.status === 'SENT'
                              ? 'bg-emerald-100 text-emerald-800'
                              : entry.status === 'FAILED'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-600',
                          )}
                        >
                          {entry.status.toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              <Mail className="mx-auto mb-2 h-6 w-6 text-slate-300" aria-hidden />
              No emails yet.
            </p>
          )}
        </section>
      ) : null}
    </>
  );
}

function IntegrationCard({
  title,
  purpose,
  mode,
  configured,
  liveHint,
  mockHint,
}: {
  title: string;
  purpose: string;
  mode: string;
  configured: boolean;
  liveHint: string;
  mockHint: string;
}) {
  const live = mode === 'live' || mode === 'smtp';

  return (
    <section className="card card-pad">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{purpose}</p>
        </div>
        <span
          className={cn(
            'badge shrink-0',
            live ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
          )}
        >
          {live ? (
            <CheckCircle2 className="h-3 w-3" aria-hidden />
          ) : (
            <TriangleAlert className="h-3 w-3" aria-hidden />
          )}
          {live ? 'Live' : 'Demo mode'}
        </span>
      </div>

      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
        {live ? liveHint : mockHint}
      </p>

      {!live ? (
        <p className="mt-2 text-xs text-slate-400">
          {configured ? 'Credentials are present — switch the mode to go live.' : 'No credentials configured yet.'}
        </p>
      ) : null}
    </section>
  );
}
