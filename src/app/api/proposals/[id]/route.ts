import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok, toDate } from '@/lib/api';
import { computeProposalTotals } from '@/lib/workflow';
import { BILLING_CYCLES } from '@/lib/constants';

const itemSchema = z.object({
  serviceId: z.string().nullable().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  quantity: z.coerce.number().min(0),
  unitPrice: z.coerce.number().min(0),
  billingCycle: z.enum(BILLING_CYCLES),
});

const schema = z.object({
  title: z.string().min(1).optional(),
  summary: z.string().nullable().optional(),
  discount: z.coerce.number().min(0).optional(),
  taxRate: z.coerce.number().min(0).max(100).optional(),
  depositAmount: z.coerce.number().min(0).optional(),
  validUntil: z.string().nullable().optional(),
  scopeHtml: z.string().nullable().optional(),
  termsHtml: z.string().nullable().optional(),
  items: z.array(itemSchema).optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  const existing = await prisma.proposal.findUnique({ where: { id }, include: { items: true } });
  if (!existing) throw new Error('Proposal not found');

  // A signed or paid proposal is a contract record — editing it would change
  // what the client agreed to.
  if (['SIGNED', 'PAID'].includes(existing.status)) {
    throw new Error('This proposal has been signed and can no longer be edited');
  }

  const items = input.items ?? existing.items;
  const discount = input.discount ?? existing.discount;
  const taxRate = input.taxRate ?? existing.taxRate;
  const { subtotal, tax, total } = computeProposalTotals(items, discount, taxRate);

  if (input.items) {
    await prisma.proposalItem.deleteMany({ where: { proposalId: id } });
    await prisma.proposalItem.createMany({
      data: input.items.map((item, index) => ({
        proposalId: id,
        serviceId: item.serviceId || null,
        name: item.name,
        description: item.description || null,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: Math.round(item.quantity * item.unitPrice * 100) / 100,
        billingCycle: item.billingCycle,
        sortOrder: index,
      })),
    });
  }

  const proposal = await prisma.proposal.update({
    where: { id },
    data: {
      ...(input.title ? { title: input.title } : {}),
      ...(input.summary !== undefined ? { summary: input.summary } : {}),
      ...(input.scopeHtml !== undefined ? { scopeHtml: input.scopeHtml } : {}),
      ...(input.termsHtml !== undefined ? { termsHtml: input.termsHtml } : {}),
      ...(input.depositAmount !== undefined ? { depositAmount: input.depositAmount } : {}),
      ...(input.validUntil !== undefined ? { validUntil: toDate(input.validUntil) } : {}),
      discount,
      taxRate,
      subtotal,
      tax,
      total,
    },
  });

  return ok({ proposal });
});

export const DELETE = handler(async (_request: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;

  const proposal = await prisma.proposal.findUnique({ where: { id } });
  if (!proposal) throw new Error('Proposal not found');
  if (proposal.status !== 'DRAFT') {
    throw new Error('Only draft proposals can be deleted');
  }

  await prisma.proposal.delete({ where: { id } });
  return ok({ deleted: true });
});
