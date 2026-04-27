/**
 * Meta Ads OAuth Edge Function
 * Handles Facebook OAuth for Meta Ads (ads_read, ads_management, business_management).
 * SEPARATE from Facebook Page OAuth — never mix the two token types.
 *
 * Routes:
 *   /init     — redirect to Facebook OAuth dialog
 *   /callback — exchange code, get long-lived token, fetch ad accounts, postMessage to opener
 */

const FB_APP_ID      = Deno.env.get('FACEBOOK_APP_ID') || '';
const FB_APP_SECRET  = Deno.env.get('FACEBOOK_APP_SECRET') || '';
const FB_GRAPH_VER   = 'v23.0';
const ADS_SCOPES     = 'ads_read,ads_management,business_management';

function getRedirectUri(req: Request): string {
    const url = new URL(req.url);
    return `https://${url.host}/functions/v1/meta-ads-oauth/callback`;
}

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const path = url.pathname;

    // ── /init ─────────────────────────────────────────────────────────────────
    if (path.endsWith('/init')) {
        if (!FB_APP_ID) {
            return new Response(JSON.stringify({ error: 'FACEBOOK_APP_ID not configured' }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const brandId = url.searchParams.get('brand_id');
        if (!brandId) {
            return new Response(JSON.stringify({ error: 'Missing brand_id' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        const state = btoa(encodeURIComponent(JSON.stringify({ b: brandId })));
        const dialogUrl = new URL(`https://www.facebook.com/${FB_GRAPH_VER}/dialog/oauth`);
        dialogUrl.searchParams.set('client_id', FB_APP_ID);
        dialogUrl.searchParams.set('redirect_uri', getRedirectUri(req));
        dialogUrl.searchParams.set('state', state);
        dialogUrl.searchParams.set('scope', ADS_SCOPES);
        dialogUrl.searchParams.set('response_type', 'code');

        return Response.redirect(dialogUrl.toString(), 302);
    }

    // ── /callback ─────────────────────────────────────────────────────────────
    if (path.endsWith('/callback')) {
        const code  = url.searchParams.get('code');
        const error = url.searchParams.get('error');
        const errorDescription = url.searchParams.get('error_description');

        if (error || !code) {
            return htmlResponse('OAUTH_ERROR', null, [], error || errorDescription || 'Authorization denied');
        }

        // 1. Exchange auth code for short-lived user token
        const tokenUrl = new URL(`https://graph.facebook.com/${FB_GRAPH_VER}/oauth/access_token`);
        tokenUrl.searchParams.set('client_id', FB_APP_ID);
        tokenUrl.searchParams.set('client_secret', FB_APP_SECRET);
        tokenUrl.searchParams.set('redirect_uri', getRedirectUri(req));
        tokenUrl.searchParams.set('code', code);

        const tokenResp = await fetch(tokenUrl.toString());
        const tokenData = await tokenResp.json();

        if (!tokenResp.ok || !tokenData.access_token) {
            const errMsg = tokenData.error?.message || tokenData.error_description || 'Token exchange failed';
            return htmlResponse('OAUTH_ERROR', null, [], errMsg);
        }

        // 2. Extend to long-lived token (~60 days)
        const llUrl = new URL(`https://graph.facebook.com/${FB_GRAPH_VER}/oauth/access_token`);
        llUrl.searchParams.set('grant_type', 'fb_exchange_token');
        llUrl.searchParams.set('client_id', FB_APP_ID);
        llUrl.searchParams.set('client_secret', FB_APP_SECRET);
        llUrl.searchParams.set('fb_exchange_token', tokenData.access_token);

        const llResp = await fetch(llUrl.toString());
        const llData = await llResp.json();
        const accessToken: string = llData.access_token || tokenData.access_token;

        // 3. Fetch accessible ad accounts (sorted: ACTIVE first)
        let adAccounts: Array<{ id: string; name: string; currency: string }> = [];
        try {
            const adsResp = await fetch(
                `https://graph.facebook.com/${FB_GRAPH_VER}/me/adaccounts?fields=id,name,currency,account_status&limit=50&access_token=${encodeURIComponent(accessToken)}`,
            );
            const adsData = await adsResp.json();
            adAccounts = ((adsData.data || []) as Array<any>)
                .sort((a, b) => (a.account_status === 1 ? -1 : 1) - (b.account_status === 1 ? -1 : 1))
                .map((acc: any) => ({
                    id: acc.id,            // act_xxxxxxxxx format
                    name: acc.name || acc.id,
                    currency: acc.currency || 'USD',
                }));
        } catch {
            // Non-fatal — return empty list; user will see error in frontend
        }

        if (adAccounts.length === 0) {
            return htmlResponse('OAUTH_ERROR', null, [], 'No accessible Meta Ads accounts found. Make sure your account has access to at least one ad account.');
        }

        return htmlResponse('OAUTH_SUCCESS', accessToken, adAccounts, null);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
    });
});

function htmlResponse(
    type: 'OAUTH_SUCCESS' | 'OAUTH_ERROR',
    accessToken: string | null,
    adAccounts: Array<{ id: string; name: string; currency: string }>,
    errorMsg: string | null,
): Response {
    const allowedOrigin = Deno.env.get('FRONTEND_ORIGIN') ?? '';
    const payload = JSON.stringify({ type, provider: 'meta_ads', accessToken, adAccounts, error: errorMsg });

    const html = `<!DOCTYPE html>
<html>
<head><title>Meta Ads — Completing connection</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:50px;background:#f9f9f9;">
  <h2 style="color:#1877f2;">Completing Meta Ads connection...</h2>
  <p style="color:#666;">You can close this window if it doesn't close automatically.</p>
  <script>
    const payload = ${payload};
    const allowedOrigin = ${JSON.stringify(allowedOrigin)};
    if (window.opener && allowedOrigin) {
      window.opener.postMessage(payload, allowedOrigin);
    } else if (window.opener) {
      console.error('[meta-ads-oauth] FRONTEND_ORIGIN not set — cannot safely deliver result.');
    }
    setTimeout(() => window.close(), 1500);
  </script>
</body>
</html>`;

    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
