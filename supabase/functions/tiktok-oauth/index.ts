import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const TIKTOK_CLIENT_KEY    = Deno.env.get('TIKTOK_CLIENT_KEY')    || '';
const TIKTOK_CLIENT_SECRET = Deno.env.get('TIKTOK_CLIENT_SECRET') || '';

function getRedirectUri(req: Request) {
    const url = new URL(req.url);
    return `https://${url.host}/functions/v1/tiktok-oauth/callback`;
}

serve(async (req: Request) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // ACTION: INIT
    if (pathname.endsWith('/init')) {
        const brandId = url.searchParams.get('brand_id') || '';

        if (!TIKTOK_CLIENT_KEY) {
            return new Response(JSON.stringify({ error: 'TIKTOK_CLIENT_KEY not configured' }), {
                status: 500, headers: { 'Content-Type': 'application/json' },
            });
        }

        const state = btoa(encodeURIComponent(JSON.stringify({ b: brandId })));
        const redirectUri = getRedirectUri(req);

        const authUrl = new URL('https://www.tiktok.com/v2/auth/authorize/');
        authUrl.searchParams.set('client_key', TIKTOK_CLIENT_KEY);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('scope', 'user.info.basic,user.info.profile,user.info.stats');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('state', state);

        return Response.redirect(authUrl.toString(), 302);
    }

    // ACTION: CALLBACK
    if (pathname.endsWith('/callback')) {
        const code  = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error || !code) {
            return new Response(
                buildHtml('OAUTH_ERROR', null, null, null, null, error || 'Missing code'),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
        }

        // Exchange code for tokens
        const redirectUri = getRedirectUri(req);
        const tokenResp = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_key:    TIKTOK_CLIENT_KEY,
                client_secret: TIKTOK_CLIENT_SECRET,
                code,
                grant_type:    'authorization_code',
                redirect_uri:  redirectUri,
            }),
        });

        const tokenData = await tokenResp.json();

        if (!tokenResp.ok || tokenData.error) {
            const errMsg = tokenData.error_description || tokenData.error || 'Token exchange failed';
            return new Response(
                buildHtml('OAUTH_ERROR', null, null, null, null, errMsg),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
        }

        const accessToken  = tokenData.data?.access_token  || tokenData.access_token;
        const refreshToken = tokenData.data?.refresh_token || tokenData.refresh_token;
        const expiresIn    = tokenData.data?.expires_in    || tokenData.expires_in    || 86400;
        const openId       = tokenData.data?.open_id       || tokenData.open_id;

        // Fetch user info
        let user: { id: string; name: string; avatarUrl: string } | null = null;
        try {
            const userResp = await fetch(
                'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url',
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            const userData = await userResp.json();
            const u = userData?.data?.user;
            if (u) {
                user = {
                    id:        u.open_id || openId || '',
                    name:      u.display_name || 'TikTok User',
                    avatarUrl: u.avatar_url || '',
                };
            }
        } catch {
            // user info is best-effort
        }

        return new Response(
            buildHtml('OAUTH_SUCCESS', accessToken, refreshToken, expiresIn, user, null),
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        );
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404, headers: { 'Content-Type': 'application/json' },
    });
});

function buildHtml(
    type: 'OAUTH_SUCCESS' | 'OAUTH_ERROR',
    accessToken: string | null,
    refreshToken: string | null,
    expiresIn: number | null,
    user: { id: string; name: string; avatarUrl: string } | null,
    errorMsg: string | null,
) {
    const allowedOrigin = Deno.env.get('FRONTEND_ORIGIN') ?? '';
    const payload = JSON.stringify({
        type,
        platform: 'tiktok',
        accessToken,
        refreshToken,
        expiresIn: expiresIn ?? 3600,
        user,
        error: errorMsg,
    });

    return `<!DOCTYPE html>
<html>
<head><title>TikTok OAuth</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>Completing TikTok connection...</h2>
    <p>You can close this window if it doesn't close automatically.</p>
    <script>
        const payload = ${payload};
        const allowedOrigin = ${JSON.stringify(allowedOrigin)};
        if (window.opener && allowedOrigin) {
            window.opener.postMessage(payload, allowedOrigin);
        } else if (window.opener) {
            console.error('FRONTEND_ORIGIN not configured — cannot deliver OAuth token safely.');
        }
        setTimeout(() => window.close(), 1500);
    </script>
</body>
</html>`;
}
