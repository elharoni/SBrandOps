import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// Twitter OAuth 2.0 uses client_id / client_secret (NOT the v1.1 API key / secret)
const TWITTER_CLIENT_ID     = Deno.env.get('TWITTER_CLIENT_ID')     || '';
const TWITTER_CLIENT_SECRET = Deno.env.get('TWITTER_CLIENT_SECRET') || '';

function getRedirectUri(req: Request) {
    const url = new URL(req.url);
    return `https://${url.host}/functions/v1/twitter-oauth/callback`;
}

// PKCE helpers
async function generateCodeVerifier(): Promise<string> {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(arr: Uint8Array): string {
    return btoa(String.fromCharCode(...arr))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

serve(async (req: Request) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // ACTION: INIT
    if (pathname.endsWith('/init')) {
        const brandId = url.searchParams.get('brand_id') || '';

        if (!TWITTER_CLIENT_ID) {
            return new Response(JSON.stringify({ error: 'TWITTER_CLIENT_ID not configured' }), {
                status: 500, headers: { 'Content-Type': 'application/json' },
            });
        }

        const codeVerifier  = await generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        // Store code_verifier in state (stateless PKCE — safe because the auth server
        // independently validates SHA256(verifier) == stored challenge)
        const state = btoa(encodeURIComponent(JSON.stringify({ cv: codeVerifier, b: brandId })));

        const redirectUri = getRedirectUri(req);

        const authUrl = new URL('https://twitter.com/i/oauth2/authorize');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', TWITTER_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', 'tweet.read users.read offline.access');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        return Response.redirect(authUrl.toString(), 302);
    }

    // ACTION: CALLBACK
    if (pathname.endsWith('/callback')) {
        const code  = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        if (error || !code || !state) {
            const errDesc = url.searchParams.get('error_description') || error || 'Missing code or state';
            return new Response(
                buildHtml('OAUTH_ERROR', null, null, null, null, errDesc),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
        }

        let codeVerifier: string;
        try {
            const decoded = JSON.parse(decodeURIComponent(atob(state)));
            codeVerifier = decoded.cv;
            if (!codeVerifier) throw new Error('missing cv');
        } catch {
            return new Response(
                buildHtml('OAUTH_ERROR', null, null, null, null, 'Invalid state parameter'),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
        }

        const redirectUri = getRedirectUri(req);

        // Twitter OAuth 2.0 token exchange uses Basic auth (client_id:client_secret)
        const credentials = btoa(`${TWITTER_CLIENT_ID}:${TWITTER_CLIENT_SECRET}`);
        const tokenResp = await fetch('https://api.twitter.com/2/oauth2/token', {
            method: 'POST',
            headers: {
                'Content-Type':  'application/x-www-form-urlencoded',
                'Authorization': `Basic ${credentials}`,
            },
            body: new URLSearchParams({
                grant_type:     'authorization_code',
                code,
                redirect_uri:   redirectUri,
                code_verifier:  codeVerifier,
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

        const accessToken  = tokenData.access_token;
        const refreshToken = tokenData.refresh_token || null;
        const expiresIn    = tokenData.expires_in    || 7200;

        // Fetch user info
        let user: { id: string; name: string; avatarUrl: string; username: string } | null = null;
        try {
            const userResp = await fetch(
                'https://api.twitter.com/2/users/me?user.fields=profile_image_url,public_metrics',
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            const userData = await userResp.json();
            const u = userData?.data;
            if (u) {
                user = {
                    id:        u.id,
                    name:      u.name      || 'X User',
                    username:  u.username  || '',
                    avatarUrl: u.profile_image_url?.replace('_normal', '') || '',
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
    user: { id: string; name: string; avatarUrl: string; username?: string } | null,
    errorMsg: string | null,
) {
    const allowedOrigin = Deno.env.get('FRONTEND_ORIGIN') ?? '';
    const payload = JSON.stringify({
        type,
        platform: 'x',    // matches SocialPlatform.X in the frontend
        accessToken,
        refreshToken,
        expiresIn: expiresIn ?? 3600,
        user,
        error: errorMsg,
    });

    return `<!DOCTYPE html>
<html>
<head><title>X (Twitter) OAuth</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>Completing X connection...</h2>
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
