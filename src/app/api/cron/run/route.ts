import { NextResponse } from 'next/server';
import { generateRecurringTasks } from '@/lib/tasks';
import { sendDueReminders } from '@/lib/reminders';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/auth';

/**
 * The scheduled job: generates recurring tasks and sends due-date reminders.
 *
 * Run it once a day (early morning suits an accounting firm). Authorise with
 * either the CRON_SECRET bearer token or a signed-in session, so it can also
 * be triggered by hand from Settings.
 *
 *   Vercel Cron:  add to vercel.json — "crons": [{ "path": "/api/cron/run", "schedule": "0 6 * * *" }]
 *   Any host:     curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/run
 *   Locally:      npm run scheduler
 */
async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  const bearerOk = Boolean(secret) && auth === `Bearer ${secret}`;
  const sessionOk = Boolean(await getSessionUser());

  if (!bearerOk && !sessionOk) {
    return NextResponse.json({ error: 'Not authorised' }, { status: 401 });
  }

  const startedAt = new Date();

  try {
    const generation = await generateRecurringTasks(startedAt);
    const reminders = await sendDueReminders(startedAt);

    // Expire proposals whose validity has run out, so the pipeline stays honest.
    const expired = await prisma.proposal.updateMany({
      where: {
        status: { in: ['SENT', 'VIEWED'] },
        validUntil: { lt: startedAt },
      },
      data: { status: 'EXPIRED' },
    });

    const result = {
      ranAt: startedAt.toISOString(),
      durationMs: Date.now() - startedAt.getTime(),
      recurringTasksCreated: generation.created,
      templatesProcessed: generation.templatesProcessed,
      reminderEmailsSent: reminders.emailsSent,
      remindersProcessed: reminders.remindersProcessed,
      proposalsExpired: expired.count,
    };

    await prisma.auditLog.create({
      data: {
        action: 'cron.run',
        entityType: 'System',
        entityId: 'cron',
        meta: JSON.stringify(result),
      },
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.auditLog.create({
      data: {
        action: 'cron.failed',
        entityType: 'System',
        entityId: 'cron',
        meta: JSON.stringify({ error: message }),
      },
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
