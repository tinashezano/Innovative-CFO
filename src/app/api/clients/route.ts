import { z } from 'zod';
import { prisma, nextReference } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { getSettings } from '@/lib/settings';
import { seedRecurringCalendar, startOnboarding } from '@/lib/workflow';
import { CLIENT_STATUSES } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1, 'Client name is required'),
  legalName: z.string().nullable().optional(),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  industry: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),
  financialYearEnd: z.string().nullable().optional(),
  monthlyFee: z.coerce.number().min(0).default(0),
  ownerId: z.string().nullable().optional(),
  status: z.enum(CLIENT_STATUSES).default('ONBOARDING'),
  contactName: z.string().nullable().optional(),
  withOnboarding: z.boolean().default(true),
  withRecurringCalendar: z.boolean().default(false),
});

/** Adds a client directly — for clients that predate the app. */
export const POST = handler(async (request: Request) => {
  const user = await requireUser();
  const settings = await getSettings();
  const input = schema.parse(await request.json());

  const reference = await nextReference('client', 'CL');

  const client = await prisma.client.create({
    data: {
      reference,
      name: input.name,
      legalName: input.legalName || null,
      email: input.email,
      phone: input.phone || null,
      address: input.address || null,
      industry: input.industry || null,
      taxNumber: input.taxNumber || null,
      registrationNumber: input.registrationNumber || null,
      financialYearEnd: input.financialYearEnd || null,
      monthlyFee: input.monthlyFee,
      currency: settings.defaultCurrency,
      status: input.status,
      ownerId: input.ownerId || user.id,
      startDate: new Date(),
      contacts: input.contactName
        ? { create: [{ name: input.contactName, email: input.email, isPrimary: true }] }
        : undefined,
    },
  });

  if (input.withOnboarding) {
    await startOnboarding(client.id, client.ownerId);
  }
  if (input.withRecurringCalendar) {
    await seedRecurringCalendar(client.id, []);
  }

  return ok({ client }, 201);
});
