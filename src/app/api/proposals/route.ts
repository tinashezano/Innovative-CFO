import { z } from 'zod';
import { prisma, nextReference } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { computeProposalTotals } from '@/lib/workflow';
import { getSettings } from '@/lib/settings';
import { addDays, randomToken } from '@/lib/utils';
import { BILLING_CYCLES } from '@/lib/constants';

const itemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  name: z.string().min(1, 'Every line needs a name'),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number().min(0).default(1),
  unitPrice: z.coerce.number().min(0).default(0),
  billingCycle: z.enum(BILLING_CYCLES).default('MONTHLY'),
});

const schema = z.object({
  leadId: z.string().nullable().optional(),
  clientId: z.string().nullable().optional(),
  title: z.string().min(1, 'Give the proposal a title'),
  summary: z.string().nullable().optional(),
  currency: z.string().optional(),
  discount: z.coerce.number().min(0).default(0),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  depositAmount: z.coerce.number().min(0).default(0),
  validUntil: z.string().nullable().optional(),
  scopeHtml: z.string().nullable().optional(),
  termsHtml: z.string().nullable().optional(),
  items: z.array(itemSchema).min(1, 'Add at least one line item'),
  send: z.boolean().optional(),
});

export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const settings = await getSettings();
  const input = schema.parse(await request.json());

  const { subtotal, tax, total } = computeProposalTotals(input.items, input.discount, input.taxRate);
  const number = await nextReference('proposal', 'PR');

  const proposal = await prisma.proposal.create({
    data: {
      number,
      leadId: input.leadId || null,
      clientId: input.clientId || null,
      title: input.title,
      summary: input.summary || null,
      currency: input.currency || settings.defaultCurrency,
      subtotal,
      discount: input.discount,
      taxRate: input.taxRate,
      tax,
      total,
      depositAmount: input.depositAmount,
      validUntil: toDate(input.validUntil) ?? addDays(new Date(), settings.proposalValidityDays),
      scopeHtml: input.scopeHtml || null,
      termsHtml: input.termsHtml || settings.engagementTermsHtml,
      publicToken: randomToken(16),
      status: 'DRAFT',
      createdById: user.id,
      items: {
        create: input.items.map((item, index) => ({
          serviceId: item.serviceId || null,
          name: item.name,
          description: item.description || null,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
          billingCycle: item.billingCycle,
          sortOrder: index,
        })),
      },
    },
  });

  return ok({ proposal }, 201);
});
