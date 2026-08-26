/**
 * Checks on the parts an attacker would reach first: webhook signature
 * verification and the mode guards on the demo sign/pay endpoints.
 */
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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

async function main() {
  console.log('\nsecurity');

  // --- Paystack signature verification ---
  process.env.PAYSTACK_SECRET_KEY = 'sk_test_signature_check';
  process.env.PAYSTACK_MODE = 'live';

  // Import after the env is set — the module reads it at call time, but this
  // keeps the intent obvious.
  const { verifyWebhookSignature, toMinorUnits, fromMinorUnits, mapPaymentStatus } = await import(
    '../src/lib/paystack'
  );

  const body = JSON.stringify({ event: 'charge.success', data: { reference: 'ABC', amount: 500000 } });
  const valid = crypto
    .createHmac('sha512', 'sk_test_signature_check')
    .update(body, 'utf8')
    .digest('hex');

  check('a correctly signed payload is accepted', () => {
    assert.equal(verifyWebhookSignature(body, valid), true);
  });

  check('a wrong signature is rejected', () => {
    assert.equal(verifyWebhookSignature(body, 'f'.repeat(128)), false);
  });

  check('a missing signature is rejected', () => {
    assert.equal(verifyWebhookSignature(body, null), false);
  });

  check('a tampered body invalidates the signature', () => {
    const tampered = body.replace('500000', '1');
    assert.equal(verifyWebhookSignature(tampered, valid), false);
  });

  check('a short signature cannot crash the length-safe compare', () => {
    assert.equal(verifyWebhookSignature(body, 'abc'), false);
  });

  // --- Amount conversion ---
  check('amounts convert to and from minor units without drift', () => {
    assert.equal(toMinorUnits(4500), 450000);
    assert.equal(toMinorUnits(11653.45), 1165345);
    assert.equal(fromMinorUnits(1165345), 11653.45);
    // 0.1 + 0.2 style float error must not survive the round trip.
    assert.equal(toMinorUnits(0.1 + 0.2), 30);
  });

  check('Paystack statuses map onto ours', () => {
    assert.equal(mapPaymentStatus('success'), 'SUCCESS');
    assert.equal(mapPaymentStatus('failed'), 'FAILED');
    assert.equal(mapPaymentStatus('abandoned'), 'ABANDONED');
    assert.equal(mapPaymentStatus('anything-else'), 'PENDING');
  });

  // --- Mode guards ---
  const { paystackMode } = await import('../src/lib/paystack');
  check('Paystack reports live once a secret key is present', () => {
    assert.equal(paystackMode(), 'live');
  });

  check('Paystack falls back to mock without a secret key', async () => {
    const previous = process.env.PAYSTACK_SECRET_KEY;
    delete process.env.PAYSTACK_SECRET_KEY;
    assert.equal(paystackMode(), 'mock');
    process.env.PAYSTACK_SECRET_KEY = previous;
  });

  const { docusignMode, docusignConfigured } = await import('../src/lib/docusign');
  check('DocuSign stays in mock mode until it is told otherwise', () => {
    process.env.DOCUSIGN_MODE = 'mock';
    assert.equal(docusignMode(), 'mock');
    process.env.DOCUSIGN_MODE = 'live';
    assert.equal(docusignMode(), 'live');
    // Live mode without credentials must not be treated as configured — the
    // adapter falls back to mock rather than throwing mid-signature.
    assert.equal(docusignConfigured(), false);
    process.env.DOCUSIGN_MODE = 'mock';
  });

  // --- Escaping ---
  const { escapeHtml } = await import('../src/lib/utils');
  check('user-supplied text is escaped before it reaches an email', () => {
    assert.equal(
      escapeHtml('<script>alert("x")</script>'),
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    );
    assert.equal(escapeHtml("O'Brien & Sons"), 'O&#39;Brien &amp; Sons');
  });

  const { render } = await import('../src/lib/email-templates');
  check('template placeholders escape values but allow explicit Html keys', () => {
    assert.equal(render('Hi {{name}}', { name: '<b>x</b>' }), 'Hi &lt;b&gt;x&lt;/b&gt;');
    assert.equal(render('{{bodyHtml}}', { bodyHtml: '<b>x</b>' }), '<b>x</b>');
    assert.equal(render('Hi {{missing}}!', {}), 'Hi !');
  });

  // --- Database URL resolution ---
  const { resolveDatabaseUrl, providerForUrl } = await import('../src/lib/database-url');

  check('an explicit DATABASE_URL beats anything a host injected', () => {
    const r = resolveDatabaseUrl({ DATABASE_URL: 'postgresql://mine', POSTGRES_URL: 'postgresql://theirs' } as unknown as NodeJS.ProcessEnv);
    assert.equal(r.source, 'DATABASE_URL');
    assert.equal(r.url, 'postgresql://mine');
  });

  check('a Vercel Postgres store is picked up without DATABASE_URL', () => {
    // The pooled URL is preferred, which is what a serverless deployment needs.
    const r = resolveDatabaseUrl({
      POSTGRES_PRISMA_URL: 'postgresql://pooled',
      POSTGRES_URL: 'postgresql://direct',
      POSTGRES_URL_NON_POOLING: 'postgresql://nonpooled',
    } as unknown as NodeJS.ProcessEnv);
    assert.equal(r.source, 'POSTGRES_PRISMA_URL');
  });

  check('a blank value is treated as unset', () => {
    const r = resolveDatabaseUrl({ DATABASE_URL: '   ', POSTGRES_URL: 'postgresql://x' } as unknown as NodeJS.ProcessEnv);
    assert.equal(r.source, 'POSTGRES_URL');
    assert.equal(resolveDatabaseUrl({} as unknown as NodeJS.ProcessEnv).source, null);
  });

  check('the provider is derived from the URL scheme', () => {
    assert.equal(providerForUrl('file:./dev.db'), 'sqlite');
    assert.equal(providerForUrl('postgresql://h/db'), 'postgresql');
    assert.equal(providerForUrl('postgres://h/db'), 'postgresql');
    assert.equal(providerForUrl('prisma+postgres://h/db'), 'postgresql');
    assert.equal(providerForUrl('mysql://h/db'), null);
    assert.equal(providerForUrl(null), null);
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
