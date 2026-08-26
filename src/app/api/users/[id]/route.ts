import { z } from 'zod';
import { prisma } from '@/lib/db';
import { requireRole, requireUser, hashPassword } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { ROLES } from '@/lib/constants';

const schema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(ROLES).optional(),
  jobTitle: z.string().nullable().optional(),
  avatarColor: z.string().optional(),
  active: z.boolean().optional(),
  password: z.string().min(10, 'Use at least 10 characters').optional(),
});

export const PATCH = handler(async (request: Request, ctx: { params: Promise<{ id: string }> }) => {
  const actor = await requireUser();
  const { id } = await ctx.params;
  const input = schema.parse(await request.json());

  // You may edit your own name and password; anything else, or anyone else,
  // needs owner rights.
  const changingOthers = id !== actor.id;
  const changingPrivileges = input.role !== undefined || input.active !== undefined;
  if (changingOthers || changingPrivileges) await requireRole('OWNER');

  // Losing the last owner would lock everyone out of user management.
  if (input.role !== undefined || input.active === false) {
    const target = await prisma.user.findUnique({ where: { id } });
    if (target?.role === 'OWNER') {
      const owners = await prisma.user.count({ where: { role: 'OWNER', active: true } });
      const stillOwner = (input.role ?? target.role) === 'OWNER' && input.active !== false;
      if (owners <= 1 && !stillOwner) {
        throw new Error('The firm must keep at least one active owner');
      }
    }
  }

  const { password, ...fields } = input;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...fields,
      ...(password ? { passwordHash: await hashPassword(password) } : {}),
    },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  return ok({ user });
});
