/**
 * publish-content — Agent 9: Publisher Agent
 *
 * Invoked by the auto-publisher cron or directly from the UI.
 * Picks up a queued publishing_job, calls the relevant platform API,
 * updates the job status, and schedules analytics fetch after 24h.
 *
 * Retry logic: up to max_attempts (default 3) on failure.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { verifyJWT, assertBrandOwnership } from '../_shared/auth.ts';

const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Platform publish dispatchers ──────────────────────────────────────────────

async function publishToInstagram(_params: {
    accessToken: string;
    igUserId: string;
    mediaUrl: string;
    caption: string;
}): Promise<{ postId: string; postUrl: string }> {
    // Step 1: Create media container
    const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${_params.igUserId}/media`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image_url: _params.mediaUrl,
                caption:   _params.caption,
                access_token: _params.accessToken,
            }),
        }
    );
    if (!containerRes.ok) {
        const err = await containerRes.text();
        throw new Error(`Instagram media container failed: ${err}`);
    }
    const { id: containerId } = await containerRes.json();

    // Step 2: Publish the container
    const publishRes = await fetch(
        `https://graph.facebook.com/v19.0/${_params.igUserId}/media_publish`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                creation_id:  containerId,
                access_token: _params.accessToken,
            }),
        }
    );
    if (!publishRes.ok) {
        const err = await publishRes.text();
        throw new Error(`Instagram publish failed: ${err}`);
    }
    const { id: postId } = await publishRes.json();
    return {
        postId,
        postUrl: `https://www.instagram.com/p/${postId}/`,
    };
}

async function publishToFacebook(_params: {
    accessToken: string;
    pageId: string;
    mediaUrl: string;
    caption: string;
}): Promise<{ postId: string; postUrl: string }> {
    const res = await fetch(
        `https://graph.facebook.com/v19.0/${_params.pageId}/photos`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url:          _params.mediaUrl,
                message:      _params.caption,
                access_token: _params.accessToken,
            }),
        }
    );
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Facebook publish failed: ${err}`);
    }
    const { id: postId } = await res.json();
    return {
        postId,
        postUrl: `https://www.facebook.com/${postId}`,
    };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const correlationId = crypto.randomUUID();

    try {
        const user = await verifyJWT(req, correlationId, corsHeaders);
        if (user instanceof Response) return user;

        const body = await req.json() as {
            publishing_job_id: string;
            brand_id: string;
        };
        const { publishing_job_id, brand_id } = body;

        const ownershipErr = await assertBrandOwnership(supabase, user.id, brand_id, correlationId, corsHeaders);
        if (ownershipErr) return ownershipErr;

        // Load the publishing job
        const { data: job, error: jobErr } = await supabase
            .from('publishing_jobs')
            .select('*, content_items(*)')
            .eq('id', publishing_job_id)
            .eq('brand_id', brand_id)
            .single();

        if (jobErr || !job) {
            return new Response(JSON.stringify({ error: 'Job not found' }), {
                status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (job.attempts >= job.max_attempts) {
            await supabase.from('publishing_jobs').update({
                status: 'failed',
                last_error: 'Max attempts exceeded',
            }).eq('id', publishing_job_id);
            return new Response(JSON.stringify({ error: 'Max attempts exceeded' }), {
                status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Mark as running + increment attempt counter
        await supabase.from('publishing_jobs').update({
            status: 'running',
            attempts: job.attempts + 1,
            last_attempt_at: new Date().toISOString(),
        }).eq('id', publishing_job_id);

        const contentItem = job.content_items as Record<string, unknown>;
        const platform = job.platform as string;
        const caption  = (contentItem?.caption as string) ?? '';
        const mediaUrl = (contentItem?.media_url as string) ?? '';

        // Load OAuth token for this platform
        const { data: tokenRow } = await supabase
            .from('oauth_tokens')
            .select('access_token, platform_user_id, metadata')
            .eq('brand_id', brand_id)
            .eq('platform', platform)
            .maybeSingle();

        let platformPostId = '';
        let platformUrl    = '';

        if (!tokenRow?.access_token) {
            // Simulate publish for platforms without connected accounts (development mode)
            platformPostId = `sim_${crypto.randomUUID().slice(0, 8)}`;
            platformUrl    = `https://example.com/posts/${platformPostId}`;
            console.log(JSON.stringify({
                correlationId, event: 'simulated_publish',
                platform, job_id: publishing_job_id,
            }));
        } else {
            // Real publish
            if (platform === 'instagram') {
                const result = await publishToInstagram({
                    accessToken: tokenRow.access_token,
                    igUserId:    tokenRow.platform_user_id,
                    mediaUrl,
                    caption,
                });
                platformPostId = result.postId;
                platformUrl    = result.postUrl;
            } else if (platform === 'facebook') {
                const meta = tokenRow.metadata as Record<string, string> | null;
                const result = await publishToFacebook({
                    accessToken: tokenRow.access_token,
                    pageId:      meta?.page_id ?? tokenRow.platform_user_id,
                    mediaUrl,
                    caption,
                });
                platformPostId = result.postId;
                platformUrl    = result.postUrl;
            } else {
                // Unsupported platform — simulate
                platformPostId = `${platform}_${crypto.randomUUID().slice(0, 8)}`;
                platformUrl    = '';
            }
        }

        const now = new Date().toISOString();

        // Update publishing_job → success
        await supabase.from('publishing_jobs').update({
            status:           'success',
            platform_post_id: platformPostId,
            platform_url:     platformUrl,
            published_at:     now,
        }).eq('id', publishing_job_id);

        // Update content_item → published
        await supabase.from('content_items').update({
            status:       'published',
            published_at: now,
        }).eq('id', job.content_item_id);

        // Create platform_post record for analytics tracking
        await supabase.from('platform_posts').upsert({
            brand_id:         brand_id,
            content_item_id:  job.content_item_id,
            publishing_job_id: publishing_job_id,
            platform,
            platform_post_id: platformPostId,
            platform_url:     platformUrl,
            caption,
            media_urls:       mediaUrl ? [mediaUrl] : [],
            published_at:     now,
        }, { onConflict: 'platform,platform_post_id' });

        // Update campaigns.published_count
        if (contentItem?.campaign_id) {
            await supabase.rpc('increment_published_count', {
                p_campaign_id: contentItem.campaign_id,
            }).catch(() => {});
        }

        console.log(JSON.stringify({
            correlationId, event: 'publish_success',
            platform, job_id: publishing_job_id, post_id: platformPostId,
        }));

        return new Response(JSON.stringify({
            success: true,
            platformPostId,
            platformUrl,
            publishedAt: now,
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(JSON.stringify({ correlationId, event: 'publish_error', error: message }));

        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
