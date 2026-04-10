/**
 * publish-now Edge Function
 * Unified immediate publishing with retries and structured results.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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
  error?: string;
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
      if (attempt >= retries) {
        throw error;
      }

      attempt += 1;
      await sleep(retryDelaysMs[attempt] ?? retryDelaysMs[retryDelaysMs.length - 1]);
    }
  }
}

function validateMediaUrls(mediaUrls?: string[]) {
  if (!mediaUrls?.length) {
    return;
  }

  if (mediaUrls.some(url => url.startsWith('blob:'))) {
    throw new Error('Blob URLs are not supported. Upload media to storage first.');
  }
}

async function publishToFacebook(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) {
    return { platform: 'Facebook', success: false, error: 'No token' };
  }

  const body: Record<string, unknown> = {
    message: post.content,
    access_token: account.access_token,
  };

  if (post.media_urls?.length) {
    body.link = post.media_urls[0];
  }

  const response = await fetch('https://graph.facebook.com/v19.0/me/feed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();

  if (!response.ok || result.error) {
    return { platform: 'Facebook', success: false, error: result.error?.message || 'Facebook API error' };
  }

  return { platform: 'Facebook', success: true, post_id: result.id };
}

async function publishToInstagram(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) {
    return { platform: 'Instagram', success: false, error: 'No token' };
  }
  if (!post.media_urls?.length) {
    return { platform: 'Instagram', success: false, error: 'Instagram requires media_urls' };
  }

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
    body: JSON.stringify({
      creation_id: container.id,
      access_token: account.access_token,
    }),
  });
  const published = await publishResponse.json();

  if (!publishResponse.ok || published.error) {
    return { platform: 'Instagram', success: false, error: published.error?.message || 'Instagram publish error' };
  }

  if (post.instagram_first_comment && published.id) {
    await fetch(`https://graph.facebook.com/v19.0/${published.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: post.instagram_first_comment,
        access_token: account.access_token,
      }),
    });
  }

  return { platform: 'Instagram', success: true, post_id: published.id };
}

async function publishToLinkedIn(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) {
    return { platform: 'LinkedIn', success: false, error: 'No token' };
  }

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
      visibility: {
        'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
      },
    }),
  });
  const result = await response.json();

  if (!response.ok) {
    return { platform: 'LinkedIn', success: false, error: result.message || 'LinkedIn API error' };
  }

  return { platform: 'LinkedIn', success: true, post_id: result.id };
}

async function publishToX(account: any, post: ScheduledPostInput): Promise<PublishResult> {
  if (!account.access_token) {
    return { platform: 'X', success: false, error: 'No token' };
  }

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

async function publishToTikTok(post: ScheduledPostInput): Promise<PublishResult> {
  if (!post.media_urls?.length) {
    return { platform: 'TikTok', success: false, error: 'TikTok requires video media' };
  }

  return { platform: 'TikTok', success: false, error: 'TikTok server-side upload not implemented in v1' };
}

async function handlePublish(brandId: string, post: ScheduledPostInput): Promise<PublishResult[]> {
  validateMediaUrls(post.media_urls);

  const { data: accounts, error } = await supabase
    .from('social_accounts')
    .select('id, brand_id, platform, username, platform_account_id, access_token')
    .eq('brand_id', brandId)
    .in('platform', post.platforms);

  if (error) {
    throw error;
  }

  if (!accounts?.length) {
    return post.platforms.map(platform => ({ platform, success: false, error: 'No connected account' }));
  }

  const results: PublishResult[] = [];
  for (const platform of post.platforms) {
    const account = accounts.find((item: any) => item.platform === platform);
    if (!account) {
      results.push({ platform, success: false, error: 'Account not connected' });
      continue;
    }

    try {
      const result = await withRetry(() => {
        if (platform === 'Facebook') return publishToFacebook(account, post);
        if (platform === 'Instagram') return publishToInstagram(account, post);
        if (platform === 'LinkedIn') return publishToLinkedIn(account, post);
        if (platform === 'X') return publishToX(account, post);
        return publishToTikTok(post);
      });
      results.push(result);
    } catch (error) {
      results.push({
        platform,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  const successCount = results.filter(result => result.success).length;
  if (successCount > 0) {
    await supabase.rpc('increment_usage_counter', {
      p_brand: brandId,
      p_metric: 'publish_ops',
      p_delta: successCount,
    });
  }

  return results;
}

Deno.serve(async (req: Request) => {
  const correlationId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    if (req.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const { brand_id, post } = await req.json();
    if (!brand_id || !post?.content || !Array.isArray(post.platforms)) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'X-Correlation-Id': correlationId,
        },
      });
    }

    const results = await handlePublish(brand_id, post as ScheduledPostInput);

    if (post.scheduled_at) {
      await supabase.from('scheduled_posts').insert({
        brand_id,
        content: post.content,
        platforms: post.platforms,
        media_urls: post.media_urls ?? [],
        status: results.every(result => result.success)
          ? 'Published'
          : (results.some(result => result.success) ? 'PartiallyPublished' : 'Failed'),
        publish_results: results,
        published_at: new Date().toISOString(),
      });
    }

    console.log(JSON.stringify({
      correlationId,
      event: 'publish-now',
      latency_ms: Date.now() - startedAt,
      retry_count: retryDelaysMs.length - 1,
      publish_success_rate: results.length ? results.filter(result => result.success).length / results.length : 0,
      results,
    }));

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
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
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-Id': correlationId,
      },
    });
  }
});
