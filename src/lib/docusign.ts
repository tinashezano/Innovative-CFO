import 'server-only';
import { SignJWT, importPKCS8 } from 'jose';
import { appUrl } from './utils';

/**
 * DocuSign adapter for embedded engagement-letter signing.
 *
 * Two modes, chosen with DOCUSIGN_MODE:
 *
 *  - "mock" (default): no credentials needed. The engagement letter is rendered
 *    by the app itself at /sign/<envelopeId>, which the proposal page embeds in
 *    an iframe exactly as it would embed DocuSign. Signing posts back to the
 *    same webhook handler that DocuSign Connect calls, so the downstream
 *    automation is identical in both modes.
 *
 *  - "live": JWT-grant OAuth, envelope creation from the rendered HTML, then a
 *    recipient view URL for embedded signing inside the app.
 *
 * Live mode requires a one-time consent grant for the integration key:
 *   https://account-d.docusign.com/oauth/auth?response_type=code
 *     &scope=signature%20impersonation&client_id=<KEY>&redirect_uri=<URI>
 */

export type CreateEnvelopeInput = {
  envelopeId: string; // our internal Envelope row id — used as the return path
  subject: string;
  documentHtml: string;
  documentName: string;
  recipientName: string;
  recipientEmail: string;
  /** Stable id we hand DocuSign so the returning webhook maps back to us. */
  clientUserId: string;
};

export type CreateEnvelopeResult = {
  provider: 'DOCUSIGN';
  externalId: string;
  signingUrl: string;
  mode: 'mock' | 'live';
};

export function docusignMode(): 'mock' | 'live' {
  return process.env.DOCUSIGN_MODE === 'live' ? 'live' : 'mock';
}

export function docusignConfigured(): boolean {
  return Boolean(
    process.env.DOCUSIGN_INTEGRATION_KEY &&
      process.env.DOCUSIGN_USER_ID &&
      process.env.DOCUSIGN_ACCOUNT_ID &&
      process.env.DOCUSIGN_PRIVATE_KEY,
  );
}

/** Exchanges the JWT assertion for an access token (live mode only). */
async function accessToken(): Promise<string> {
  const oauthBase = process.env.DOCUSIGN_OAUTH_BASE || 'https://account-d.docusign.com';
  const integrationKey = process.env.DOCUSIGN_INTEGRATION_KEY!;
  const userId = process.env.DOCUSIGN_USER_ID!;
  const privateKeyPem = (process.env.DOCUSIGN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  const key = await importPKCS8(privateKeyPem, 'RS256');
  const assertion = await new SignJWT({ scope: 'signature impersonation' })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuer(integrationKey)
    .setSubject(userId)
    .setAudience(oauthBase.replace(/^https?:\/\//, ''))
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);

  const res = await fetch(`${oauthBase}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(
      `DocuSign token request failed (${res.status}). ${text}. ` +
        'If this says consent_required, grant consent for the integration key once via the OAuth consent URL.',
    );
  }

  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export async function createEnvelope(input: CreateEnvelopeInput): Promise<CreateEnvelopeResult> {
  if (docusignMode() === 'mock' || !docusignConfigured()) {
    return {
      provider: 'DOCUSIGN',
      externalId: `mock-${input.envelopeId}`,
      signingUrl: appUrl(`/sign/${input.envelopeId}`),
      mode: 'mock',
    };
  }

  const token = await accessToken();
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;

  const createRes = await fetch(`${basePath}/v2.1/accounts/${accountId}/envelopes`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      emailSubject: input.subject,
      status: 'sent',
      // Our own envelope id travels with the DocuSign envelope so the Connect
      // webhook can be matched back without an extra lookup table.
      envelopeIdStamping: 'true',
      customFields: {
        textCustomFields: [{ name: 'icfoEnvelopeId', value: input.envelopeId, show: 'false' }],
      },
      documents: [
        {
          documentBase64: Buffer.from(input.documentHtml, 'utf8').toString('base64'),
          name: input.documentName,
          fileExtension: 'html',
          documentId: '1',
        },
      ],
      recipients: {
        signers: [
          {
            email: input.recipientEmail,
            name: input.recipientName,
            recipientId: '1',
            routingOrder: '1',
            clientUserId: input.clientUserId, // presence of this makes it embedded
            tabs: {
              signHereTabs: [
                { anchorString: '/sig1/', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' },
              ],
              dateSignedTabs: [
                { anchorString: '/date1/', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' },
              ],
              fullNameTabs: [
                { anchorString: '/name1/', anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' },
              ],
            },
          },
        ],
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(`DocuSign envelope creation failed (${createRes.status}): ${await createRes.text()}`);
  }

  const envelope = (await createRes.json()) as { envelopeId: string };

  const viewRes = await fetch(
    `${basePath}/v2.1/accounts/${accountId}/envelopes/${envelope.envelopeId}/views/recipient`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnUrl: appUrl(`/api/docusign/return?envelope=${input.envelopeId}`),
        authenticationMethod: 'none',
        email: input.recipientEmail,
        userName: input.recipientName,
        clientUserId: input.clientUserId,
      }),
    },
  );

  if (!viewRes.ok) {
    throw new Error(`DocuSign recipient view failed (${viewRes.status}): ${await viewRes.text()}`);
  }

  const view = (await viewRes.json()) as { url: string };

  return {
    provider: 'DOCUSIGN',
    externalId: envelope.envelopeId,
    signingUrl: view.url,
    mode: 'live',
  };
}

/** Downloads the signed PDF. Returns null in mock mode. */
export async function downloadSignedDocument(externalId: string): Promise<Buffer | null> {
  if (docusignMode() === 'mock' || !docusignConfigured()) return null;

  const token = await accessToken();
  const basePath = process.env.DOCUSIGN_BASE_PATH || 'https://demo.docusign.net/restapi';
  const accountId = process.env.DOCUSIGN_ACCOUNT_ID!;

  const res = await fetch(
    `${basePath}/v2.1/accounts/${accountId}/envelopes/${externalId}/documents/combined`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Maps a DocuSign Connect envelope status onto our Envelope.status. */
export function mapEnvelopeStatus(status: string): string {
  switch (status.toLowerCase()) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'completed':
      return 'COMPLETED';
    case 'declined':
      return 'DECLINED';
    case 'voided':
      return 'VOIDED';
    default:
      return 'CREATED';
  }
}
