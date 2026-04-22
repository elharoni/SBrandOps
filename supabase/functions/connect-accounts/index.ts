/**
 * connect-accounts Edge Function
 * يحفظ الحسابات المتصلة في جدولين:
 * 1. social_accounts  — Asset Registry (نوع الأصل + الوظيفة + السوق)
 * 2. oauth_tokens     — للتوكنات المشفرة
 *
 * Security:
 * - Requires valid Supabase JWT
 * - Verifies brand ownership before writing
 * - Restricts CORS to FRONTEND_ORIGIN
 * - Limits assets array to MAX_ASSETS items
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';
import { encryptToken } from '../_shared/tokens.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_ASSETS = 50;

const VALID_ASSET_TYPES = [
  'page', 'ig_account', 'ad_account', 'pixel', 'store',
  'site', 'inbox_channel', 'youtube_channel', 'tiktok_account',
  'linkedin_page', 'x_account',
] as const;

const VALID_PURPOSES = [
  'publishing', 'inbox', 'analytics', 'commerce', 'ads', 'seo',
] as const;

const VALID_SYNC_STATUSES = [
  'active', 'needs_reconnect', 'token_expired', 'scope_missing',
  'webhook_inactive', 'partial_sync', 'sync_delayed', 'disconnected',
] as const;

type AssetType = typeof VALID_ASSET_TYPES[number];
type AssetPurpose = typeof VALID_PURPOSES[number];

type SocialAsset = {
  id: string;
  name: string;
  followers?: number;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
  pageId?: string;  // Facebook Page ID for Instagram assets
  // Integration OS fields
  assetType?: AssetType;
  purposes?: AssetPurpose[];
  market?: string;
  isPrimary?: boolean;
};

type Payload = {
  brand_id: string;
  platform: string;
  assets: SocialAsset[];
  user_token?: string;
  user_refresh_token?: string;
  token_expires_at?: string;
  scopes?: string[];
  // Default purpose/type for all assets if not specified per-asset
  default_asset_type?: AssetType;
  default_purposes?: AssetPurpose[];
  default_market?: string;
};

const FB_GRAPH_VERSION = 'v23.0';

/**
 * Exchanges a short-lived Facebook User Access Token (~2 hrs) for a
 * long-lived one (~60 days).  Requires FACEBOOK_APP_ID + FACEBOOK_APP_SECRET
 * in Supabase Edge Function secrets.  Fails silently — returns the original
 * token unchanged so the rest of the flow still works without the secrets.
 */
async function exchangeToLongLivedToken(
  shortToken: string,
): Promise<{ token: string; expiresAt: string | null }> {
  const appId = Deno.env.get('FACEBOOK_APP_ID');
  const appSecret = Deno.env.get('FACEBOOK_APP_SECRET');
  if (!appId || !appSecret) {
    return { token: shortToken, expiresAt: null };
  }

  try {
    const url = new URL(`https://graph.facebook.com/${FB_GRAPH_VERSION}/oauth/access_token`);
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', shortToken);

    const resp = await fetch(url.toString());
    if (!resp.ok) return { token: shortToken, expiresAt: null };

    const data = await resp.json();
    if (!data.access_token) return { token: shortToken, expiresAt: null };

    const expiresAt = data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null;

    return { token: data.access_token, expiresAt };
  } catch {
    return { token: shortToken, expiresAt: null };
  }
}

/**
 * Fetches a long-lived Page Access Token using a long-lived User Access Token.
 * The returned page token is permanent (never expires unless permissions revoked).
 */
async function fetchServerPageToken(
  pageId: string,
  longLivedUserToken: string,
): Promise<string | null> {
  try {
    const url = new URL(`https://graph.facebook.com/${FB_GRAPH_VERSION}/${pageId}`);
    url.searchParams.set('fields', 'access_token');
    url.searchParams.set('access_token', longLivedUserToken);

    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.access_token ?? null;
  } catch {
    return null;
  }
}

/** من platform تخمّن asset_type الافتراضي */
function inferAssetType(platform: string, explicit?: AssetType): AssetType {
  if (explicit && (VALID_ASSET_TYPES as readonly string[]).includes(explicit)) return explicit;
  const p = platform.toLowerCase();
  if (p.includes('instagram')) return 'ig_account';
  if (p.includes('tiktok'))    return 'tiktok_account';
  if (p.includes('linkedin'))  return 'linkedin_page';
  if (p.includes('x') || p.includes('twitter')) return 'x_account';
  if (p.includes('youtube'))   return 'youtube_channel';
  return 'page';
}

/** تحقق من صحة الـ purposes */
function sanitizePurposes(raw?: string[]): AssetPurpose[] {
  if (!raw || raw.length === 0) return ['publishing', 'analytics'];
  return raw.filter((p): p is AssetPurpose =>
    (VALID_PURPOSES as readonly string[]).includes(p)
  );
}

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── Encryption key pre-flight check ──────────────────────────────────────
  const encKey = Deno.env.get('OAUTH_ENCRYPTION_KEY');
  if (!encKey || encKey.length < 64) {
    console.error(JSON.stringify({ correlationId, event: 'missing-encryption-key' }));
    return new Response(JSON.stringify({
      error: 'Server misconfiguration: OAUTH_ENCRYPTION_KEY is not set.',
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
  }

  // ── JWT verification ──────────────────────────────────────────────────────
  const userOrError = await verifyJWT(req, correlationId);
  if (userOrError instanceof Response) return userOrError;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const body = await req.json() as Payload;
    if (!body.brand_id || !body.platform || !Array.isArray(body.assets) || body.assets.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    if (body.assets.length > MAX_ASSETS) {
      return new Response(JSON.stringify({ error: `assets array must not exceed ${MAX_ASSETS} items` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    // ── Brand ownership check ─────────────────────────────────────────────
    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, body.brand_id, correlationId);
    if (ownershipError) return ownershipError;

    // ── Token exchange: short-lived → long-lived (Facebook / Instagram) ──
    // Page tokens derived from a long-lived user token are permanent.
    let resolvedUserToken = body.user_token ?? null;
    let resolvedTokenExpiresAt = body.token_expires_at ?? null;

    const isFbPlatform = body.platform.toLowerCase().includes('facebook')
      || body.platform.toLowerCase().includes('instagram');

    if (isFbPlatform && resolvedUserToken) {
      const exchanged = await exchangeToLongLivedToken(resolvedUserToken);
      resolvedUserToken = exchanged.token;
      if (exchanged.expiresAt) resolvedTokenExpiresAt = exchanged.expiresAt;

      // Re-fetch page tokens server-side using the long-lived user token
      body.assets = await Promise.all(body.assets.map(async (asset) => {
        // For Facebook assets: asset.id IS the page ID
        // For Instagram assets: asset.pageId holds the linked FB page ID
        const pageId = asset.pageId ?? (body.platform.toLowerCase().includes('facebook') ? asset.id : null);
        if (!pageId) return asset;
        const freshPageToken = await fetchServerPageToken(pageId, resolvedUserToken!);
        return freshPageToken ? { ...asset, accessToken: freshPageToken, expiresAt: undefined } : asset;
      }));
    }

    // ── 1. حفظ في social_accounts (Asset Registry) ───────────────────────
    const socialRows = body.assets.map(asset => ({
      brand_id:          body.brand_id,
      platform:          body.platform,
      platform_user_id:  asset.id,
      username:          asset.name,
      avatar_url:        asset.avatarUrl ?? null,
      followers_count:   asset.followers ?? 0,
      platform_account_id: asset.id,
      access_token:      null,
      refresh_token:     null,
      access_token_enc:  null,
      refresh_token_enc: null,
      token_expires_at:  asset.expiresAt ?? resolvedTokenExpiresAt ?? null,
      status:            'Connected',
      // Integration OS fields
      asset_type:        inferAssetType(body.platform, asset.assetType ?? body.default_asset_type),
      purposes:          sanitizePurposes(asset.purposes ?? body.default_purposes),
      market:            asset.market ?? body.default_market ?? null,
      is_primary:        asset.isPrimary ?? false,
      sync_status:       'active',
      last_synced_at:    new Date().toISOString(),
      scopes_granted:    asset.scopes ?? body.scopes ?? [],
    }));

    const { data: socialData, error: socialError } = await supabase
      .from('social_accounts')
      .upsert(socialRows, { onConflict: 'brand_id,platform,platform_user_id' })
      .select('id, platform, username, avatar_url, followers_count, status, asset_type, purposes, sync_status');

    if (socialError) throw socialError;

    // ── 2. حفظ في oauth_tokens (encrypted) ───────────────────────────────
    const oauthRows = (await Promise.all(body.assets.map(async asset => {
      const rawAccess = asset.accessToken ?? resolvedUserToken;
      if (!rawAccess) return null;

      const matchedAccount = socialData?.find(a => a.username === asset.name);

      return {
        brand_id:            body.brand_id,
        social_account_id:   matchedAccount?.id ?? null,
        provider:            body.platform,
        provider_account_id: asset.id,
        provider_name:       asset.name,
        access_token:        null,
        refresh_token:       null,
        access_token_enc:    await encryptToken(rawAccess),
        refresh_token_enc:   await encryptToken(asset.refreshToken ?? body.user_refresh_token ?? null),
        token_type:          'bearer',
        scopes:              asset.scopes ?? body.scopes ?? [],
        expires_at:          asset.expiresAt ?? resolvedTokenExpiresAt ?? null,
        is_valid:            true,
        raw_metadata: {
          connected_at:    new Date().toISOString(),
          correlation_id:  correlationId,
          asset_type:      inferAssetType(body.platform, asset.assetType ?? body.default_asset_type),
          purposes:        sanitizePurposes(asset.purposes ?? body.default_purposes),
        },
      };
    }))).filter(Boolean);

    if (oauthRows.length > 0) {
      const { error: oauthError } = await supabase
        .from('oauth_tokens')
        .upsert(oauthRows, { onConflict: 'brand_id,provider,provider_account_id' });

      if (oauthError) {
        console.error(JSON.stringify({
          correlationId,
          event: 'oauth-tokens-upsert-error',
          error: oauthError.message,
        }));
      }
    }

    console.log(JSON.stringify({
      correlationId,
      event: 'connect-accounts',
      userId:             userOrError.id,
      inserted:           socialData?.length ?? 0,
      oauth_tokens_saved: oauthRows.length,
      platform:           body.platform,
      asset_types:        socialRows.map(r => r.asset_type),
      purposes:           socialRows.map(r => r.purposes),
    }));

    return new Response(JSON.stringify({
      inserted:           socialData?.length ?? 0,
      accounts:           socialData,
      oauth_tokens_saved: oauthRows.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });

  } catch (error) {
    console.error(JSON.stringify({
      correlationId,
      event: 'connect-accounts-error',
      error: error instanceof Error ? error.message : 'Server error',
    }));

    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : 'Server error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
  }
});
