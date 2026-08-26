import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { prisma } from '@/lib/db';
import { requirePageUser } from '@/lib/auth';
import { getSettings } from '@/lib/settings';
import { PageHeader } from '@/components/ui';
import { ProposalBuilder } from '../proposal-builder';

export const dynamic = 'force-dynamic';

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ leadId?: string; clientId?: string }>;
}) {
  await requirePageUser();
  const params = await searchParams;
  const settings = await getSettings();

  const [services, leads, clients, lead] = await Promise.all([
    prisma.service.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.lead.findMany({
      where: { stage: { in: ['NEW', 'DISCOVERY', 'PROPOSAL'] } },
      select: { id: true, companyName: true, contactName: true, serviceInterest: true },
      orderBy: { companyName: 'asc' },
    }),
    prisma.client.findMany({
      where: { status: { in: ['ACTIVE', 'ONBOARDING'] } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    params.leadId
      ? prisma.lead.findUnique({
          where: { id: params.leadId },
          select: { id: true, companyName: true, serviceInterest: true },
        })
      : null,
  ]);

  return (
    <>
      <Link
        href={params.leadId ? `/leads/${params.leadId}` : '/proposals'}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <PageHeader
        title="Build a proposal"
        subtitle={
          lead
            ? `For ${lead.companyName}. Once sent, the client reviews, signs and pays on one page.`
            : 'The client reviews, signs the engagement letter and pays on a single page.'
        }
      />

      <ProposalBuilder
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          description: s.description,
          defaultPrice: s.defaultPrice,
          billingCycle: s.billingCycle,
        }))}
        leads={leads}
        clients={clients}
        defaultLeadId={params.leadId ?? null}
        defaultClientId={params.clientId ?? null}
        defaultTitle={lead ? `Accounting services proposal — ${lead.companyName}` : ''}
        currency={settings.defaultCurrency}
        defaultTerms={settings.engagementTermsHtml}
        validityDays={settings.proposalValidityDays}
      />
    </>
  );
}
