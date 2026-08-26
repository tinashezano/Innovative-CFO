import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { prisma } from './db';

export type SendEmailInput = {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  template?: string;
  relatedType?: string;
  relatedId?: string;
};

let cached: Transporter | null = null;

function transporter(): Transporter | null {
  if (process.env.EMAIL_MODE !== 'smtp') return null;
  if (cached) return cached;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  cached = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return cached;
}

/**
 * Sends an email and always records it in the Email Log.
 *
 * When EMAIL_MODE is not "smtp" nothing leaves the machine — the message is
 * logged with status PREVIEW so the whole workflow is testable offline.
 * Delivery failures are logged and swallowed: an SMTP outage must never roll
 * back a signed proposal or a completed onboarding step.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ delivered: boolean; error?: string }> {
  const transport = transporter();

  if (!transport) {
    await prisma.emailLog.create({
      data: {
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        body: input.html,
        template: input.template,
        status: 'PREVIEW',
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    });
    return { delivered: false };
  }

  try {
    await transport.sendMail({
      from: process.env.EMAIL_FROM || process.env.FIRM_EMAIL,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      html: input.html,
    });
    await prisma.emailLog.create({
      data: {
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        body: input.html,
        template: input.template,
        status: 'SENT',
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    });
    return { delivered: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.emailLog.create({
      data: {
        to: input.to,
        cc: input.cc,
        subject: input.subject,
        body: input.html,
        template: input.template,
        status: 'FAILED',
        error: message,
        relatedType: input.relatedType,
        relatedId: input.relatedId,
      },
    });
    return { delivered: false, error: message };
  }
}
