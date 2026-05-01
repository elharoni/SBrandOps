import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const LINKEDIN_CLIENT_ID     = Deno.env.get('LINKEDIN_CLIENT_ID')     || '';
const LINKEDIN_CLIENT_SECRET = Deno.env.get('LINKEDIN_CLIENT_SECRET') || '';

function getRedirectUri(req: Request) {
    const url = new URL(req.url);
    return `https://${url.host}/functions/v1/linkedin-oauth/callback`;
}

serve(async (req: Request) => {
    const url = new URL(req.url);
    const pathname = url.pathname;

    // ACTION: INIT
    if (pathname.endsWith('/init')) {
        const brandId = url.searchParams.get('brand_id') || '';

        if (!LINKEDIN_CLIENT_ID) {
            return new Response(JSON.stringify({ error: 'LINKEDIN_CLIENT_ID not configured' }), {
                status: 500, headers: { 'Content-Type': 'application/json' },
            });
        }

        const state = btoa(encodeURIComponent(JSON.stringify({ b: brandId })));
        const redirectUri = getRedirectUri(req);

        const authUrl = new URL('https://www.linkedin.com/oauth/v2/authorization');
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', LINKEDIN_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', redirectUri);
        // r_liteprofile + r_emailaddress are the standard scopes; w_member_social for posting
        authUrl.searchParams.set('scope', 'r_liteprofile r_emailaddress w_member_social');
        authUrl.searchParams.set('state', state);

        return Response.redirect(authUrl.toString(), 302);
    }

    // ACTION: CALLBACK
    if (pathname.endsWith('/callback')) {
        const code  = url.searchParams.get('code');
        const error = url.searchParams.get('error');

        if (error || !code) {
            const errDesc = url.searchParams.get('error_description') || error || 'Missing code';
            return new Response(
                buildHtml('OAUTH_ERROR', null, null, null, null, errDesc),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
            );
        }

        // Exchange code for tokens
        const redirectUri = getRedirectUri(req);
        const tokenResp = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type:    'authorization_code',
                code,
                redirect_uri:  redirectUri,
                client_id:     LINKEDIN_CLIENT_ID,
                client_secret: LINKEDIN_CLIENT_SECRET,
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
        const expiresIn    = tokenData.expires_in    || 3600;

        // Fetch basic profile (name + avatar)
        let user: { id: string; name: string; avatarUrl: string } | null = null;
        try {
            const profileResp = await fetch(
                'https://api.linkedin.com/v2/me?projection=(id,localizedFirstName,localizedLastName,profilePicture(displayImage~:playableStreams))',
                { headers: { Authorization: `Bearer ${accessToken}` } },
            );
            const profile = await profileResp.json();
            if (profile?.id) {
                const firstName  = profile.localizedFirstName  || '';
                const lastName   = profile.localizedLastName   || '';
                const name       = `${firstName} ${lastName}`.trim() || 'LinkedIn User';
                const elements   = profile?.profilePicture?.['displayImage~']?.elements;
                const avatarUrl  = elements?.[elements.length - 1]?.identifiers?.[0]?.identifier || '';
                user = { id: profile.id, name, avatarUrl };
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
        platform: 'linkedin',
        accessToken,
        refreshToken,
        expiresIn: expiresIn ?? 3600,
        user,
        error: errorMsg,
    });

    return `<!DOCTYPE html>
<html>
<head><title>LinkedIn OAuth</title></head>
<body style="font-family:sans-serif;text-align:center;padding-top:50px;">
    <h2>Completing LinkedIn connection...</h2>
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
