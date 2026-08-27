/**
 * Google Calendar integration, minus the network.
 *
 * The parts worth pinning are the ones that decide whether a prospect is
 * offered a slot, and whether a refresh token is readable by anyone with a
 * database dump. The HTTP calls themselves are exercised by connecting a real
 * account; these assertions cover the logic around them.
 */
import assert from 'node:assert/strict';

process.env.AUTH_SECRET ||= 'test-secret-value-that-is-long-enough-000000';

let passed = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log('\ngoogle calendar');

  const { encryptSecret, decryptSecret } = await import('../src/lib/secrets');
  const { overlapsBusy, googleConfigured } = await import('../src/lib/google-calendar');

  const at = (h: number, m = 0) => new Date(2026, 8, 15, h, m, 0, 0);

  // --- Token storage ---
  await check('a stored token round-trips but is not readable as plaintext', () => {
    const token = '1//0abcdefgHIJKLMNOP-refresh-token-value';
    const stored = encryptSecret(token);

    assert.notEqual(stored, token);
    assert.ok(!stored.includes('refresh-token-value'), 'the ciphertext must not contain the token');
    assert.equal(decryptSecret(stored), token);
  });

  await check('every encryption uses a fresh IV', () => {
    // Identical plaintext must not produce identical ciphertext, or equal
    // tokens would be identifiable across rows.
    const a = encryptSecret('same-token');
    const b = encryptSecret('same-token');
    assert.notEqual(a, b);
    assert.equal(decryptSecret(a), decryptSecret(b));
  });

  await check('a tampered value fails closed rather than decrypting to nonsense', () => {
    const stored = encryptSecret('a-real-token');
    const parts = stored.split('.');
    // Flip a byte of the ciphertext; the GCM tag must reject it.
    const corrupted = [parts[0], parts[1], parts[2], `${parts[3]!.slice(0, -2)}AA`].join('.');
    assert.equal(decryptSecret(corrupted), null);
  });

  await check('unreadable or legacy values return null instead of throwing', () => {
    assert.equal(decryptSecret(null), null);
    assert.equal(decryptSecret(undefined), null);
    assert.equal(decryptSecret(''), null);
    assert.equal(decryptSecret('plaintext-from-before-encryption'), null);
    assert.equal(decryptSecret('v1.only.three'), null);
  });

  await check('a rotated AUTH_SECRET invalidates tokens rather than mis-decrypting', () => {
    const stored = encryptSecret('token-under-old-secret');
    const original = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = 'a-completely-different-secret-value-1234567890';
    assert.equal(decryptSecret(stored), null);
    process.env.AUTH_SECRET = original;
    assert.equal(decryptSecret(stored), 'token-under-old-secret');
  });

  // --- Slot availability ---
  await check('a slot inside a busy period is unavailable', () => {
    const busy = [{ start: at(10), end: at(11) }];
    assert.equal(overlapsBusy(at(10), at(10, 30), busy), true);
    assert.equal(overlapsBusy(at(10, 30), at(11), busy), true);
  });

  await check('a slot straddling either edge is unavailable', () => {
    const busy = [{ start: at(10), end: at(11) }];
    assert.equal(overlapsBusy(at(9, 45), at(10, 15), busy), true, 'overlaps the start');
    assert.equal(overlapsBusy(at(10, 45), at(11, 15), busy), true, 'overlaps the end');
  });

  await check('a slot that merely touches a busy period is still offered', () => {
    // Back-to-back meetings are normal; only real overlap should block.
    const busy = [{ start: at(10), end: at(11) }];
    assert.equal(overlapsBusy(at(9, 30), at(10), busy), false, 'ends exactly as busy starts');
    assert.equal(overlapsBusy(at(11), at(11, 30), busy), false, 'starts exactly as busy ends');
  });

  await check('a slot clear of every busy period is offered', () => {
    const busy = [
      { start: at(9), end: at(9, 30) },
      { start: at(13), end: at(14) },
    ];
    assert.equal(overlapsBusy(at(11), at(11, 30), busy), false);
  });

  await check('an all-day busy block hides the whole day', () => {
    const busy = [{ start: new Date(2026, 8, 15, 0, 0), end: new Date(2026, 8, 16, 0, 0) }];
    for (const hour of [9, 11, 14, 16]) {
      assert.equal(overlapsBusy(at(hour), at(hour, 30), busy), true, `${hour}:00 should be blocked`);
    }
  });

  await check('no busy periods means nothing is blocked', () => {
    // This is the path taken when no calendar is connected, so booking must
    // behave exactly as it did before the integration existed.
    assert.equal(overlapsBusy(at(10), at(10, 30), []), false);
  });

  // --- Configuration ---
  await check('the integration reports itself off until both credentials exist', () => {
    const id = process.env.GOOGLE_CLIENT_ID;
    const secret = process.env.GOOGLE_CLIENT_SECRET;

    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    assert.equal(googleConfigured(), false);

    process.env.GOOGLE_CLIENT_ID = 'id-only';
    assert.equal(googleConfigured(), false, 'half-configured is not configured');

    process.env.GOOGLE_CLIENT_SECRET = 'secret';
    assert.equal(googleConfigured(), true);

    if (id) process.env.GOOGLE_CLIENT_ID = id;
    else delete process.env.GOOGLE_CLIENT_ID;
    if (secret) process.env.GOOGLE_CLIENT_SECRET = secret;
    else delete process.env.GOOGLE_CLIENT_SECRET;
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
