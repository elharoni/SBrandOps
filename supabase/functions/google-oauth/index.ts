import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') || '';
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') || '';

// The redirect URI needs to point back to this specific Edge Function
function getRedirectUri(req: Request) {
    const url = new URL(req.url);
    // Force https and drop query params for the strict redirect URI matching in Google
    return `https://${url.host}/functions/v1/google-oauth/callback`;
}

serve(async (req: Request) => {
    const url = new URL(req.url);
    const pathname = url.pathname;
    
    // ACTION: INIT
    if (pathname.endsWith('/init')) {
        const provider = url.searchParams.get('provider'); // google_ads, ga4, search_console, etc.
        const brandId = url.searchParams.get('brand_id');

        if (!provider || !brandId) {
            return new Response('Missing provider or brand_id', { status: 400 });
        }

        let scopes = ['openid', 'email', 'profile'];
        if (provider === 'google_ads') {
            scopes.push('https://www.googleapis.com/auth/adwords');
        } else if (provider === 'ga4') {
            scopes.push('https://www.googleapis.com/auth/analytics.readonly');
        } else if (provider === 'search_console') {
            scopes.push('https://www.googleapis.com/auth/webmasters.readonly');
        } else if (provider === 'google_drive') {
            // Include Drive if needed in future
            scopes.push('https://www.googleapis.com/auth/drive.readonly');
        }

        // Encode state
        const stateStr = JSON.stringify({ p: provider, b: brandId });
        const encodedState = btoa(encodeURIComponent(stateStr));

        const redirectUri = getRedirectUri(req);
        
        const googleAuthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        googleAuthUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
        googleAuthUrl.searchParams.set('redirect_uri', redirectUri);
        googleAuthUrl.searchParams.set('response_type', 'code');
        googleAuthUrl.searchParams.set('scope', scopes.join(' '));
        googleAuthUrl.searchParams.set('access_type', 'offline');
        googleAuthUrl.searchParams.set('prompt', 'consent'); // force consent to get refresh token
        googleAuthUrl.searchParams.set('state', encodedState);

        return Response.redirect(googleAuthUrl.toString(), 302);
    }

    // ACTION: CALLBACK
    if (pathname.endsWith('/callback')) {
        const code = url.searchParams.get('code');
        const state = url.searchParams.get('state');
        const error = url.searchParams.get('error');

        // Render HTML for failures
        if (error || !code || !state) {
            const errorMsg = error || 'Missing code or state';
            return new Response(
                getHtmlResponse('OAUTH_ERROR', null, null, null, errorMsg),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }

        let decodedState;
        try {
            decodedState = JSON.parse(decodeURIComponent(atob(state)));
        } catch {
            return new Response(
                getHtmlResponse('OAUTH_ERROR', null, null, null, 'Invalid state parameter'),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }

        const provider = decodedState.p;

        // Exchange code for tokens
        const redirectUri = getRedirectUri(req);
        const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });

        const tokenData = await tokenResp.json();

        if (!tokenResp.ok) {
            return new Response(
                getHtmlResponse('OAUTH_ERROR', provider, null, null, tokenData.error_description || tokenData.error),
                { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
            );
        }

        const accessToken = tokenData.access_token;
        const refreshToken = tokenData.refresh_token; 
        const expiresIn = tokenData.expires_in;

        // Return HTML to post message to main window
        return new Response(
            getHtmlResponse('OAUTH_SUCCESS', provider, accessToken, refreshToken, null, expiresIn),
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
    }

    return new Response('Not found', { status: 404 });
});

/**
 * Generates the HTML to post a message back to the opening window and close itself.
 */
function getHtmlResponse(
    type: 'OAUTH_SUCCESS' | 'OAUTH_ERROR', 
    provider: string | null, 
    accessToken: string | null, 
    refreshToken: string | null, 
    errorMsg: string | null,
    expiresIn: number = 3600
) {
    const payload = JSON.stringify({
        type,
        provider,
        accessToken,
        refreshToken,
        expiresIn,
        error: errorMsg
    });

    return `
<!DOCTYPE html>
<html>
<head>
    <title>OAuth Flow</title>
</head>
<body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
    <h2>Completing connection...</h2>
    <p>You can close this window if it doesn't close automatically.</p>
    <script>
        const payload = ${payload};
        if (window.opener) {
            window.opener.postMessage(payload, '*');
        } else {
            console.error('No window.opener found. Are you running this directly?');
        }
        setTimeout(() => window.close(), 1500);
    </script>
</body>
</html>
`;
}
