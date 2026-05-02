/**
 * Meta Ads OAuth Edge Function
 * Handles Facebook OAuth for Meta Ads (ads_read, ads_management, business_management).
 * SEPARATE from Facebook Page OAuth — never mix the two token types.
 *
 * Routes:
 *   /init     — redirect to Facebook OAuth dialog
 *   /callback — exchange code, verify HMAC-signed state, return ad accounts list via postMessage
 *
 * Security:
 *   State is HMAC-SHA256(secret, brandId + nonce + expiry) — signed, not just encoded.
 *   Token is NOT stored here — frontend must POST it to meta-ads-connect after account selection.
 */

import { buildCorsHeaders } from '../_shared/auth.ts';

const FB_APP_ID      = Deno.env.get('FACEBOOK_APP_ID') || '';
const FB_APP_SECRET  = Deno.env.get('FACEBOOK_APP_SECRET') || '';
const FB_GRAPH_VER   = 'v23.0';
const ADS_SCOPES     = 'ads_read,ads_management,business_management,pages_show_list,instagram_basic';
const STATE_TTL_MS   = 10 * 60 * 1000; // 10 minutes

function getRedirectUri(req: Request): string {
    const url = new URL(req.url);
    return `https://${url.host}/functions/v1/meta-ads-oauth/callback`;
}

// ── HMAC-SHA256 state helpers ─────────────────────────────────────────────────

async function signState(brandId: string): Promise<string> {
    const nonce   = crypto.randomUUID();
    const expiry  = Date.now() + STATE_TTL_MS;
    const payload = `${brandId}.${nonce}.${expiry}`;

    const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(FB_APP_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

    return btoa(`${payload}.${sigHex}`);
}

async function verifyState(state: string): Promise<{ brandId: string } | null> {
    try {
        const decoded = atob(state);
        const parts   = decoded.split('.');
        if (parts.length !== 4) return null;

        const [brandId, nonce, expiryStr, receivedSig] = parts;
        const expiry = parseInt(expiryStr, 10);

        if (Date.now() > expiry) return null; // expired

        const payload = `${brandId}.${nonce}.${expiryStr}`;
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(FB_APP_SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
        const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');

        // Constant-time comparison to prevent timing attacks
        if (expectedSig.length !== receivedSig.length) return null;
        let diff = 0;
        for (let i = 0; i < expectedSig.length; i++) {
            diff |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i);
        }
        if (diff !== 0) return null;

        return { brandId };
    } catch {
        return null;
    }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const url    = new URL(req.url);
    const path   = url.pathname;
    const origin = req.headers.get('origin');
    const cors   = buildCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: cors });
    }

    // ── /init ─────────────────────────────────────────────────────────────────
    if (path.endsWith('/init')) {
        if (!FB_APP_ID || !FB_APP_SECRET) {
            return new Response(JSON.stringify({ error: 'Meta credentials not configured' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json', ...cors },
            });
        }

        const brandId = url.searchParams.get('brand_id');
        if (!brandId) {
            return new Response(JSON.stringify({ error: 'Missing brand_id' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...cors },
            });
        }

        const state      = await signState(brandId);
        const dialogUrl  = new URL(`https://www.facebook.com/${FB_GRAPH_VER}/dialog/oauth`);
        dialogUrl.searchParams.set('client_id', FB_APP_ID);
        dialogUrl.searchParams.set('redirect_uri', getRedirectUri(req));
        dialogUrl.searchParams.set('state', state);
        dialogUrl.searchParams.set('scope', ADS_SCOPES);
        dialogUrl.searchParams.set('response_type', 'code');

        return Response.redirect(dialogUrl.toString(), 302);
    }

    // ── /callback ─────────────────────────────────────────────────────────────
    if (path.endsWith('/callback')) {
        const code        = url.searchParams.get('code');
        const stateParam  = url.searchParams.get('state');
        const error       = url.searchParams.get('error');
        const errorDesc   = url.searchParams.get('error_description');

        if (error || !code || !stateParam) {
            return htmlResponse('OAUTH_ERROR', null, null, [], error || errorDesc || 'Authorization denied');
        }

        // 1. Verify signed state
        const stateData = await verifyState(stateParam);
        if (!stateData) {
            return htmlResponse('OAUTH_ERROR', null, null, [], 'Invalid or expired OAuth state. Please try connecting again.');
        }
        const { brandId } = stateData;

        // 2. Exchange auth code → short-lived user token
        const tokenUrl = new URL(`https://graph.facebook.com/${FB_GRAPH_VER}/oauth/access_token`);
        tokenUrl.searchParams.set('client_id', FB_APP_ID);
        tokenUrl.searchParams.set('client_secret', FB_APP_SECRET);
        tokenUrl.searchParams.set('redirect_uri', getRedirectUri(req));
        tokenUrl.searchParams.set('code', code);

        const tokenResp = await fetch(tokenUrl.toString());
        const tokenData = await tokenResp.json();

        if (!tokenResp.ok || !tokenData.access_token) {
            const errMsg = tokenData.error?.message || tokenData.error_description || 'Token exchange failed';
            return htmlResponse('OAUTH_ERROR', null, null, [], errMsg);
        }

        // 3. Extend → long-lived user token (~60 days)
        const llUrl = new URL(`https://graph.facebook.com/${FB_GRAPH_VER}/oauth/access_token`);
        llUrl.searchParams.set('grant_type', 'fb_exchange_token');
        llUrl.searchParams.set('client_id', FB_APP_ID);
        llUrl.searchParams.set('client_secret', FB_APP_SECRET);
        llUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

        const llResp  = await fetch(llUrl.toString());
        const llData  = await llResp.json();
        const accessToken: string = llData.access_token || tokenData.access_token;

        // 4. Fetch accessible ad accounts (active first)
        let adAccounts: Array<{ id: string; name: string; currency: string }> = [];
        try {
            const adsResp = await fetch(
                `https://graph.facebook.com/${FB_GRAPH_VER}/me/adaccounts?fields=id,name,currency,account_status&limit=50&access_token=${encodeURIComponent(accessToken)}`,
            );
            const adsData = await adsResp.json();
            adAccounts = ((adsData.data || []) as Array<Record<string, unknown>>)
                .sort((a, b) => (a.account_status === 1 ? -1 : 1) - (b.account_status === 1 ? -1 : 1))
                .map((acc) => ({
                    id:       String(acc.id),
                    name:     String(acc.name || acc.id),
                    currency: String(acc.currency || 'USD'),
                }));
        } catch {
            // Non-fatal — return empty list; user sees error in frontend
        }

        if (adAccounts.length === 0) {
            return htmlResponse('OAUTH_ERROR', null, null, [],
                'No accessible Meta Ads accounts found. Make sure your Facebook account has access to at least one ad account.');
        }

        // 5. Fetch pages accessible by this token (for page_id selection)
        let pages: Array<{ id: string; name: string }> = [];
        try {
            const pagesResp = await fetch(
                `https://graph.facebook.com/${FB_GRAPH_VER}/me/accounts?fields=id,name&limit=25&access_token=${encodeURIComponent(accessToken)}`,
            );
            const pagesData = await pagesResp.json();
            pages = ((pagesData.data || []) as Array<Record<string, unknown>>)
                .map((p) => ({ id: String(p.id), name: String(p.name || p.id) }));
        } catch {
            // Non-fatal
        }

        return htmlResponse('OAUTH_SUCCESS', accessToken, brandId, adAccounts, null, pages);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...cors },
    });
});

// ── postMessage HTML response ─────────────────────────────────────────────────

function htmlResponse(
    type: 'OAUTH_SUCCESS' | 'OAUTH_ERROR',
    accessToken: string | null,
    brandId: string | null,
    adAccounts: Array<{ id: string; name: string; currency: string }>,
    errorMsg: string | null,
    pages: Array<{ id: string; name: string }> = [],
): Response {
    const allowedOrigin = Deno.env.get('FRONTEND_ORIGIN') ?? '';
    const payload = JSON.stringify({
        type,
        provider: 'meta_ads',
        accessToken,
        brandId,
        adAccounts,
        pages,
        error: errorMsg,
    });

    const html = `<!DOCTYPE html>
<html>
<head><title>Meta Ads — Completing connection</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:50px;background:#f9f9f9;">
  <h2 style="color:#1877f2;">Completing Meta Ads connection...</h2>
  <p style="color:#666;">You can close this window if it doesn't close automatically.</p>
  <script>
    var payload = ${payload};
    var allowedOrigin = ${JSON.stringify(allowedOrigin)};
    if (window.opener && allowedOrigin) {
      window.opener.postMessage(payload, allowedOrigin);
    } else if (window.opener) {
      console.error('[meta-ads-oauth] FRONTEND_ORIGIN not set — cannot safely deliver result.');
    }
    setTimeout(function(){ window.close(); }, 1500);
  </script>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
