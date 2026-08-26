import 'server-only';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from './auth';

/**
 * Wraps a route handler so validation, auth and unexpected failures all come
 * back as JSON with a sensible status instead of an HTML error page.
 */
export function handler<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        return NextResponse.json({ error: 'Sign in to continue' }, { status: 401 });
      }
      if (err instanceof ForbiddenError) {
        return NextResponse.json({ error: err.message }, { status: 403 });
      }
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: 'Some fields need attention', issues: err.flatten().fieldErrors },
          { status: 422 },
        );
      }
      const message = err instanceof Error ? err.message : 'Something went wrong';
      console.error('[api]', err);
      return NextResponse.json({ error: message }, { status: 400 });
    }
  };
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** Parses a date coming from an <input type="date"> or JSON, or null. */
export function toDate(value: unknown): Date | null {
  if (!value || typeof value !== 'string') return null;
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toNumber(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}
