import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { hashPassword } from '@/lib/auth';
import { ROLES } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(10, 'Use at least 10 characters'),
  role: z.enum(ROLES).default('STAFF'),
  jobTitle: z.string().nullable().optional(),
  avatarColor: z.string().optional(),
});

export const POST = handler(async (request: Request) => {
  await requireRole('OWNER');
  const input = schema.parse(await request.json());

  const email = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('Someone already uses that email address');

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      jobTitle: input.jobTitle || null,
      avatarColor: input.avatarColor || '#3564ff',
    },
    select: { id: true, name: true, email: true, role: true },
  });

  return ok({ user }, 201);
});
