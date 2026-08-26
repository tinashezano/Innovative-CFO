/**
 * Changes an account's password on a running database.
 *
 *   npm run set-password -- admin@innovativecfo.co.za 'your-new-password'
 *
 * Unlike re-seeding, this touches nothing else — leads, clients and tasks all
 * stay where they are. Quote the password so your shell does not interpret
 * characters like ! or $.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: npm run set-password -- <email> '<new password>'");
    console.error("Example: npm run set-password -- admin@innovativecfo.co.za 'MyPassword123'");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('[password] use at least 8 characters');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { id: true, name: true, email: true, role: true, active: true },
  });

  if (!user) {
    const all = await prisma.user.findMany({ select: { email: true }, orderBy: { email: 'asc' } });
    console.error(`[password] no account for ${email}`);
    if (all.length) {
      console.error('[password] accounts on this database:');
      for (const u of all) console.error(`             ${u.email}`);
    } else {
      console.error('[password] this database has no users yet — run: npm run setup');
    }
    process.exit(1);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });

  console.log(`[password] updated for ${user.email} (${user.name}, ${user.role.toLowerCase()})`);
  if (!user.active) {
    console.log('[password] note: this account is deactivated and cannot sign in until reactivated');
  }
}

main()
  .catch((err) => {
    console.error('[password] failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
