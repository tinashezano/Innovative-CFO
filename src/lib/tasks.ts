import 'server-only';
import { prisma } from './db';
import { nextReference } from './db';
import { addDays, parseJson, startOfDay } from './utils';
import { nextOccurrence, periodKeyFor } from './recurrence';
import type { RecurrenceFrequency } from './constants';
import { getSettings } from './settings';

export type CreateTaskInput = {
  title: string;
  description?: string | null;
  clientId?: string | null;
  parentId?: string | null;
  status?: string;
  priority?: string;
  category?: string;
  assigneeId?: string | null;
  createdById?: string | null;
  startDate?: Date | null;
  dueDate?: Date | null;
  estimateHours?: number | null;
  labels?: string | null;
  source?: string;
  templateId?: string | null;
  periodKey?: string | null;
  leadId?: string | null;
  proposalId?: string | null;
  onboardingId?: string | null;
  bookingId?: string | null;
  subtaskTitles?: string[];
};

/**
 * Creates a task (plus any subtasks) and schedules its reminder rows.
 * A subtask inherits its parent's client so the client grouping stays intact.
 */
export async function createTask(input: CreateTaskInput) {
  const reference = await nextReference('task', 'TK');

  let clientId = input.clientId ?? null;
  if (input.parentId && !clientId) {
    const parent = await prisma.task.findUnique({
      where: { id: input.parentId },
      select: { clientId: true },
    });
    clientId = parent?.clientId ?? null;
  }

  // Place new tasks at the bottom of their column.
  const last = await prisma.task.findFirst({
    where: { clientId, status: input.status ?? 'TODO', parentId: input.parentId ?? null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const task = await prisma.task.create({
    data: {
      reference,
      title: input.title,
      description: input.description ?? null,
      clientId,
      parentId: input.parentId ?? null,
      status: input.status ?? 'TODO',
      priority: input.priority ?? 'MEDIUM',
      category: input.category ?? 'OTHER',
      assigneeId: input.assigneeId ?? null,
      createdById: input.createdById ?? null,
      startDate: input.startDate ?? null,
      dueDate: input.dueDate ?? null,
      estimateHours: input.estimateHours ?? null,
      labels: input.labels ?? null,
      position: (last?.position ?? 0) + 1000,
      source: input.source ?? 'MANUAL',
      templateId: input.templateId ?? null,
      periodKey: input.periodKey ?? null,
      leadId: input.leadId ?? null,
      proposalId: input.proposalId ?? null,
      onboardingId: input.onboardingId ?? null,
      bookingId: input.bookingId ?? null,
    },
  });

  for (const [index, title] of (input.subtaskTitles ?? []).entries()) {
    const subReference = await nextReference('task', 'TK');
    await prisma.task.create({
      data: {
        reference: subReference,
        title,
        clientId,
        parentId: task.id,
        status: 'TODO',
        priority: task.priority,
        category: task.category,
        assigneeId: task.assigneeId,
        createdById: input.createdById ?? null,
        dueDate: task.dueDate,
        position: (index + 1) * 1000,
        source: task.source,
      },
    });
  }

  await scheduleReminders(task.id);
  return task;
}

/**
 * (Re)builds the reminder schedule for a task. Reminders already sent are left
 * alone; unsent ones are recalculated so moving a due date moves the chase-ups
 * with it. Reminders whose moment has already passed are marked SKIPPED rather
 * than fired late.
 */
export async function scheduleReminders(taskId: string): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, dueDate: true, status: true, assigneeId: true },
  });
  if (!task) return;

  await prisma.taskReminder.deleteMany({ where: { taskId, sentAt: null } });

  if (!task.dueDate || task.status === 'DONE' || !task.assigneeId) return;

  const settings = await getSettings();
  const due = startOfDay(task.dueDate);
  const today = startOfDay(new Date());

  const rows = settings.reminderOffsetDays.map((offset) => ({
    taskId,
    kind: offset === 0 ? 'DUE_TODAY' : 'BEFORE_DUE',
    offsetDays: offset,
    scheduledFor: addDays(due, -offset),
    status: addDays(due, -offset) < today ? 'SKIPPED' : 'SCHEDULED',
  }));

  if (settings.overdueRemindersEnabled) {
    rows.push({
      taskId,
      kind: 'OVERDUE',
      offsetDays: 1,
      scheduledFor: addDays(due, 1),
      status: 'SCHEDULED',
    });
  }

  for (const row of rows) {
    await prisma.taskReminder.upsert({
      where: { taskId_kind_offsetDays: { taskId, kind: row.kind, offsetDays: row.offsetDays } },
      create: row,
      update: { scheduledFor: row.scheduledFor, status: row.status, sentAt: null },
    });
  }
}

/**
 * Generates the tasks that fall due within the template's lead time, then
 * advances `nextDueAt`. Idempotent: the unique (templateId, periodKey) index
 * means a re-run creates nothing new.
 */
export async function generateRecurringTasks(now = new Date()): Promise<{
  created: number;
  templatesProcessed: number;
}> {
  const templates = await prisma.recurringTaskTemplate.findMany({
    where: { active: true },
    include: { client: { select: { id: true, name: true, status: true } } },
  });

  let created = 0;

  for (const template of templates) {
    // Skip templates whose client has left or been paused.
    if (template.client && ['OFFBOARDED', 'ON_HOLD'].includes(template.client.status)) continue;

    const rule = {
      frequency: template.frequency as RecurrenceFrequency,
      interval: template.interval,
      dayOfWeek: template.dayOfWeek,
      dayOfMonth: template.dayOfMonth,
      monthOfYear: template.monthOfYear,
      startDate: template.startDate,
      endDate: template.endDate,
    };

    let cursor = template.nextDueAt ?? template.startDate;
    const horizon = addDays(startOfDay(now), template.leadTimeDays);
    let guard = 0;

    while (guard < 24) {
      guard += 1;
      const due = nextOccurrence(rule, cursor);
      if (!due) break;
      if (due > horizon) {
        await prisma.recurringTaskTemplate.update({
          where: { id: template.id },
          data: { nextDueAt: due },
        });
        break;
      }

      const periodKey = periodKeyFor(rule.frequency, due);
      const existing = await prisma.task.findFirst({
        where: { templateId: template.id, periodKey },
        select: { id: true },
      });

      if (!existing) {
        await createTask({
          title: template.name,
          description: template.description,
          clientId: template.clientId,
          priority: template.priority,
          category: template.category,
          assigneeId: template.assigneeId,
          startDate: addDays(due, -template.leadTimeDays),
          dueDate: due,
          estimateHours: template.estimateHours,
          source: 'RECURRING',
          templateId: template.id,
          periodKey,
          subtaskTitles: parseJson<string[]>(template.subtaskTitles, []),
        });
        created += 1;
      }

      cursor = addDays(due, 1);
    }

    await prisma.recurringTaskTemplate.update({
      where: { id: template.id },
      data: { lastRunAt: now },
    });
  }

  return { created, templatesProcessed: templates.length };
}

/** Reflows kanban ordering when a task is dropped into a column. */
export async function repositionTask(
  taskId: string,
  status: string,
  beforeTaskId: string | null,
): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id: taskId }, select: { clientId: true } });
  if (!task) return;

  const siblings = await prisma.task.findMany({
    where: { status, parentId: null, id: { not: taskId } },
    orderBy: { position: 'asc' },
    select: { id: true, position: true },
  });

  let position: number;
  if (!beforeTaskId) {
    position = (siblings.at(-1)?.position ?? 0) + 1000;
  } else {
    const index = siblings.findIndex((s) => s.id === beforeTaskId);
    if (index === -1) {
      position = (siblings.at(-1)?.position ?? 0) + 1000;
    } else {
      const prev = index === 0 ? 0 : siblings[index - 1]!.position;
      position = (prev + siblings[index]!.position) / 2;
    }
  }

  await prisma.task.update({ where: { id: taskId }, data: { status, position } });
}
