/**
 * publish-now Edge Function
 * Unified immediate publishing with retries and structured results.
 *
 * Security:
 * - Requires valid Supabase JWT (Authorization: Bearer <token>)
 * - Verifies brand ownership before publishing
 * - Restricts CORS to FRONTEND_ORIGIN
 * - Enforces request body size limit (512 KB)
 * - Enforces platforms array length limit (<= 10)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';
import { decryptToken } from '../_shared/tokens.ts';
import { validateMediaUrls, validatePlatformsLength } from '../_shared/validation.ts';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const MAX_BODY_BYTES = 512 * 1024; // 512 KB
const MAX_PLATFORMS = 10;

type ScheduledPostInput = {
  content: string;
  platforms: string[];
  media_urls?: string[];
  instagram_first_comment?: string;
  scheduled_at?: string;
};

type PublishResult = {
  platform: string;
  success: boolean;
  post_id?: string;
  platform_url?: string;
  error?: string;
  duration_ms?: number;
};

const retryDelaysMs = [0, 5000, 20000];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function withRetry<T>(operation: () => Promise<T>, retries = 2): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= retries) throw error;
      attempt += 1;
      await sleep(retryDelaysMs[attempt] ?? retryDelaysMs[retryDelaysMs.length - 1]);
    }
  }
}


async function publishToFacebook(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) return { platform: 'Facebook', success: false, error: 'No token' };

  const pageId = account.platform_account_id ?? 'me';

  if (post.media_urls?.length === 1) {
    // Single photo post — upload directly via /photos
    const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: post.media_urls[0],
        message: post.content,
        access_token: account.access_token,
      }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      return { platform: 'Facebook', success: false, error: result.error?.message || 'Facebook photo upload error' };
    }
    const postId = result.post_id || result.id;
    return { platform: 'Facebook', success: true, post_id: postId, platform_url: `https://facebook.com/${postId}` };
  }

  if (post.media_urls && post.media_urls.length > 1) {
    // Multiple photos — upload each unpublished, then attach to a feed post
    const photoIds: string[] = [];
    for (const mediaUrl of post.media_urls) {
      const photoRes = await fetch(`https://graph.facebook.com/v19.0/${pageId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: mediaUrl, published: false, access_token: account.access_token }),
      });
      const photo = await photoRes.json();
      if (!photoRes.ok || photo.error) {
        return { platform: 'Facebook', success: false, error: photo.error?.message || 'Facebook photo upload error' };
      }
      photoIds.push(photo.id);
    }

    const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: post.content,
        attached_media: photoIds.map(id => ({ media_fbid: id })),
        access_token: account.access_token,
      }),
    });
    const result = await response.json();
    if (!response.ok || result.error) {
      return { platform: 'Facebook', success: false, error: result.error?.message || 'Facebook API error' };
    }
    return { platform: 'Facebook', success: true, post_id: result.id, platform_url: `https://facebook.com/${result.id}` };
  }

  // Text-only post
  const response = await fetch(`https://graph.facebook.com/v19.0/${pageId}/feed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: post.content, access_token: account.access_token }),
  });
  const result = await response.json();
  if (!response.ok || result.error) {
    return { platform: 'Facebook', success: false, error: result.error?.message || 'Facebook API error' };
  }
  return { platform: 'Facebook', success: true, post_id: result.id, platform_url: `https://facebook.com/${result.id}` };
}

async function publishToInstagram(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) return { platform: 'Instagram', success: false, error: 'No token' };
  if (!post.media_urls?.length) return { platform: 'Instagram', success: false, error: 'Instagram requires media_urls' };

  const targetAccountId = account.platform_account_id ?? account.id;

  const containerResponse = await fetch(`https://graph.facebook.com/v19.0/${targetAccountId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caption: post.content,
      image_url: post.media_urls[0],
      access_token: account.access_token,
    }),
  });
  const container = await containerResponse.json();

  if (!containerResponse.ok || container.error) {
    return { platform: 'Instagram', success: false, error: container.error?.message || 'Instagram container error' };
  }

  const publishResponse = await fetch(`https://graph.facebook.com/v19.0/${targetAccountId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: container.id, access_token: account.access_token }),
  });
  const published = await publishResponse.json();

  if (!publishResponse.ok || published.error) {
    return { platform: 'Instagram', success: false, error: published.error?.message || 'Instagram publish error' };
  }

  if (post.instagram_first_comment && published.id) {
    await fetch(`https://graph.facebook.com/v19.0/${published.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: post.instagram_first_comment, access_token: account.access_token }),
    });
  }

  return {
    platform: 'Instagram',
    success: true,
    post_id: published.id,
    platform_url: `https://instagram.com/p/${published.id}`,
  };
}

async function publishToLinkedIn(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) return { platform: 'LinkedIn', success: false, error: 'No token' };

  const response = await fetch('https://api.linkedin.com/v2/ugcPosts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify({
      author: `urn:li:organization:${account.platform_account_id ?? account.id}`,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary: { text: post.content },
          shareMediaCategory: post.media_urls?.length ? 'IMAGE' : 'NONE',
        },
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    return { platform: 'LinkedIn', success: false, error: result.message || 'LinkedIn API error' };
  }

  return { platform: 'LinkedIn', success: true, post_id: result.id };
}

async function publishToX(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) return { platform: 'X', success: false, error: 'No token' };

  const response = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: post.content.slice(0, 280) }),
  });
  const result = await response.json();

  if (!response.ok || result.errors) {
    return { platform: 'X', success: false, error: result.errors?.[0]?.message || 'X API error' };
  }

  return { platform: 'X', success: true, post_id: result.data?.id };
}

async function publishToTikTok(_post: ScheduledPostInput): Promise<PublishResult> {
  return { platform: 'TikTok', success: false, error: 'TikTok server-side upload not implemented in v1' };
}

// ── دالة الجلب: oauth_tokens هو المصدر الوحيد للتوكنات ──────────────
async function getAccountWithToken(brandId: string, platform: string): Promise<any | null> {
  const { data: oauthToken } = await supabase
    .from('oauth_tokens')
    .select('access_token, access_token_enc, provider_account_id, provider_name, id')
    .eq('brand_id', brandId)
    .eq('provider', platform)
    .eq('is_valid', true)
    .maybeSingle();

  if (!oauthToken) return null;

  // enc column preferred; fall back to plaintext for pre-migration rows
  const token = oauthToken.access_token_enc
    ? await decryptToken(oauthToken.access_token_enc)
    : oauthToken.access_token;

  if (!token) return null;

  return {
    access_token: token,
    platform_account_id: oauthToken.provider_account_id,
    username: oauthToken.provider_name,
    oauth_token_id: oauthToken.id,
  };
}

// ── تسجيل النتيجة في platform_publish_results ──────────────────
async function savePublishResult(
  postId: string,
  brandId: string,
  platform: string,
  result: PublishResult,
  durationMs: number,
  retryCount = 0,
) {
  const status = result.success ? 'success' : 'failed';

  await supabase.from('platform_publish_results').upsert({
    post_id: postId,
    brand_id: brandId,
    platform: platform.toLowerCase(),
    platform_post_id: result.post_id ?? null,
    platform_url: result.platform_url ?? null,
    status,
    error_code: result.success ? null : 'PUBLISH_ERROR',
    error_message: result.error ?? null,
    retry_count: retryCount,
    attempted_at: new Date().toISOString(),
    published_at: result.success ? new Date().toISOString() : null,
    duration_ms: durationMs,
    response_raw: result as unknown as Record<string, unknown>,
  }, { onConflict: 'post_id,platform' });
}

// Returns the set of platforms already successfully published for a given post.
async function getAlreadyPublishedPlatforms(postId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('platform_publish_results')
    .select('platform')
    .eq('post_id', postId)
    .eq('status', 'success');
  return new Set((data ?? []).map((r: { platform: string }) => r.platform.toLowerCase()));
}

async function handlePublish(
  brandId: string,
  postId: string | null,
  post: ScheduledPostInput
): Promise<PublishResult[]> {
  validateMediaUrls(post.media_urls);

  // Idempotency: skip platforms that were already successfully published.
  const alreadyPublished = postId
    ? await getAlreadyPublishedPlatforms(postId)
    : new Set<string>();

  const results: PublishResult[] = [];

  for (const platform of post.platforms) {
    if (alreadyPublished.has(platform.toLowerCase())) {
      results.push({ platform, success: true, post_id: undefined, error: undefined });
      continue;
    }

    const t0 = Date.now();
    const account = await getAccountWithToken(brandId, platform);

    if (!account) {
      const result: PublishResult = { platform, success: false, error: 'No connected account' };
      results.push(result);
      if (postId) await savePublishResult(postId, brandId, platform, result, Date.now() - t0);
      continue;
    }

    let retryCount = 0;
    try {
      const result = await withRetry(async () => {
        retryCount++;
        if (platform === 'Facebook')  return publishToFacebook(account, post);
        if (platform === 'Instagram') return publishToInstagram(account, post);
        if (platform === 'LinkedIn')  return publishToLinkedIn(account, post);
        if (platform === 'X')         return publishToX(account, post);
        return publishToTikTok(post);
      });
      const durationMs = Date.now() - t0;
      result.duration_ms = durationMs;
      results.push(result);
      if (postId) await savePublishResult(postId, brandId, platform, result, durationMs, retryCount - 1);
    } catch (error) {
      const result: PublishResult = {
        platform,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - t0,
      };
      results.push(result);
      if (postId) await savePublishResult(postId, brandId, platform, result, Date.now() - t0, retryCount - 1);
    }
  }

  const successCount = results.filter(r => r.success).length;
  if (successCount > 0) {
    await supabase.rpc('increment_usage_counter', {
      p_brand: brandId,
      p_metric: 'publish_ops',
      p_delta: successCount,
    });
  }

  return results;
}


// CORS headers are built per-request via buildCorsHeaders() from _shared/auth.ts

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();
  const corsHeaders = buildCorsHeaders(req.headers.get('Origin'));

  // ── CORS preflight ─────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // ── JWT verification ────────────────────────────────────────────────────────
  const userOrError = await verifyJWT(req, correlationId);
  if (userOrError instanceof Response) return userOrError;

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // ── Request size guard ──────────────────────────────────────────────────
    const contentLength = Number(req.headers.get('content-length') ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return new Response(JSON.stringify({ error: 'Request body too large' }), {
        status: 413,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    const { brand_id, post_id, post } = await req.json();

    if (!brand_id || !post?.content || !Array.isArray(post.platforms)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    // ── Platforms array length guard ────────────────────────────────────────
    try {
      validatePlatformsLength(post.platforms, MAX_PLATFORMS);
    } catch (e) {
      return new Response(JSON.stringify({ error: (e as Error).message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Correlation-Id': correlationId },
      });
    }

    // ── Brand ownership check ───────────────────────────────────────────────
    const ownershipError = await assertBrandOwnership(supabase, userOrError.id, brand_id, correlationId);
    if (ownershipError) return ownershipError;

    const results = await handlePublish(brand_id, post_id ?? null, post as ScheduledPostInput);

    // إذا كان هناك scheduled_at، احفظ في scheduled_posts
    if (post.scheduled_at) {
      await supabase.from('scheduled_posts').insert({
        brand_id,
        content: post.content,
        platforms: post.platforms,
        media_urls: post.media_urls ?? [],
        status: results.every(r => r.success)
          ? 'Published'
          : (results.some(r => r.success) ? 'PartiallyPublished' : 'Failed'),
        publish_results: results,
        published_at: new Date().toISOString(),
      });
    }

    console.log(JSON.stringify({
      correlationId,
      event: 'publish-now',
      userId: userOrError.id,
      brandId: brand_id,
      latency_ms: Date.now() - startedAt,
      publish_success_rate: results.length ? results.filter(r => r.success).length / results.length : 0,
    }));

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
        'X-Latency': String(Date.now() - startedAt),
      },
    });
  } catch (error) {
    console.error(JSON.stringify({
      correlationId,
      event: 'publish-now-error',
      latency_ms: Date.now() - startedAt,
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

