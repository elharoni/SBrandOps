/**
 * connect-accounts Edge Function
 * Inserts or updates connected social accounts using the service role.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

type SocialAsset = {
  id: string;
  name: string;
  followers?: number;
  avatarUrl?: string;
  accessToken?: string;
};

type Payload = {
  brand_id: string;
  platform: string;
  assets: SocialAsset[];
  user_token?: string;
};

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await req.json() as Payload;
    if (!body.brand_id || !body.platform || !Array.isArray(body.assets) || body.assets.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    const rows = body.assets.map(asset => ({
      brand_id: body.brand_id,
      platform: body.platform,
      platform_user_id: asset.id,
      username: asset.name,
      avatar_url: asset.avatarUrl ?? null,
      followers_count: asset.followers ?? 0,
      platform_account_id: asset.id,
      access_token: asset.accessToken ?? body.user_token ?? null,
      status: 'Connected',
      token_expires_at: null,
    }));

    const { data, error } = await supabase
      .from('social_accounts')
      .upsert(rows, { onConflict: 'brand_id,platform,platform_user_id' })
      .select('id, platform, username, avatar_url, followers_count, status');

    if (error) {
      throw error;
    }

    console.log(JSON.stringify({
      correlationId,
      event: 'connect-accounts',
      inserted: data?.length ?? 0,
      platform: body.platform,
    }));

    return new Response(JSON.stringify({
      inserted: data?.length ?? 0,
      accounts: data,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
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
      headers: { 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
    });
  }
});
