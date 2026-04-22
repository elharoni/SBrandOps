import { assertEquals } from 'jsr:@std/assert';
import {
  parseSignatureHeader,
  hexToBytes,
  constantTimeEqual,
  computeSignature,
  verifyPaddleSignature,
} from '../_shared/webhookSecurity.ts';

Deno.test('parseSignatureHeader — extracts timestamp and single signature', () => {
  const { timestamp, signatures } = parseSignatureHeader('ts=1234567890;h1=abc123');
  assertEquals(timestamp, '1234567890');
  assertEquals(signatures, ['abc123']);
});

Deno.test('parseSignatureHeader — extracts multiple h1 signatures', () => {
  const { timestamp, signatures } = parseSignatureHeader('ts=1000;h1=aaa;h1=bbb');
  assertEquals(timestamp, '1000');
  assertEquals(signatures, ['aaa', 'bbb']);
});

Deno.test('parseSignatureHeader — empty string returns undefined timestamp and empty array', () => {
  const { timestamp, signatures } = parseSignatureHeader('');
  assertEquals(timestamp, undefined);
  assertEquals(signatures, []);
});

Deno.test('parseSignatureHeader — handles extra whitespace around semicolons', () => {
  const { timestamp, signatures } = parseSignatureHeader('ts=999 ; h1=xyz');
  assertEquals(timestamp, '999');
  assertEquals(signatures, ['xyz']);
});

Deno.test('hexToBytes — converts known hex string', () => {
  const bytes = hexToBytes('deadbeef');
  assertEquals(bytes, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
});

Deno.test('hexToBytes — converts all-zeros', () => {
  const bytes = hexToBytes('0000');
  assertEquals(bytes, new Uint8Array([0x00, 0x00]));
});

Deno.test('constantTimeEqual — returns true for identical arrays', () => {
  assertEquals(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
});

Deno.test('constantTimeEqual — returns false for different lengths', () => {
  assertEquals(constantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false);
});

Deno.test('constantTimeEqual — returns false when last byte differs', () => {
  assertEquals(constantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
});

Deno.test('constantTimeEqual — returns false for empty vs non-empty', () => {
  assertEquals(constantTimeEqual(new Uint8Array([]), new Uint8Array([1])), false);
});

Deno.test('computeSignature — produces 64-char hex string', async () => {
  const sig = await computeSignature('secret', 'payload');
  assertEquals(sig.length, 64);
  assertEquals(/^[0-9a-f]+$/.test(sig), true);
});

Deno.test('computeSignature — is deterministic', async () => {
  const a = await computeSignature('secret', 'payload');
  const b = await computeSignature('secret', 'payload');
  assertEquals(a, b);
});

Deno.test('computeSignature — differs with different secret', async () => {
  const a = await computeSignature('secret1', 'payload');
  const b = await computeSignature('secret2', 'payload');
  assertEquals(a === b, false);
});

Deno.test('verifyPaddleSignature — rejects missing webhookSecret', async () => {
  assertEquals(await verifyPaddleSignature('body', 'ts=1;h1=abc', undefined), false);
});

Deno.test('verifyPaddleSignature — rejects null signatureHeader', async () => {
  assertEquals(await verifyPaddleSignature('body', null, 'secret'), false);
});

Deno.test('verifyPaddleSignature — rejects expired timestamp (10 min ago)', async () => {
  const oldTs = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
  assertEquals(await verifyPaddleSignature('body', `ts=${oldTs};h1=fakesig`, 'secret'), false);
});

Deno.test('verifyPaddleSignature — accepts a correctly signed payload', async () => {
  const secret = 'test-webhook-secret-32chars-xxxx';
  const ts = Math.floor(Date.now() / 1000);
  const body = '{"event_type":"subscription.created"}';
  const signedPayload = `${ts}:${body}`;
  const signature = await computeSignature(secret, signedPayload);
  const header = `ts=${ts};h1=${signature}`;
  assertEquals(await verifyPaddleSignature(body, header, secret), true);
});

Deno.test('verifyPaddleSignature — rejects tampered body', async () => {
  const secret = 'test-webhook-secret-32chars-xxxx';
  const ts = Math.floor(Date.now() / 1000);
  const originalBody = '{"event_type":"subscription.created"}';
  const signedPayload = `${ts}:${originalBody}`;
  const signature = await computeSignature(secret, signedPayload);
  const header = `ts=${ts};h1=${signature}`;
  const tamperedBody = '{"event_type":"subscription.cancelled"}';
  assertEquals(await verifyPaddleSignature(tamperedBody, header, secret), false);
});
