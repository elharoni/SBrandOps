/**
 * token-refresh Edge Function
 * تجدد OAuth tokens قبل انتهائها تلقائياً
 *
 * Called by pg_cron daily — NOT a user-facing endpoint.
 * Auth: Bearer <CRON_SECRET> (not a Supabase JWT)
 *
 * Behaviour per provider:
 *  - facebook / instagram : exchanges via fb_exchange_token Graph API (~60 days renewed)
 *  - others (linkedin, x, tiktok, google) : marks as needs_reconnect (OAuth redirect required)
 *
 * Skips tokens with no expires_at (permanent page tokens — never need refresh).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_GRAPH_VERSION   = 'v23.0';
const REFRESH_WINDOW_DAYS = 7;   // refresh tokens expiring within this many days

// ── Facebook token exchange ───────────────────────────────────────────────────

async function exchangeFBToken(
  currentToken: string,
): Promise<{ token: string; expiresAt: string | null; refreshed: boolean }> {
  const appId     = Deno.env.get('FACEBOOK_APP_ID');
  const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');

  if (!appId || !appSecret) {
    return { token: currentToken, expiresAt: null, refreshed: false };
  }

  try {
    const url = new URL(`https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token`);
    url.searchParams.set('grant_type',        'fb_exchange_token');
    url.searchParams.set('client_id',         appId);
    url.searchParams.set('client_secret',     appSecret);
    url.searchParams.set('fb_exchange_token', currentToken);

    const resp = await fetch(url.toString());
    if (!resp.ok) return { token: currentToken, expiresAt: null, refreshed: false };

    const data = await resp.json();
    if (!data.access_token) return { token: currentToken, expiresAt: null, refreshed: false };

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    return { token: data.access_token, expiresAt, refreshed: true };
  } catch {
    return { token: currentToken, expiresAt: null, refreshed: false };
  }
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();

  // ── Cron secret auth (not a user JWT) ──────────────────────────────────────
  const provided  = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
  const cronSecret = Deno.env.get('CRON_SECRET');

  if (!cronSecret || !provided || provided !== cronSecret) {
    console.error(JSON.stringify({ correlationId, event: 'unauthorized' }));
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  // ── Encryption key pre-flight ───────────────────────────────────────────────
  const encKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (!encKey || encKey.length < 64) {
    return new Response(JSON.stringify({ error: 'Missing OAUTH_ENCRYPTION_KEY' }), { status: 503 });
  }

  // ── Query tokens expiring within REFRESH_WINDOW_DAYS ───────────────────────
  const windowDate = new Date(
    Date.now() + REFRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: rows, error: queryError } = await supabase
    .from('oauth_tokens')
    .select('id, brand_id, social_account_id, provider, provider_account_id, access_token_enc, expires_at')
    .eq('is_valid', true)
    .not('expires_at', 'is', null)        // skip permanent tokens (null = never expires)
    .lte('expires_at', windowDate)
    .not('access_token_enc', 'is', null);

  if (queryError) {
    console.error(JSON.stringify({ correlationId, event: 'query-error', error: queryError.message }));
    return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
  }

  const tokens    = rows ?? [];
  let   refreshed = 0;
  let   flagged   = 0;
  const errors:   string[] = [];

  for (const token of tokens) {
    const provider  = (token.provider ?? '').toLowerCase();
    const isFb      = provider.includes('facebook') || provider.includes('instagram');
    const accountId = token.social_account_id as string | null;

    if (isFb) {
      // ── Facebook / Instagram: exchange for new long-lived token ────────────
      try {
        const plainToken = await decryptToken(token.access_token_enc);
        if (!plainToken) {
          await markNeedsReconnect(accountId, 'Token decryption failed');
          flagged++;
          continue;
        }

        const result = await exchangeFBToken(plainToken);

        if (!result.refreshed) {
          // API call failed or app secrets missing — flag for manual reconnect
          await markNeedsReconnect(accountId, 'Token exchange failed — check FACEBOOK_APP_ID/SECRET');
          flagged++;
          continue;
        }

        const newEnc = await encryptToken(result.token);

        await supabase
          .from('oauth_tokens')
          .update({
            access_token_enc: newEnc,
            expires_at:       result.expiresAt,
            is_valid:         true,
            raw_metadata:     {
              last_refreshed_at: new Date().toISOString(),
              correlation_id:    correlationId,
            },
          })
          .eq('id', token.id);

        if (accountId) {
          await supabase
            .from('social_accounts')
            .update({
              sync_status:      'active',
              sync_error:       null,
              token_expires_at: result.expiresAt,
              last_synced_at:   new Date().toISOString(),
            })
            .eq('id', accountId);
        }

        refreshed++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'unknown error';
        errors.push(`token ${token.id}: ${msg}`);
        await markNeedsReconnect(accountId, msg);
        flagged++;
      }
    } else {
      // ── Other platforms: can't auto-refresh without user OAuth redirect ────
      await supabase
        .from('oauth_tokens')
        .update({ is_valid: false })
        .eq('id', token.id);

      await markNeedsReconnect(accountId, 'Token expiring — please reconnect your account');
      flagged++;
    }
  }

  const summary = { correlationId, total: tokens.length, refreshed, flagged, errors };
  console.log(JSON.stringify({ event: 'token-refresh-complete', ...summary }));

  return new Response(JSON.stringify(summary), {
    status:  200,
    headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function markNeedsReconnect(accountId: string | null, reason: string): Promise<void> {
  if (!accountId) return;
  await supabase
    .from('social_accounts')
    .update({ sync_status: 'needs_reconnect', sync_error: reason })
    .eq('id', accountId);
}
