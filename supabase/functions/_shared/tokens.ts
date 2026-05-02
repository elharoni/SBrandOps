/**
 * Token encryption / decryption helpers.
 *
 * Algorithm : AES-256-GCM (authenticated encryption — detects tampering)
 * Key source: OAUTH_ENCRYPTION_KEY env var (hex-encoded 32 bytes = 64 hex chars)
 * Wire format: base64url( 12-byte IV || ciphertext )
 *
 * The key never leaves the Edge Function runtime.
 * Every decryptToken call MUST go through decryptTokenWithLog so it
 * is recorded in token_decrypt_logs for audit purposes.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function b64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function importKey(): Promise<CryptoKey> {
  const hex = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (!hex || hex.length < 64) {
    throw new Error('OAUTH_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32');
  }
  const raw = new Uint8Array(hex.match(/.{2}/g)!.map(b => parseInt(b, 16)));
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

/**
 * Encrypts a plaintext token string.
 * Returns null if the input is null/undefined.
 */
export async function encryptToken(plaintext: string | null | undefined): Promise<string | null> {
  if (!plaintext) return null;
  const key = await importKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return b64urlEncode(combined.buffer);
}

/**
 * Decrypts an encrypted token string.
 * Returns null if the input is null/undefined.
 * Throws if the ciphertext is tampered or the key is wrong.
 *
 * Prefer decryptTokenWithLog() over calling this directly —
 * it records the decrypt event in token_decrypt_logs.
 */
export async function decryptToken(encrypted: string | null | undefined): Promise<string | null> {
  if (!encrypted) return null;
  const key = await importKey();
  const combined = b64urlDecode(encrypted);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(plaintext);
}

/**
 * Decrypts a token AND writes an audit row to token_decrypt_logs.
 * Use this in every Edge Function that reads an oauth token.
 *
 * @param encrypted   The encrypted token from oauth_tokens.access_token_enc
 * @param tokenId     The oauth_tokens.id UUID (for audit trail)
 * @param brandId     The brand_id (for audit trail)
 * @param purpose     Why the token is being decrypted (e.g. 'ads_sync')
 * @param requestor   The Edge Function name (e.g. 'ads-sync')
 */
export async function decryptTokenWithLog(
  encrypted: string | null | undefined,
  tokenId: string | null | undefined,
  brandId: string | null | undefined,
  purpose: string,
  requestor: string,
): Promise<string | null> {
  const plaintext = await decryptToken(encrypted);

  // Write audit log fire-and-forget — never block on this
  if (plaintext && tokenId) {
    const supabaseUrl        = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      supabase.from('token_decrypt_logs').insert({
        brand_id:  brandId || null,
        token_id:  tokenId,
        purpose,
        requestor,
      }).then(() => {}).catch(() => {}); // fire-and-forget
    }
  }

  return plaintext;
}
