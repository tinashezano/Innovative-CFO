/**
 * Runs the scheduled jobs once, then exits.
 *
 * Use this from a system cron, a container entrypoint or by hand:
 *   npm run jobs:run
 *
 * The same work is exposed over HTTP at /api/cron/run for platforms with a
 * managed scheduler (Vercel Cron, Railway, Render).
 */
import 'dotenv/config';

async function main() {
  const { generateRecurringTasks } = await import('../src/lib/tasks');
  const { sendDueReminders } = await import('../src/lib/reminders');
  const { prisma } = await import('../src/lib/db');

  const startedAt = new Date();
  console.log(`[jobs] starting ${startedAt.toISOString()}`);

  const generation = await generateRecurringTasks(startedAt);
  console.log(
    `[jobs] recurring: ${generation.created} task(s) created from ${generation.templatesProcessed} template(s)`,
  );

  const reminders = await sendDueReminders(startedAt);
  console.log(
    `[jobs] reminders: ${reminders.emailsSent} email(s) covering ${reminders.remindersProcessed} reminder(s)`,
  );

  const expired = await prisma.proposal.updateMany({
    where: { status: { in: ['SENT', 'VIEWED'] }, validUntil: { lt: startedAt } },
    data: { status: 'EXPIRED' },
  });
  console.log(`[jobs] proposals expired: ${expired.count}`);

  await prisma.auditLog.create({
    data: {
      action: 'cron.run',
      entityType: 'System',
      entityId: 'cron',
      meta: JSON.stringify({
        recurringTasksCreated: generation.created,
        reminderEmailsSent: reminders.emailsSent,
        proposalsExpired: expired.count,
      }),
    },
  });

  await prisma.$disconnect();
  console.log(`[jobs] done in ${Date.now() - startedAt.getTime()}ms`);
}

main().catch((err) => {
  console.error('[jobs] failed:', err);
  process.exit(1);
});
