/**
 * Formatting must be byte-identical on the server and in the browser.
 *
 * Node and Chromium ship different ICU data, so Intl / toLocaleString render
 * "7 500,00" on one side and "7,500.00" on the other — React then throws away
 * the server HTML and re-renders the whole tree. These assertions pin the exact
 * output so a regression to Intl shows up here rather than as a hydration
 * error in production.
 */
import assert from 'node:assert/strict';
import {
  formatDate,
  formatDateTime,
  formatDayMonth,
  formatLongDateTime,
  formatLongWeekdayDate,
  formatMonthShortYear,
  formatMonthYear,
  formatMoney,
  formatNumber,
  formatTime,
  formatWeekdayDateTime,
  isoDate,
  relativeDays,
  addMonths,
  daysInMonth,
} from '../src/lib/utils';

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

const NBSP = ' ';
const d = (s: string) => new Date(s);

console.log('\nformatting');

check('ZAR groups with a non-breaking space and a comma decimal', () => {
  assert.equal(formatMoney(7500, 'ZAR'), `R7${NBSP}500,00`);
  assert.equal(formatMoney(1234567.5, 'ZAR'), `R1${NBSP}234${NBSP}567,50`);
  assert.equal(formatMoney(0, 'ZAR'), 'R0,00');
  assert.equal(formatMoney(999, 'ZAR'), 'R999,00');
});

check('other currencies group with a comma and a period decimal', () => {
  assert.equal(formatMoney(7500, 'USD'), '$7,500.00');
  assert.equal(formatMoney(1234567.5, 'GBP'), '£1,234,567.50');
  assert.equal(formatMoney(2500, 'EUR'), '€2,500.00');
  assert.equal(formatMoney(2500, 'NGN'), '₦2,500.00');
});

check('negative amounts keep the sign in front of the symbol', () => {
  assert.equal(formatMoney(-1200, 'ZAR'), `-R1${NBSP}200,00`);
  assert.equal(formatMoney(-1200, 'USD'), '-$1,200.00');
});

check('amounts round to two places rather than truncating', () => {
  assert.equal(formatNumber(1.006, 'USD'), '1.01');
  assert.equal(formatNumber(1.004, 'USD'), '1.00');
  assert.equal(formatNumber(2.675, 'USD'), '2.67'); // stored as 2.67499…, so 2.67
  assert.equal(formatNumber(0.1 + 0.2, 'USD'), '0.30');
  assert.equal(formatNumber(1.999, 'USD'), '2.00');
});

check('display rounding never invents money that maths did not produce', () => {
  // Totals are rounded to cents when they are computed (computeProposalTotals),
  // so by the time a value reaches the formatter it is already exact. This is
  // the guarantee that matters: a stored cent value formats back unchanged.
  for (const cents of [1, 99, 100, 12345, 999999]) {
    const amount = cents / 100;
    // Compare on digits alone — grouping separators are a presentation choice.
    assert.equal(formatNumber(amount, 'USD').replace(/,/g, ''), amount.toFixed(2));
  }
});

check('an unknown currency still formats, without a symbol', () => {
  assert.equal(formatMoney(500, 'XYZ'), '500.00');
});

check('dates render in a fixed, unambiguous form', () => {
  assert.equal(formatDate(d('2026-08-26T14:30:00')), '26 Aug 2026');
  assert.equal(formatDate(d('2026-01-05T00:00:00')), '05 Jan 2026');
  assert.equal(formatDateTime(d('2026-08-26T14:30:00')), '26 Aug 2026, 14:30');
  assert.equal(formatDateTime(d('2026-08-26T09:05:00')), '26 Aug 2026, 09:05');
  assert.equal(formatDayMonth(d('2026-08-26T00:00:00')), '26 Aug');
  assert.equal(formatTime(d('2026-08-26T09:05:00')), '09:05');
});

check('weekday forms name the right day', () => {
  // 28 August 2026 is a Friday.
  assert.equal(formatWeekdayDateTime(d('2026-08-28T10:00:00')), 'Fri, 28 Aug, 10:00');
  assert.equal(formatLongWeekdayDate(d('2026-08-28T10:00:00')), 'Friday, 28 August');
  assert.equal(formatLongDateTime(d('2026-08-28T10:00:00')), 'Friday, 28 August 2026 at 10:00');
});

check('month headers render for calendar and timeline', () => {
  assert.equal(formatMonthYear(d('2026-08-01T00:00:00')), 'August 2026');
  assert.equal(formatMonthShortYear(d('2026-08-01T00:00:00')), 'Aug 26');
});

check('empty and invalid values fall back rather than throwing', () => {
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate(undefined), '—');
  assert.equal(formatDate('not a date'), '—');
  assert.equal(formatDateTime(null), '—');
  assert.equal(formatTime(null), '—');
  assert.equal(isoDate(null), '');
});

check('midnight and midday do not collide', () => {
  assert.equal(formatTime(d('2026-08-26T00:00:00')), '00:00');
  assert.equal(formatTime(d('2026-08-26T12:00:00')), '12:00');
  assert.equal(formatTime(d('2026-08-26T23:59:00')), '23:59');
});

check('relative day wording reads naturally', () => {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  assert.equal(relativeDays(today), 'today');
  assert.equal(relativeDays(tomorrow), 'tomorrow');
  assert.equal(relativeDays(yesterday), 'yesterday');
});

check('month arithmetic clamps to the shorter month', () => {
  assert.equal(isoDate(addMonths(d('2026-01-31T00:00:00'), 1)), '2026-02-28');
  assert.equal(isoDate(addMonths(d('2024-01-31T00:00:00'), 1)), '2024-02-29');
  assert.equal(isoDate(addMonths(d('2026-03-31T00:00:00'), -1)), '2026-02-28');
  assert.equal(daysInMonth(2026, 1), 28);
  assert.equal(daysInMonth(2024, 1), 29);
});

console.log(`\n${passed} checks passed`);
