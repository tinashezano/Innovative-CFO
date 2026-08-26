import { z } from 'zod';
import { requireRole } from '@/lib/auth';
import { handler, ok } from '@/lib/api';
import { saveSettings } from '@/lib/settings';
import { audit } from '@/lib/notify';

const schema = z.object({
  firmName: z.string().min(1).optional(),
  firmEmail: z.string().email().optional(),
  firmPhone: z.string().optional(),
  firmAddress: z.string().optional(),
  defaultCurrency: z.string().min(3).max(3).optional(),
  reminderOffsetDays: z.array(z.coerce.number().int().min(0).max(90)).optional(),
  overdueRemindersEnabled: z.boolean().optional(),
  discoveryDays: z.array(z.coerce.number().int().min(0).max(6)).optional(),
  discoveryStartHour: z.coerce.number().int().min(0).max(23).optional(),
  discoveryEndHour: z.coerce.number().int().min(1).max(24).optional(),
  discoveryDurationMins: z.coerce.number().int().min(5).max(240).optional(),
  discoverySlotMinutes: z.coerce.number().int().min(5).max(240).optional(),
  proposalValidityDays: z.coerce.number().int().min(1).max(365).optional(),
  welcomePackHtml: z.string().optional(),
  engagementTermsHtml: z.string().optional(),
});

/** Firm-wide settings are a manager-and-above concern. */
export const PATCH = handler(async (request: Request) => {
  const user = await requireRole('MANAGER');
  const input = schema.parse(await request.json());

  if (
    input.discoveryStartHour !== undefined &&
    input.discoveryEndHour !== undefined &&
    input.discoveryEndHour <= input.discoveryStartHour
  ) {
    throw new Error('Booking hours must end after they start');
  }

  const settings = await saveSettings({
    ...input,
    // Longest lead time first keeps the reminder list readable.
    ...(input.reminderOffsetDays
      ? {
          reminderOffsetDays: Array.from(new Set(input.reminderOffsetDays)).sort((a, b) => b - a),
        }
      : {}),
  });

  await audit({ userId: user.id, action: 'settings.updated', entityType: 'Setting', entityId: 'firm' });

  return ok({ settings });
});
