/**
 * _shared/webhookSecurity.ts
 * Pure HMAC-SHA256 helpers for Paddle webhook signature verification.
 * Extracted here so they can be unit-tested without a running Deno server.
 */

export function parseSignatureHeader(header: string): { timestamp: string | undefined; signatures: string[] } {
  const pairs = header.split(';').map(item => item.trim()).filter(Boolean);
  const timestamp = pairs.find(item => item.startsWith('ts='))?.split('=')[1];
  const signatures = pairs
    .filter(item => item.startsWith('h1='))
    .map(item => item.split('=')[1]);
  return { timestamp, signatures };
}

export function hexToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length / 2);
  for (let i = 0; i < value.length; i += 2) {
    bytes[i / 2] = parseInt(value.substring(i, i + 2), 16);
  }
  return bytes;
}

export function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let mismatch = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    mismatch |= left[index] ^ right[index];
  }
  return mismatch === 0;
}

export async function computeSignature(secret: string, signedPayload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  return Array.from(new Uint8Array(signature))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verifies a Paddle webhook signature.
 * Returns true only when the signature matches and the timestamp is within 5 minutes.
 */
export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
): Promise<boolean> {
  if (!webhookSecret || !signatureHeader) return false;

  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);
  if (!timestamp || signatures.length === 0) return false;

  const timestampAge = Math.abs(Date.now() - Number(timestamp) * 1000);
  if (timestampAge > 5 * 60 * 1000) return false;

  const signedPayload = `${timestamp}:${rawBody}`;
  const expectedSignature = await computeSignature(webhookSecret, signedPayload);
  const expectedBytes = hexToBytes(expectedSignature);

  return signatures.some(signature => constantTimeEqual(hexToBytes(signature), expectedBytes));
}
