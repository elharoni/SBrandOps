/**
 * connect-accounts Edge Function
 * يحفظ الحسابات المتصلة في جدولين:
 * 1. social_accounts  — للعرض وبيانات الحساب
 * 2. oauth_tokens     — للتوكنات المستخدمة في النشر الحقيقي
 *
 * Security:
 * - Requires valid Supabase JWT
 * - Verifies brand ownership before writing
 * - Restricts CORS to FRONTEND_ORIGIN
 * - Limits assets array to MAX_ASSETS items
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';
import { encryptToken } from '../_shared/tokens.ts'; // used by oauth_tokens only

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_ASSETS = 50;

type SocialAsset = {
  id: string;
  name: string;
  followers?: number;
  avatarUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;   // ISO timestamp
  scopes?: string[];
};

type Payload = {
  brand_id: string;
  platform: string;
  assets: SocialAsset[];
  user_token?: string;
  user_refresh_token?: string;
  token_expires_at?: string;
  scopes?: string[];
};

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── JWT verification ──────────────────────────────────────────────────────
  const userOrError = await verifyJWT(req, correlationId);
  if (userOrError instanceof Response) return userOrError;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const body = await req.json() as Payload;
    if (!body.brand_id || !body.platform || !Array.isArray(body.assets) || body.assets.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    // ── Assets array length guard ─────────────────────────────────────────
    if (body.assets.length > MAX_ASSETS) {
      return new Response(JSON.stringify({ error: `assets array must not exceed ${MAX_ASSETS} items` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    // ── Brand ownership check ─────────────────────────────────────────────
    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, body.brand_id, correlationId);
    if (ownershipError) return ownershipError;

    // ── 1. حفظ في social_accounts (display data only — no tokens) ──
    const socialRows = body.assets.map(asset => ({
      brand_id: body.brand_id,
      platform: body.platform,
      platform_user_id: asset.id,
      username: asset.name,
      avatar_url: asset.avatarUrl ?? null,
      followers_count: asset.followers ?? 0,
      platform_account_id: asset.id,
      access_token: null,
      refresh_token: null,
      access_token_enc: null,
      refresh_token_enc: null,
      token_expires_at: asset.expiresAt ?? body.token_expires_at ?? null,
      status: 'Connected',
    }));

    const { data: socialData, error: socialError } = await supabase
      .from('social_accounts')
      .upsert(socialRows, { onConflict: 'brand_id,platform,platform_user_id' })
      .select('id, platform, username, avatar_url, followers_count, status');

    if (socialError) throw socialError;

    // ── 2. حفظ في oauth_tokens (encrypted) ───────────────────────
    const oauthRows = (await Promise.all(body.assets.map(async asset => {
      const rawAccess = asset.accessToken ?? body.user_token;
      if (!rawAccess) return null;

      const matchedAccount = socialData?.find(a => a.username === asset.name);

      return {
        brand_id: body.brand_id,
        social_account_id: matchedAccount?.id ?? null,
        provider: body.platform,
        provider_account_id: asset.id,
        provider_name: asset.name,
        access_token: null,           // cleared — use enc column
        refresh_token: null,          // cleared — use enc column
        access_token_enc: await encryptToken(rawAccess),
        refresh_token_enc: await encryptToken(asset.refreshToken ?? body.user_refresh_token ?? null),
        token_type: 'bearer',
        scopes: asset.scopes ?? body.scopes ?? [],
        expires_at: asset.expiresAt ?? body.token_expires_at ?? null,
        is_valid: true,
        raw_metadata: {
          connected_at: new Date().toISOString(),
          correlation_id: correlationId,
        },
      };
    }))).filter(Boolean);

    if (oauthRows.length > 0) {
      const { error: oauthError } = await supabase
        .from('oauth_tokens')
        .upsert(oauthRows, { onConflict: 'brand_id,provider,provider_account_id' });

      if (oauthError) {
        // نسجّل الخطأ لكن لا نوقف العملية
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
      userId: userOrError.id,
      inserted: socialData?.length ?? 0,
      oauth_tokens_saved: oauthRows.length,
      platform: body.platform,
    }));
    // NOTE: raw tokens are NOT logged to prevent credential leakage

    return new Response(JSON.stringify({
      inserted: socialData?.length ?? 0,
      accounts: socialData,
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
