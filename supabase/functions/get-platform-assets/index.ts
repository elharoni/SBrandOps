/**
 * get-platform-assets Edge Function
 *
 * Reads the stored (encrypted) OAuth token for a brand+platform from oauth_tokens,
 * decrypts it, then calls the provider's API to return the list of available assets
 * (Facebook Pages, Instagram Business Accounts, etc.) that the user can connect.
 *
 * POST /functions/v1/get-platform-assets
 * Body: { brand_id: string, platform: string }
 * Returns: { assets: SocialAsset[] }
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';
import { decryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_GRAPH_VERSION = 'v23.0';

async function fetchFacebookPages(accessToken: string) {
  const url =
    `https://graph.facebook.com/${FB_GRAPH_VERSION}/me/accounts` +
    `?access_token=${encodeURIComponent(accessToken)}` +
    `&fields=id,name,category,fan_count,access_token,picture`;

  const res  = await fetch(url);
  const data = await res.json();
  if (data.error) throw new Error(`Facebook API: ${data.error.message}`);

  return (data.data ?? []).map((page: Record<string, unknown>) => ({
    id:          page.id,
    name:        page.name,
    category:    page.category ?? 'Page',
    followers:   (page.fan_count as number) ?? 0,
    avatarUrl:   (page.picture as any)?.data?.url
                   ?? `https://graph.facebook.com/${page.id}/picture?type=square`,
    accessToken: page.access_token,
  }));
}

async function fetchInstagramAccounts(pages: { id: string; accessToken: string; name: string }[]) {
  const results = await Promise.all(
    pages.map(async page => {
      const url =
        `https://graph.facebook.com/${FB_GRAPH_VERSION}/${page.id}` +
        `?fields=instagram_business_account{id,username,profile_picture_url,followers_count}` +
        `&access_token=${encodeURIComponent(page.accessToken)}`;

      const res  = await fetch(url);
      const data = await res.json();
      const ig   = data?.instagram_business_account;
      if (!ig) return null;

      return {
        id:         ig.id,
        name:       ig.username ?? page.name,
        followers:  ig.followers_count ?? 0,
        avatarUrl:  ig.profile_picture_url,
        accessToken: page.accessToken,
        pageId:     page.id,
      };
    }),
  );
  return results.filter(Boolean);
}

Deno.serve(async (req: Request) => {
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const user = await verifyJWT(req, undefined, corsHeaders);
    if (user instanceof Response) return user;

    // ── Parse body ────────────────────────────────────────────────────────────
    const body                     = await req.json().catch(() => ({}));
    const { brand_id, platform }   = body as { brand_id?: string; platform?: string };

    if (!brand_id || !platform) {
      return new Response(
        JSON.stringify({ error: 'brand_id and platform are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // ── Brand ownership ───────────────────────────────────────────────────────
    const ownershipErr = await assertBrandOwnership(supabase, user.id, brand_id, undefined, corsHeaders);
    if (ownershipErr) return ownershipErr;

    // ── Fetch stored token ────────────────────────────────────────────────────
    const normalizedPlatform = platform.toLowerCase();

    const { data: tokenRow, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('access_token_enc')
      .eq('brand_id', brand_id)
      .eq('platform', normalizedPlatform)
      .eq('is_valid', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (tokenError) throw new Error(`DB error: ${tokenError.message}`);
    if (!tokenRow)  throw new Error(`No valid token found for platform: ${normalizedPlatform}. Please connect your account first.`);

    const accessToken = await decryptToken(tokenRow.access_token_enc);
    if (!accessToken) throw new Error('Failed to decrypt token — check OAUTH_ENCRYPTION_KEY secret');

    // ── Fetch assets from provider API ────────────────────────────────────────
    let assets: unknown[];

    if (normalizedPlatform === 'facebook') {
      assets = await fetchFacebookPages(accessToken);
    } else if (normalizedPlatform === 'instagram') {
      const pages = await fetchFacebookPages(accessToken);
      assets      = await fetchInstagramAccounts(pages);
    } else {
      throw new Error(`Asset fetching for platform "${normalizedPlatform}" is not yet supported`);
    }

    return new Response(JSON.stringify({ assets }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[get-platform-assets]', (err as Error).message);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
