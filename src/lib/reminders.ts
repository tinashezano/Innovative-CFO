import 'server-only';
import { prisma } from './db';
import { sendEmail } from './email';
import { layout, taskReminderEmail } from './email-templates';
import { getSettings } from './settings';
import { appUrl, endOfDay } from './utils';
import { notify } from './notify';

/**
 * Sends the due-date reminder emails.
 *
 * Reminders are grouped per assignee and per kind so someone with eight tasks
 * due tomorrow gets one email listing all eight, not eight emails. Rows are
 * marked SENT inside the same pass, so a re-run the same day sends nothing.
 */
export async function sendDueReminders(now = new Date()): Promise<{
  emailsSent: number;
  remindersProcessed: number;
}> {
  const settings = await getSettings();

  const due = await prisma.taskReminder.findMany({
    where: { status: 'SCHEDULED', sentAt: null, scheduledFor: { lte: endOfDay(now) } },
    include: {
      task: {
        include: {
          client: { select: { name: true } },
          assignee: { select: { id: true, name: true, email: true, active: true } },
          subtasks: { select: { status: true } },
        },
      },
    },
    orderBy: { scheduledFor: 'asc' },
  });

  const skip: string[] = [];
  // assigneeId -> kind -> reminders
  const grouped = new Map<string, Map<string, typeof due>>();

  for (const reminder of due) {
    const task = reminder.task;

    // Nothing to chase for finished, archived or unassigned work.
    if (!task || task.status === 'DONE' || task.archivedAt || !task.assignee?.active || !task.dueDate) {
      skip.push(reminder.id);
      continue;
    }
    // An overdue reminder only fires if the task really is overdue.
    if (reminder.kind === 'OVERDUE' && task.dueDate >= endOfDay(now)) continue;

    const byKind = grouped.get(task.assignee.id) ?? new Map();
    byKind.set(reminder.kind, [...(byKind.get(reminder.kind) ?? []), reminder]);
    grouped.set(task.assignee.id, byKind);
  }

  if (skip.length) {
    await prisma.taskReminder.updateMany({
      where: { id: { in: skip } },
      data: { status: 'SKIPPED' },
    });
  }

  let emailsSent = 0;
  let remindersProcessed = skip.length;

  for (const [assigneeId, byKind] of grouped) {
    for (const [kind, reminders] of byKind) {
      const assignee = reminders[0]!.task.assignee!;

      const tasks = reminders.map((r) => {
        const done = r.task.subtasks.filter((s) => s.status === 'DONE').length;
        return {
          reference: r.task.reference,
          title: r.task.title,
          clientName: r.task.client?.name ?? null,
          dueDate: r.task.dueDate,
          priority: r.task.priority,
          url: appUrl(`/tasks/${r.task.id}`),
          subtaskSummary: r.task.subtasks.length ? `${done}/${r.task.subtasks.length} subtasks done` : undefined,
        };
      });

      const { subject, html } = taskReminderEmail({
        assigneeName: assignee.name,
        tasks,
        kind: kind as 'BEFORE_DUE' | 'DUE_TODAY' | 'OVERDUE',
        boardUrl: appUrl('/tasks?view=board'),
      });

      const result = await sendEmail({
        to: assignee.email,
        subject,
        html: layout({
          firmName: settings.firmName,
          firmEmail: settings.firmEmail,
          firmPhone: settings.firmPhone,
          preheader: subject,
          body: html,
        }),
        template: `task-reminder-${kind.toLowerCase()}`,
        relatedType: 'User',
        relatedId: assigneeId,
      });

      await prisma.taskReminder.updateMany({
        where: { id: { in: reminders.map((r) => r.id) } },
        data: {
          status: result.error ? 'FAILED' : 'SENT',
          sentAt: new Date(),
          error: result.error ?? null,
        },
      });

      await notify({
        userId: assigneeId,
        title: subject,
        body: tasks.map((t) => t.title).join(', ').slice(0, 200),
        link: '/tasks?view=list&assignee=me',
        kind: kind === 'OVERDUE' ? 'WARNING' : 'INFO',
      });

      emailsSent += 1;
      remindersProcessed += reminders.length;
    }
  }

  // Overdue chase-ups repeat daily until the task is finished: re-arm the row
  // for tomorrow rather than leaving it spent.
  if (settings.overdueRemindersEnabled) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const sentOverdue = await prisma.taskReminder.findMany({
      where: { kind: 'OVERDUE', status: 'SENT', task: { status: { not: 'DONE' }, archivedAt: null } },
      select: { id: true },
    });
    if (sentOverdue.length) {
      await prisma.taskReminder.updateMany({
        where: { id: { in: sentOverdue.map((r) => r.id) } },
        data: { status: 'SCHEDULED', sentAt: null, scheduledFor: tomorrow },
      });
    }
  }

  return { emailsSent, remindersProcessed };
}
