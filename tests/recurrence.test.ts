/**
 * Plain-node assertions for the recurrence engine — the piece most likely to
 * silently generate the wrong dates. Run with: npm run test
 */
import assert from 'node:assert/strict';
import { nextOccurrence, periodKeyFor } from '../src/lib/recurrence';
import { isoDate } from '../src/lib/utils';

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

const d = (s: string) => new Date(`${s}T00:00:00`);

console.log('recurrence');

check('monthly rule lands on the requested day of month', () => {
  const next = nextOccurrence(
    { frequency: 'MONTHLY', interval: 1, dayOfMonth: 7, startDate: d('2026-01-01') },
    d('2026-03-10'),
  );
  assert.equal(isoDate(next), '2026-04-07');
});

check('monthly rule returns the same day when asked on that day', () => {
  const next = nextOccurrence(
    { frequency: 'MONTHLY', interval: 1, dayOfMonth: 7, startDate: d('2026-01-01') },
    d('2026-03-07'),
  );
  assert.equal(isoDate(next), '2026-03-07');
});

check('day 31 clamps to the last day of February', () => {
  const next = nextOccurrence(
    { frequency: 'MONTHLY', interval: 1, dayOfMonth: 31, startDate: d('2026-01-01') },
    d('2026-02-01'),
  );
  assert.equal(isoDate(next), '2026-02-28');
});

check('leap year gives 29 February', () => {
  const next = nextOccurrence(
    { frequency: 'MONTHLY', interval: 1, dayOfMonth: 31, startDate: d('2024-01-01') },
    d('2024-02-01'),
  );
  assert.equal(isoDate(next), '2024-02-29');
});

check('quarterly anchors on monthOfYear', () => {
  // VAT quarters ending Feb/May/Aug/Nov, filed on the 25th.
  const rule = {
    frequency: 'QUARTERLY' as const,
    interval: 1,
    dayOfMonth: 25,
    monthOfYear: 2,
    startDate: d('2026-01-01'),
  };
  assert.equal(isoDate(nextOccurrence(rule, d('2026-01-01'))), '2026-02-25');
  assert.equal(isoDate(nextOccurrence(rule, d('2026-03-01'))), '2026-05-25');
  assert.equal(isoDate(nextOccurrence(rule, d('2026-09-01'))), '2026-11-25');
  assert.equal(isoDate(nextOccurrence(rule, d('2026-12-01'))), '2027-02-25');
});

check('weekly rule lands on the requested weekday', () => {
  // 2026-08-26 is a Wednesday; next Friday (5) is 2026-08-28.
  const next = nextOccurrence(
    { frequency: 'WEEKLY', interval: 1, dayOfWeek: 5, startDate: d('2026-08-01') },
    d('2026-08-26'),
  );
  assert.equal(isoDate(next), '2026-08-28');
  assert.equal(next!.getDay(), 5);
});

check('biweekly rule steps 14 days', () => {
  const rule = { frequency: 'BIWEEKLY' as const, interval: 1, dayOfWeek: 1, startDate: d('2026-08-03') };
  const first = nextOccurrence(rule, d('2026-08-03'))!;
  assert.equal(isoDate(first), '2026-08-03');
  const second = nextOccurrence(rule, d('2026-08-04'))!;
  assert.equal(isoDate(second), '2026-08-17');
});

check('daily rule respects the interval', () => {
  const rule = { frequency: 'DAILY' as const, interval: 3, startDate: d('2026-08-01') };
  assert.equal(isoDate(nextOccurrence(rule, d('2026-08-02'))), '2026-08-04');
  assert.equal(isoDate(nextOccurrence(rule, d('2026-08-04'))), '2026-08-04');
});

check('annual rule uses monthOfYear and dayOfMonth', () => {
  const rule = {
    frequency: 'ANNUAL' as const,
    interval: 1,
    dayOfMonth: 30,
    monthOfYear: 9,
    startDate: d('2026-01-01'),
  };
  assert.equal(isoDate(nextOccurrence(rule, d('2026-01-01'))), '2026-09-30');
  assert.equal(isoDate(nextOccurrence(rule, d('2026-10-01'))), '2027-09-30');
});

check('rule stops after its end date', () => {
  const next = nextOccurrence(
    {
      frequency: 'MONTHLY',
      interval: 1,
      dayOfMonth: 5,
      startDate: d('2026-01-01'),
      endDate: d('2026-03-31'),
    },
    d('2026-04-01'),
  );
  assert.equal(next, null);
});

check('never returns a date before the start date', () => {
  const next = nextOccurrence(
    { frequency: 'MONTHLY', interval: 1, dayOfMonth: 15, startDate: d('2026-06-01') },
    d('2026-01-01'),
  );
  assert.equal(isoDate(next), '2026-06-15');
});

check('period keys are distinct per period and stable within one', () => {
  assert.equal(periodKeyFor('MONTHLY', d('2026-03-05')), '2026-03');
  assert.equal(periodKeyFor('MONTHLY', d('2026-03-28')), '2026-03');
  assert.notEqual(periodKeyFor('MONTHLY', d('2026-04-01')), periodKeyFor('MONTHLY', d('2026-03-28')));
  assert.equal(periodKeyFor('QUARTERLY', d('2026-05-25')), '2026-Q2');
  assert.equal(periodKeyFor('SEMIANNUAL', d('2026-08-01')), '2026-H2');
  assert.equal(periodKeyFor('ANNUAL', d('2026-09-30')), '2026');
});

console.log(`\n${passed} assertions passed`);
