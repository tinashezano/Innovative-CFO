import 'server-only';
import crypto from 'node:crypto';

/**
 * Encrypts small secrets before they go into the database.
 *
 * A Google refresh token grants ongoing access to someone's calendar, so it
 * should not sit in plaintext in a table that gets backed up, replicated and
 * occasionally opened in a database GUI. AES-256-GCM gives confidentiality plus
 * an authentication tag, so tampering is detected rather than silently decrypted
 * into something else.
 *
 * The key is derived from AUTH_SECRET, which every deployment already has.
 * Rotating AUTH_SECRET therefore invalidates stored tokens — people reconnect
 * their calendar, which is the safe failure.
 */

const PREFIX = 'v1';

function key(): Buffer {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('AUTH_SECRET is required to encrypt stored secrets');
  }
  // A fixed salt is fine here: the input is already a high-entropy secret, and
  // a per-value salt would have to be stored alongside anyway.
  return crypto.scryptSync(secret, 'innovative-cfo-secret-box', 32);
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join(
    '.',
  );
}

/** Returns null rather than throwing, so one unreadable value cannot break a page. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;

  const parts = value.split('.');
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    // Not in our format — most likely written before encryption existed.
    return null;
  }

  try {
    const [, ivPart, tagPart, dataPart] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      key(),
      Buffer.from(ivPart!, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagPart!, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataPart!, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    return null;
  }
}
