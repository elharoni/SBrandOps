/**
 * inbox-aggregator Edge Function
 * يجمع الرسائل والتعليقات من جميع المنصات في جدول social_messages
 *
 * Called by:
 *  - pg_cron every 15 minutes (CRON_SECRET auth)
 *  - manual trigger from InboxPage (JWT auth)
 *  - provider-webhook after real-time event (internal call)
 *
 * Platforms:
 *  - Facebook: Page DMs + Post Comments
 *  - Instagram: Media Comments (DMs require Instagram API approval)
 *  - YouTube: Video Comments (latest 50 per channel)
 *
 * AI Classification (via ai-proxy):
 *  - sentiment: positive | neutral | negative
 *  - intent: buying_intent | inquiry | complaint | spam | positive_feedback
 *  - priority_score: 0-100
 *
 * Deduplication: UNIQUE (provider, external_thread_id, external_message_id)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { decryptToken } from '../_shared/tokens.ts';
import { verifyJWT, assertBrandOwnership, buildCorsHeaders } from '../_shared/auth.ts';

const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const FB_VERSION = 'v23.0';

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function fetchWithRetry(url: string, options: RequestInit = {}, attempt = 0): Promise<Response> {
    const resp = await fetch(url, { ...options, signal: AbortSignal.timeout(12000) });
    if (resp.status === 429 && attempt < 4) {
        await sleep((attempt + 1) * 2000);
        return fetchWithRetry(url, options, attempt + 1);
    }
    return resp;
}

// ── AI Classification ─────────────────────────────────────────────────────────

async function classifyMessage(content: string): Promise<{
    sentiment: 'positive' | 'neutral' | 'negative';
    intent: 'buying_intent' | 'inquiry' | 'complaint' | 'spam' | 'positive_feedback';
    priority_score: number;
}> {
    try {
        const aiProxyUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/ai-proxy`;
        const resp = await fetch(aiProxyUrl, {
            method: 'POST',
            headers: {
                'Content-Type':  'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
                action: 'classify_inbox_message',
                content,
            }),
            signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) throw new Error('AI proxy failed');
        const result = await resp.json();

        return {
            sentiment:     result.sentiment ?? 'neutral',
            intent:        result.intent    ?? 'inquiry',
            priority_score: Math.min(100, Math.max(0, parseInt(result.priority_score ?? '50'))),
        };
    } catch {
        // Fallback: keyword-based scoring
        const lower = content.toLowerCase();
        const hasBuyingWords = /سعر|كم سعر|اشتري|طلب|اطلب|بكم|price|buy|order|how much/.test(lower);
        const hasComplaint   = /مشكلة|خطأ|غلط|راجع|رجعت|problem|issue|wrong|refund/.test(lower);
        const hasSpam        = /win|winner|congratulations|click here|اضغط هنا/.test(lower);

        const intent = hasSpam
            ? 'spam'
            : hasComplaint
                ? 'complaint'
                : hasBuyingWords
                    ? 'buying_intent'
                    : 'inquiry';

        const priority_score = intent === 'buying_intent' ? 80
            : intent === 'complaint' ? 70
            : intent === 'spam' ? 10
            : 40;

        return {
            sentiment:     hasComplaint ? 'negative' : hasBuyingWords ? 'positive' : 'neutral',
            intent,
            priority_score,
        };
    }
}

// ── Upsert message ─────────────────────────────────────────────────────────────

async function upsertMessage(msg: {
    brand_id: string;
    social_account_id: string | null;
    provider: string;
    message_type: 'message' | 'comment' | 'mention' | 'reply';
    external_thread_id: string;
    external_message_id: string;
    external_post_id?: string;
    sender_name: string | null;
    sender_external_id: string | null;
    sender_avatar_url?: string | null;
    content: string;
    media_urls?: string[];
    received_at: string;
    skip_classification?: boolean;
}) {
    let classification = { sentiment: 'neutral' as const, intent: 'inquiry' as const, priority_score: 40 };
    if (!msg.skip_classification && msg.content.trim().length > 2) {
        classification = await classifyMessage(msg.content);
    }

    await supabase.from('social_messages').upsert({
        brand_id:             msg.brand_id,
        social_account_id:    msg.social_account_id,
        provider:             msg.provider,
        message_type:         msg.message_type,
        external_thread_id:   msg.external_thread_id,
        external_message_id:  msg.external_message_id,
        external_post_id:     msg.external_post_id ?? null,
        sender_name:          msg.sender_name,
        sender_external_id:   msg.sender_external_id,
        sender_avatar_url:    msg.sender_avatar_url ?? null,
        content:              msg.content,
        media_urls:           msg.media_urls ?? [],
        sentiment:            classification.sentiment,
        intent:               classification.intent,
        priority_score:       classification.priority_score,
        received_at:          msg.received_at,
        updated_at:           new Date().toISOString(),
    }, { onConflict: 'provider,external_thread_id,external_message_id', ignoreDuplicates: true });
}

// ── Facebook Page DMs ──────────────────────────────────────────────────────────

async function aggregateFacebookMessages(brandId: string): Promise<number> {
    const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, platform_account_id')
        .eq('brand_id', brandId)
        .eq('platform', 'facebook')
        .eq('sync_status', 'active');

    if (!accounts?.length) return 0;

    const tokens = await getToken(brandId, 'facebook');
    if (!tokens) return 0;

    let count = 0;

    for (const account of accounts) {
        const pageId = account.platform_account_id;
        const url    = `https://graph.facebook.com/${FB_VERSION}/${pageId}/conversations?fields=participants,messages{message,created_time,from,attachments},updated_time&limit=25&access_token=${tokens}`;

        try {
            const resp = await fetchWithRetry(url);
            if (!resp.ok) continue;
            const result = await resp.json();

            for (const conv of result.data ?? []) {
                const threadId = String(conv.id);
                for (const msg of conv.messages?.data ?? []) {
                    const content = String(msg.message ?? '');
                    if (!content && !msg.attachments) continue;

                    const mediaUrls = (msg.attachments?.data ?? [])
                        .map((a: Record<string, unknown>) => (a.file_url ?? a.image_data) as string)
                        .filter(Boolean);

                    await upsertMessage({
                        brand_id:            brandId,
                        social_account_id:   account.id,
                        provider:            'facebook',
                        message_type:        'message',
                        external_thread_id:  threadId,
                        external_message_id: String(msg.id),
                        sender_name:         msg.from?.name ?? null,
                        sender_external_id:  msg.from?.id ?? null,
                        content:             content || '[attachment]',
                        media_urls:          mediaUrls,
                        received_at:         String(msg.created_time),
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`FB messages error for ${pageId}:`, e instanceof Error ? e.message : e);
        }
    }

    return count;
}

// ── Facebook Page Comments ────────────────────────────────────────────────────

async function aggregateFacebookComments(brandId: string): Promise<number> {
    const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, platform_account_id')
        .eq('brand_id', brandId)
        .eq('platform', 'facebook')
        .eq('sync_status', 'active');

    if (!accounts?.length) return 0;

    const tokens = await getToken(brandId, 'facebook');
    if (!tokens) return 0;

    let count = 0;
    const sinceTs = Math.floor(Date.now() / 1000) - 86400 * 3; // last 3 days

    for (const account of accounts) {
        const pageId = account.platform_account_id;

        try {
            // Fetch recent posts
            const postsResp = await fetchWithRetry(
                `https://graph.facebook.com/${FB_VERSION}/${pageId}/posts?fields=id&limit=10&since=${sinceTs}&access_token=${tokens}`,
            );
            if (!postsResp.ok) continue;
            const postsResult = await postsResp.json();

            for (const post of postsResult.data ?? []) {
                const postId = String(post.id);

                // Fetch comments for this post
                const commentsResp = await fetchWithRetry(
                    `https://graph.facebook.com/${FB_VERSION}/${postId}/comments?fields=id,message,from,created_time,attachment&limit=50&access_token=${tokens}`,
                );
                if (!commentsResp.ok) continue;
                const commentsResult = await commentsResp.json();

                for (const comment of commentsResult.data ?? []) {
                    const content = String(comment.message ?? '');
                    if (!content) continue;

                    await upsertMessage({
                        brand_id:            brandId,
                        social_account_id:   account.id,
                        provider:            'facebook',
                        message_type:        'comment',
                        external_thread_id:  postId,
                        external_message_id: String(comment.id),
                        external_post_id:    postId,
                        sender_name:         comment.from?.name ?? null,
                        sender_external_id:  comment.from?.id ?? null,
                        content,
                        received_at:         String(comment.created_time),
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`FB comments error for ${pageId}:`, e instanceof Error ? e.message : e);
        }
    }

    return count;
}

// ── Instagram Comments ────────────────────────────────────────────────────────

async function aggregateInstagramComments(brandId: string): Promise<number> {
    const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, platform_account_id')
        .eq('brand_id', brandId)
        .eq('platform', 'instagram')
        .eq('sync_status', 'active');

    if (!accounts?.length) return 0;

    const tokens = await getToken(brandId, 'instagram');
    if (!tokens) return 0;

    let count = 0;

    for (const account of accounts) {
        const igId = account.platform_account_id;

        try {
            // Recent media
            const mediaResp = await fetchWithRetry(
                `https://graph.facebook.com/${FB_VERSION}/${igId}/media?fields=id,timestamp&limit=12&access_token=${tokens}`,
            );
            if (!mediaResp.ok) continue;
            const mediaResult = await mediaResp.json();

            for (const media of mediaResult.data ?? []) {
                const mediaId = String(media.id);

                const commentsResp = await fetchWithRetry(
                    `https://graph.facebook.com/${FB_VERSION}/${mediaId}/comments?fields=id,text,username,timestamp&limit=50&access_token=${tokens}`,
                );
                if (!commentsResp.ok) continue;
                const commentsResult = await commentsResp.json();

                for (const comment of commentsResult.data ?? []) {
                    const content = String(comment.text ?? '');
                    if (!content) continue;

                    await upsertMessage({
                        brand_id:            brandId,
                        social_account_id:   account.id,
                        provider:            'instagram',
                        message_type:        'comment',
                        external_thread_id:  mediaId,
                        external_message_id: String(comment.id),
                        external_post_id:    mediaId,
                        sender_name:         comment.username ?? null,
                        sender_external_id:  comment.username ?? null,
                        content,
                        received_at:         String(comment.timestamp),
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`IG comments error for ${igId}:`, e instanceof Error ? e.message : e);
        }
    }

    return count;
}

// ── YouTube Comments ──────────────────────────────────────────────────────────

async function aggregateYouTubeComments(brandId: string): Promise<number> {
    const { data: accounts } = await supabase
        .from('social_accounts')
        .select('id, platform_account_id')
        .eq('brand_id', brandId)
        .eq('platform', 'youtube')
        .eq('sync_status', 'active');

    if (!accounts?.length) return 0;

    const tokens = await getToken(brandId, 'youtube');
    if (!tokens) return 0;

    let count = 0;

    for (const account of accounts) {
        const channelId = account.platform_account_id;
        try {
            // Get latest 10 videos
            const videosResp = await fetchWithRetry(
                `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channelId}&type=video&maxResults=10&order=date`,
                { headers: { 'Authorization': `Bearer ${tokens}` } },
            );
            if (!videosResp.ok) continue;
            const videosResult = await videosResp.json();

            for (const item of videosResult.items ?? []) {
                const videoId = item.id?.videoId;
                if (!videoId) continue;

                const commentsResp = await fetchWithRetry(
                    `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=50`,
                    { headers: { 'Authorization': `Bearer ${tokens}` } },
                );
                if (!commentsResp.ok) continue;
                const commentsResult = await commentsResp.json();

                for (const thread of commentsResult.items ?? []) {
                    const top = thread.snippet?.topLevelComment?.snippet;
                    if (!top) continue;

                    await upsertMessage({
                        brand_id:            brandId,
                        social_account_id:   account.id,
                        provider:            'youtube',
                        message_type:        'comment',
                        external_thread_id:  String(thread.id),
                        external_message_id: String(thread.id),
                        external_post_id:    videoId,
                        sender_name:         top.authorDisplayName ?? null,
                        sender_external_id:  top.authorChannelId?.value ?? null,
                        sender_avatar_url:   top.authorProfileImageUrl ?? null,
                        content:             String(top.textDisplay ?? ''),
                        received_at:         String(top.publishedAt ?? new Date().toISOString()),
                    });
                    count++;
                }
            }
        } catch (e) {
            console.error(`YouTube comments error for ${channelId}:`, e instanceof Error ? e.message : e);
        }
    }

    return count;
}

// ── Token helper ──────────────────────────────────────────────────────────────

async function getToken(brandId: string, provider: string): Promise<string | null> {
    const { data } = await supabase
        .from('oauth_tokens')
        .select('access_token_enc')
        .eq('brand_id', brandId)
        .eq('provider', provider)
        .eq('is_valid', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!data?.access_token_enc) return null;
    return decryptToken(data.access_token_enc);
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    const correlationId = crypto.randomUUID();
    const corsHeaders   = buildCorsHeaders(req.headers.get('Origin'));

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

    const authHeader = req.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
    const cronSecret = Deno.env.get('CRON_SECRET') ?? '';
    const isCron     = cronSecret && authHeader === cronSecret;

    let brandIds: string[] = [];

    if (isCron) {
        // Run all brands that have active social accounts
        const { data } = await supabase
            .from('social_accounts')
            .select('brand_id')
            .in('platform', ['facebook', 'instagram', 'youtube'])
            .eq('sync_status', 'active');
        brandIds = [...new Set((data ?? []).map(r => r.brand_id as string))];
    } else {
        const userOrError = await verifyJWT(req, correlationId, corsHeaders);
        if (userOrError instanceof Response) return userOrError;

        let body: { brand_id: string };
        try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: corsHeaders }); }
        if (!body.brand_id) return new Response(JSON.stringify({ error: 'brand_id required' }), { status: 400, headers: corsHeaders });

        const ownershipError = await assertBrandOwnership(supabase, userOrError.id, body.brand_id, correlationId, corsHeaders);
        if (ownershipError) return ownershipError;
        brandIds = [body.brand_id];
    }

    let totalMessages = 0;

    for (const brandId of brandIds) {
        const [fbMsgs, fbComments, igComments, ytComments] = await Promise.allSettled([
            aggregateFacebookMessages(brandId),
            aggregateFacebookComments(brandId),
            aggregateInstagramComments(brandId),
            aggregateYouTubeComments(brandId),
        ]);

        const brandTotal = [fbMsgs, fbComments, igComments, ytComments]
            .filter(r => r.status === 'fulfilled')
            .reduce((sum, r) => sum + (r as PromiseFulfilledResult<number>).value, 0);

        totalMessages += brandTotal;

        console.log(JSON.stringify({
            correlationId,
            event:    'inbox-aggregated',
            brand_id: brandId,
            fb_messages:   fbMsgs.status === 'fulfilled' ? fbMsgs.value : 0,
            fb_comments:   fbComments.status === 'fulfilled' ? fbComments.value : 0,
            ig_comments:   igComments.status === 'fulfilled' ? igComments.value : 0,
            yt_comments:   ytComments.status === 'fulfilled' ? ytComments.value : 0,
        }));
    }

    return new Response(JSON.stringify({
        ok:             true,
        correlationId,
        brands:         brandIds.length,
        total_messages: totalMessages,
    }), {
        status:  200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
});
