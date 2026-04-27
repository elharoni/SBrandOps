/**
 * token-refresh Edge Function
 * تجدد OAuth tokens قبل انتهائها تلقائياً
 *
 * Called by pg_cron every 6 hours — NOT a user-facing endpoint.
 * Auth: Bearer <CRON_SECRET>
 *
 * Platform handlers:
 *  - facebook / instagram : fb_exchange_token (~60 days renewed)
 *  - google / ga4 / search_console / google_ads / youtube : refresh_token grant (standard OAuth2)
 *  - tiktok : refresh_token grant (TikTok for Business API v2)
 *  - linkedin / x / pinterest : cannot auto-refresh — marks needs_reconnect + notifies brand
 *
 * Skips tokens with null expires_at (permanent page tokens).
 * Updates both oauth_tokens AND brand_connections tables.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken, encryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_GRAPH_VERSION    = 'v23.0';
const REFRESH_WINDOW_DAYS = 7;

// ── Helpers ───────────────────────────────────────────────────────────────────

function windowDate(): string {
    return new Date(Date.now() + REFRESH_WINDOW_DAYS * 86_400_000).toISOString();
}

// ── Facebook / Instagram ──────────────────────────────────────────────────────

async function refreshFacebook(
    currentToken: string,
): Promise<{ token: string; expiresAt: string | null; ok: boolean }> {
    const appId     = Deno.env.get('FACEBOOK_APP_ID');
    const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
    if (!appId || !appSecret) return { token: currentToken, expiresAt: null, ok: false };

    try {
        const url = new URL(`https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token`);
        url.searchParams.set('grant_type',        'fb_exchange_token');
        url.searchParams.set('client_id',         appId);
        url.searchParams.set('client_secret',     appSecret);
        url.searchParams.set('fb_exchange_token', currentToken);

        const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
        if (!resp.ok) return { token: currentToken, expiresAt: null, ok: false };
        const data = await resp.json();
        if (!data.access_token) return { token: currentToken, expiresAt: null, ok: false };

        const expiresAt = data.expires_in
            ? new Date(Date.now() + data.expires_in * 1000).toISOString()
            : null;
        return { token: data.access_token, expiresAt, ok: true };
    } catch {
        return { token: currentToken, expiresAt: null, ok: false };
    }
}

// ── Google (GA4 / Search Console / Google Ads / YouTube) ─────────────────────

async function refreshGoogle(
    refreshToken: string,
): Promise<{ accessToken: string; expiresAt: string | null; ok: boolean }> {
    const clientId     = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return { accessToken: '', expiresAt: null, ok: false };

    try {
        const resp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                refresh_token: refreshToken,
                client_id:     clientId,
                client_secret: clientSecret,
            }),
            signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) return { accessToken: '', expiresAt: null, ok: false };
        const data = await resp.json();
        if (!data.access_token) return { accessToken: '', expiresAt: null, ok: false };

        const expiresAt = data.expires_in
            ? new Date(Date.now() + data.expires_in * 1000).toISOString()
            : null;
        return { accessToken: data.access_token, expiresAt, ok: true };
    } catch {
        return { accessToken: '', expiresAt: null, ok: false };
    }
}

// ── TikTok ────────────────────────────────────────────────────────────────────

async function refreshTikTok(
    refreshToken: string,
): Promise<{ accessToken: string; newRefreshToken: string | null; expiresAt: string | null; ok: boolean }> {
    const clientKey    = Deno.env.get('TIKTOK_CLIENT_KEY');
    const clientSecret = Deno.env.get('TIKTOK_CLIENT_SECRET');
    if (!clientKey || !clientSecret) return { accessToken: '', newRefreshToken: null, expiresAt: null, ok: false };

    try {
        const resp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'refresh_token',
                refresh_token: refreshToken,
                client_key:    clientKey,
                client_secret: clientSecret,
            }),
            signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) return { accessToken: '', newRefreshToken: null, expiresAt: null, ok: false };
        const data = await resp.json();
        if (data.error || !data.data?.access_token) return { accessToken: '', newRefreshToken: null, expiresAt: null, ok: false };

        const tokenData = data.data;
        const expiresAt = tokenData.expires_in
            ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
            : null;
        return {
            accessToken:      tokenData.access_token,
            newRefreshToken:  tokenData.refresh_token ?? null,
            expiresAt,
            ok: true,
        };
    } catch {
        return { accessToken: '', newRefreshToken: null, expiresAt: null, ok: false };
    }
}

// ── Mark helpers ──────────────────────────────────────────────────────────────

async function markTokenInvalid(tokenId: string): Promise<void> {
    await supabase.from('oauth_tokens').update({ is_valid: false }).eq('id', tokenId);
}

async function markAccountNeedsReconnect(accountId: string | null, reason: string): Promise<void> {
    if (!accountId) return;
    await supabase
        .from('social_accounts')
        .update({ sync_status: 'needs_reconnect', sync_error: reason })
        .eq('id', accountId);
}

async function markBrandConnectionExpired(brandId: string, provider: string): Promise<void> {
    await supabase
        .from('brand_connections')
        .update({ status: 'expired', last_error: 'Token expired — user must reconnect', updated_at: new Date().toISOString() })
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .eq('status', 'connected');
}

async function updateTokenSuccess(
    tokenId: string,
    accountId: string | null,
    newAccessEnc: string,
    newRefreshEnc: string | null,
    expiresAt: string | null,
    correlationId: string,
): Promise<void> {
    const tokenUpdate: Record<string, unknown> = {
        access_token_enc: newAccessEnc,
        expires_at:       expiresAt,
        is_valid:         true,
        raw_metadata: {
            last_refreshed_at: new Date().toISOString(),
            correlation_id:    correlationId,
        },
    };
    if (newRefreshEnc) tokenUpdate.refresh_token_enc = newRefreshEnc;

    await supabase.from('oauth_tokens').update(tokenUpdate).eq('id', tokenId);

    if (accountId) {
        await supabase.from('social_accounts').update({
            sync_status:      'active',
            sync_error:       null,
            token_expires_at: expiresAt,
            last_synced_at:   new Date().toISOString(),
        }).eq('id', accountId);
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();

    const provided   = req.headers.get('Authorization')?.replace('Bearer ', '').trim();
    const cronSecret = Deno.env.get('CRON_SECRET');

    if (!cronSecret || !provided || provided !== cronSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const encKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
    if (!encKey || encKey.length < 64) {
        return new Response(JSON.stringify({ error: 'Missing OAUTH_ENCRYPTION_KEY' }), { status: 503 });
    }

    const { data: rows, error: queryError } = await supabase
        .from('oauth_tokens')
        .select('id, brand_id, social_account_id, provider, provider_account_id, access_token_enc, refresh_token_enc, expires_at')
        .eq('is_valid', true)
        .not('expires_at', 'is', null)
        .lte('expires_at', windowDate())
        .not('access_token_enc', 'is', null);

    if (queryError) {
        console.error(JSON.stringify({ correlationId, event: 'query-error', error: queryError.message }));
        return new Response(JSON.stringify({ error: queryError.message }), { status: 500 });
    }

    const tokens        = rows ?? [];
    let   refreshed     = 0;
    let   flagged       = 0;
    const errors: string[] = [];

    for (const token of tokens) {
        const provider  = (token.provider ?? '').toLowerCase();
        const accountId = token.social_account_id as string | null;
        const brandId   = token.brand_id as string;

        // ── Facebook / Instagram ─────────────────────────────────────────────
        if (provider.includes('facebook') || provider.includes('instagram')) {
            try {
                const plain = await decryptToken(token.access_token_enc);
                if (!plain) {
                    await markTokenInvalid(token.id);
                    await markAccountNeedsReconnect(accountId, 'Token decryption failed');
                    flagged++; continue;
                }
                const result = await refreshFacebook(plain);
                if (!result.ok) {
                    await markAccountNeedsReconnect(accountId, 'Facebook token exchange failed');
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                await updateTokenSuccess(
                    token.id, accountId,
                    await encryptToken(result.token), null,
                    result.expiresAt, correlationId,
                );
                refreshed++;
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'unknown';
                errors.push(`[fb] ${token.id}: ${msg}`);
                await markAccountNeedsReconnect(accountId, msg);
                flagged++;
            }
            continue;
        }

        // ── Google (all scopes) ──────────────────────────────────────────────
        if (provider === 'google' || provider === 'ga4' || provider === 'search_console'
            || provider === 'google_ads' || provider === 'youtube') {
            try {
                const refreshTokenEnc = token.refresh_token_enc as string | null;
                if (!refreshTokenEnc) {
                    await markTokenInvalid(token.id);
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                const refreshTokenPlain = await decryptToken(refreshTokenEnc);
                if (!refreshTokenPlain) {
                    await markTokenInvalid(token.id);
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                const result = await refreshGoogle(refreshTokenPlain);
                if (!result.ok) {
                    await markTokenInvalid(token.id);
                    await markAccountNeedsReconnect(accountId, 'Google token refresh failed');
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                await updateTokenSuccess(
                    token.id, accountId,
                    await encryptToken(result.accessToken), null,
                    result.expiresAt, correlationId,
                );
                // Update brand_connections to healthy
                await supabase.from('brand_connections')
                    .update({ status: 'connected', sync_health: 'healthy', last_error: null, updated_at: new Date().toISOString() })
                    .eq('brand_id', brandId).eq('provider', provider);
                refreshed++;
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'unknown';
                errors.push(`[google] ${token.id}: ${msg}`);
                flagged++;
            }
            continue;
        }

        // ── TikTok ───────────────────────────────────────────────────────────
        if (provider === 'tiktok') {
            try {
                const refreshTokenEnc = token.refresh_token_enc as string | null;
                if (!refreshTokenEnc) {
                    await markTokenInvalid(token.id);
                    await markAccountNeedsReconnect(accountId, 'No TikTok refresh token stored');
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                const refreshTokenPlain = await decryptToken(refreshTokenEnc);
                if (!refreshTokenPlain) {
                    await markTokenInvalid(token.id);
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                const result = await refreshTikTok(refreshTokenPlain);
                if (!result.ok) {
                    await markTokenInvalid(token.id);
                    await markAccountNeedsReconnect(accountId, 'TikTok token refresh failed — please reconnect');
                    await markBrandConnectionExpired(brandId, provider);
                    flagged++; continue;
                }
                const newRefreshEnc = result.newRefreshToken
                    ? await encryptToken(result.newRefreshToken)
                    : null;
                await updateTokenSuccess(
                    token.id, accountId,
                    await encryptToken(result.accessToken),
                    newRefreshEnc, result.expiresAt, correlationId,
                );
                refreshed++;
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'unknown';
                errors.push(`[tiktok] ${token.id}: ${msg}`);
                flagged++;
            }
            continue;
        }

        // ── LinkedIn / X / Pinterest — cannot auto-refresh ──────────────────
        await markTokenInvalid(token.id);
        await markAccountNeedsReconnect(accountId, `${provider} tokens cannot be refreshed automatically. Please reconnect your account.`);
        await markBrandConnectionExpired(brandId, provider);
        flagged++;
    }

    // Write health snapshots for flagged providers
    if (flagged > 0) {
        const flaggedBrands = [...new Set(tokens
            .filter((_t, i) => i >= refreshed)
            .map(t => ({ brand_id: t.brand_id, provider: t.provider }))
        )];
        for (const { brand_id, provider } of flaggedBrands) {
            await supabase.from('integration_health_snapshots').upsert({
                brand_id,
                provider,
                health_score:   0,
                token_healthy:  false,
                error_count_24h: 1,
                snapshot_at:    new Date().toISOString(),
            }, { onConflict: 'brand_id,provider' });
        }
    }

    const summary = { correlationId, total: tokens.length, refreshed, flagged, errors };
    console.log(JSON.stringify({ event: 'token-refresh-complete', ...summary }));

    return new Response(JSON.stringify(summary), {
        status:  200,
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
});
