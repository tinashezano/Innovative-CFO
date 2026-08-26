import 'server-only';
import crypto from 'node:crypto';
import { appUrl } from './utils';

/**
 * Paystack adapter for the payment step of the proposal page.
 *
 * PAYSTACK_MODE=mock (default) issues a local checkout page at /pay/<reference>
 * so the sign-then-pay flow can be exercised end to end without keys. In live
 * mode we initialise a real transaction and hand back Paystack's hosted
 * authorization URL.
 *
 * Amounts are sent in the currency's smallest unit (cents / kobo), which is
 * what Paystack expects.
 */

const API = 'https://api.paystack.co';

export type InitializeInput = {
  email: string;
  amount: number; // major units, e.g. 4500.00
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
};

export type InitializeResult = {
  authorizationUrl: string;
  accessCode: string | null;
  reference: string;
  mode: 'mock' | 'live';
};

export function paystackMode(): 'mock' | 'live' {
  return process.env.PAYSTACK_MODE === 'live' && process.env.PAYSTACK_SECRET_KEY ? 'live' : 'mock';
}

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

export function toMinorUnits(amount: number): number {
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number): number {
  return amount / 100;
}

export async function initializeTransaction(input: InitializeInput): Promise<InitializeResult> {
  if (paystackMode() === 'mock') {
    return {
      authorizationUrl: appUrl(`/pay/${input.reference}`),
      accessCode: null,
      reference: input.reference,
      mode: 'mock',
    };
  }

  const res = await fetch(`${API}/transaction/initialize`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: input.email,
      amount: toMinorUnits(input.amount),
      currency: input.currency,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: { authorization_url: string; access_code: string; reference: string };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(`Paystack initialize failed: ${json.message || res.statusText}`);
  }

  return {
    authorizationUrl: json.data.authorization_url,
    accessCode: json.data.access_code,
    reference: json.data.reference,
    mode: 'live',
  };
}

export type VerifyResult = {
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'ABANDONED';
  amount: number; // major units
  currency: string;
  channel: string | null;
  paidAt: Date | null;
  raw: unknown;
};

export async function verifyTransaction(reference: string): Promise<VerifyResult> {
  if (paystackMode() === 'mock') {
    // The mock checkout page records the outcome itself; nothing to verify.
    return { status: 'PENDING', amount: 0, currency: '', channel: 'mock', paidAt: null, raw: null };
  }

  const res = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
  });

  const json = (await res.json()) as {
    status: boolean;
    message: string;
    data?: {
      status: string;
      amount: number;
      currency: string;
      channel: string;
      paid_at: string | null;
    };
  };

  if (!res.ok || !json.status || !json.data) {
    throw new Error(`Paystack verify failed: ${json.message || res.statusText}`);
  }

  return {
    status: mapPaymentStatus(json.data.status),
    amount: fromMinorUnits(json.data.amount),
    currency: json.data.currency,
    channel: json.data.channel ?? null,
    paidAt: json.data.paid_at ? new Date(json.data.paid_at) : null,
    raw: json.data,
  };
}

export function mapPaymentStatus(status: string): 'SUCCESS' | 'PENDING' | 'FAILED' | 'ABANDONED' {
  switch (status.toLowerCase()) {
    case 'success':
      return 'SUCCESS';
    case 'failed':
      return 'FAILED';
    case 'abandoned':
      return 'ABANDONED';
    default:
      return 'PENDING';
  }
}

/**
 * Paystack signs webhooks with HMAC-SHA512 of the raw request body, keyed on
 * the secret key. Always verify against the raw text, never a re-serialised
 * object — key order would differ and the digest would not match.
 */
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return paystackMode() === 'mock';
  if (!signature) return false;

  const expected = crypto.createHmac('sha512', secret).update(rawBody, 'utf8').digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function buildReference(proposalNumber: string): string {
  const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${proposalNumber.replace(/[^A-Za-z0-9]/g, '')}-${suffix}`;
}
