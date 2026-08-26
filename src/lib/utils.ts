import { CURRENCY_SYMBOLS } from './constants';

export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/**
 * Formatting is done by hand rather than through Intl / toLocaleString.
 *
 * Node and the browser ship different ICU data, so `Intl.NumberFormat('en-ZA')`
 * renders "7 500,00" on the server and "7,500.00" in Chromium. React sees the
 * mismatch during hydration, throws away the server HTML and re-renders the
 * whole tree on the client. These helpers produce byte-identical output in both
 * runtimes, so the markup hydrates cleanly.
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_LONG = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

/** South Africa groups with a space and uses a comma decimal: R7 500,00. */
const SPACE_GROUPED = new Set(['ZAR']);

const pad = (n: number) => String(n).padStart(2, '0');

export function formatNumber(value: number, currency = 'ZAR', decimals = 2): string {
  const negative = value < 0;
  const fixed = Math.abs(value ?? 0).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');

  const spaceGrouped = SPACE_GROUPED.has(currency);
  const groupSeparator = spaceGrouped ? '\u00a0' : ',';
  const decimalSeparator = spaceGrouped ? ',' : '.';

  const grouped = whole!.replace(/\B(?=(\d{3})+(?!\d))/g, groupSeparator);
  const body = fraction ? `${grouped}${decimalSeparator}${fraction}` : grouped;

  return negative ? `-${body}` : body;
}

export function formatMoney(amount: number, currency = 'ZAR'): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? '';
  const formatted = formatNumber(amount ?? 0, currency);
  // Keep the minus sign in front of the symbol: -R1 200,00 rather than R-1 200,00.
  return formatted.startsWith('-')
    ? `-${symbol}${formatted.slice(1)}`
    : `${symbol}${formatted}`;
}

function toDateOrNull(date: Date | string | null | undefined): Date | null {
  if (!date) return null;
  const d = typeof date === 'string' ? new Date(date) : date;
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 26 Aug 2026 */
export function formatDate(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** 26 Aug 2026, 14:30 */
export function formatDateTime(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${formatDate(d)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 26 Aug */
export function formatDayMonth(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${pad(d.getDate())} ${MONTHS_SHORT[d.getMonth()]}`;
}

/** Fri, 28 Aug, 10:00 */
export function formatWeekdayDateTime(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Friday, 28 August 2026 at 10:00 */
export function formatLongDateTime(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()} at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Friday, 28 August */
export function formatLongWeekdayDate(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

/** August 2026 */
export function formatMonthYear(date: Date): string {
  return `${MONTHS_LONG[date.getMonth()]} ${date.getFullYear()}`;
}

/** Aug 26 */
export function formatMonthShortYear(date: Date): string {
  return `${MONTHS_SHORT[date.getMonth()]} ${String(date.getFullYear()).slice(-2)}`;
}

/** 14:30 */
export function formatTime(date: Date | string | null | undefined): string {
  const d = toDateOrNull(date);
  if (!d) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "in 3 days", "2 days ago", "today". */
export function relativeDays(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(new Date()).getTime()) / 86400000);
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  if (diff === -1) return 'yesterday';
  if (diff > 0) return `in ${diff} days`;
  return `${Math.abs(diff)} days overdue`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const targetDay = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  // Clamp: 31 Jan + 1 month should land on the last day of February, not 3 March.
  d.setDate(Math.min(targetDay, daysInMonth(d.getFullYear(), d.getMonth())));
  return d;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function isoDate(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isoDateTimeLocal(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Random URL-safe token for public proposal / booking links. */
export function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, bytes * 2);
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function appUrl(path = ''): string {
  const base = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
