/**
 * analytics-learning — Agent 10: Analytics Learning Agent
 *
 * Fetches live metrics from platform APIs for published posts,
 * stores performance snapshots in performance_records,
 * and writes learnings to brand_memory when patterns appear in 3+ posts.
 *
 * Can be invoked:
 *   - Via cron (scheduled every 24h)
 *   - Directly from the UI with { brand_id, campaign_id }
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

// ── Fetch Instagram post metrics ──────────────────────────────────────────────

async function fetchInstagramMetrics(params: {
    accessToken: string;
    platformPostId: string;
}): Promise<{
    reach: number; impressions: number; likes: number; comments: number;
    saves: number; shares: number; profileVisits: number;
}> {
    const fields = 'reach,impressions,likes_count,comments_count,saved,shares,profile_visits';
    const res = await fetch(
        `https://graph.facebook.com/v19.0/${params.platformPostId}/insights?metric=${fields}&access_token=${params.accessToken}`
    );
    if (!res.ok) {
        console.warn(`Instagram insights failed for ${params.platformPostId}: ${await res.text()}`);
        return { reach: 0, impressions: 0, likes: 0, comments: 0, saves: 0, shares: 0, profileVisits: 0 };
    }
    const { data } = await res.json() as { data: Array<{ name: string; values: Array<{ value: number }> }> };
    const get = (name: string) => data.find(d => d.name === name)?.values?.[0]?.value ?? 0;
    return {
        reach:         get('reach'),
        impressions:   get('impressions'),
        likes:         get('likes_count'),
        comments:      get('comments_count'),
        saves:         get('saved'),
        shares:        get('shares'),
        profileVisits: get('profile_visits'),
    };
}

// ── Analyze patterns across posts for brand_memory ────────────────────────────

interface PostRecord {
    contentType: string;
    platform: string;
    engagementRate: number;
    saves: number;
    reach: number;
}

function extractPatterns(posts: PostRecord[]): Array<{
    type: 'success' | 'weakness' | 'trend';
    text: string;
}> {
    if (posts.length < 3) return [];

    const learnings: Array<{ type: 'success' | 'weakness' | 'trend'; text: string }> = [];

    // Group by content type
    const byType: Record<string, PostRecord[]> = {};
    posts.forEach(p => {
        if (!byType[p.contentType]) byType[p.contentType] = [];
        byType[p.contentType].push(p);
    });

    // Find best and worst performing types (need 3+ posts of same type)
    const typeStats = Object.entries(byType)
        .filter(([, ps]) => ps.length >= 3)
        .map(([type, ps]) => ({
            type,
            avgEng: ps.reduce((s, p) => s + p.engagementRate, 0) / ps.length,
            avgSaves: ps.reduce((s, p) => s + p.saves, 0) / ps.length,
        }))
        .sort((a, b) => b.avgEng - a.avgEng);

    if (typeStats.length > 0) {
        const best = typeStats[0];
        learnings.push({
            type: 'success',
            text: `محتوى "${best.type}" يحقق أعلى تفاعل (${(best.avgEng * 100).toFixed(1)}%) — ازِد منه في الحملة القادمة`,
        });

        if (typeStats.length > 1) {
            const worst = typeStats[typeStats.length - 1];
            learnings.push({
                type: 'weakness',
                text: `محتوى "${worst.type}" يحقق أقل تفاعل — راجع الزاوية والتنسيق`,
            });
        }
    }

    // High saves = content resonance
    const highSavesPosts = posts.filter(p => p.saves > 50);
    if (highSavesPosts.length >= 2) {
        const types = [...new Set(highSavesPosts.map(p => p.contentType))].join('، ');
        learnings.push({
            type: 'trend',
            text: `المنشورات من نوع "${types}" تحصل على حفظ مرتفع — تشير للمحتوى القيّم`,
        });
    }

    // Platform comparison
    const byPlatform: Record<string, PostRecord[]> = {};
    posts.forEach(p => {
        if (!byPlatform[p.platform]) byPlatform[p.platform] = [];
        byPlatform[p.platform].push(p);
    });
    const platformStats = Object.entries(byPlatform)
        .filter(([, ps]) => ps.length >= 2)
        .map(([platform, ps]) => ({
            platform,
            avgEng: ps.reduce((s, p) => s + p.engagementRate, 0) / ps.length,
        }))
        .sort((a, b) => b.avgEng - a.avgEng);

    if (platformStats.length >= 2) {
        learnings.push({
            type: 'trend',
            text: `${platformStats[0].platform} يقدّم أعلى تفاعل (${(platformStats[0].avgEng * 100).toFixed(1)}%) مقارنة بـ ${platformStats[platformStats.length - 1].platform}`,
        });
    }

    return learnings;
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    const correlationId = crypto.randomUUID();
    const isCronInvocation = req.headers.get('x-cron-invocation') === 'true';

    try {
        let brandId: string | null = null;
        let campaignId: string | null = null;

        if (!isCronInvocation) {
            const user = await verifyJWT(req, correlationId, corsHeaders);
            if (user instanceof Response) return user;

            const body = await req.json() as { brand_id?: string; campaign_id?: string };
            brandId   = body.brand_id ?? null;
            campaignId = body.campaign_id ?? null;

            if (brandId) {
                const ownershipErr = await assertBrandOwnership(supabase, user.id, brandId, correlationId, corsHeaders);
                if (ownershipErr) return ownershipErr;
            }
        } else {
            // Cron: process all brands with posts needing sync (synced > 24h ago or never)
            const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
            const { data: pendingPosts } = await supabase
                .from('platform_posts')
                .select('brand_id')
                .or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`)
                .limit(50);

            const brands = [...new Set((pendingPosts ?? []).map((p: Record<string, unknown>) => p.brand_id as string))];
            const results = [];

            for (const bid of brands) {
                try {
                    const result = await syncBrandMetrics(bid, null);
                    results.push({ brand_id: bid, ...result });
                } catch (err) {
                    results.push({ brand_id: bid, error: String(err) });
                }
            }

            return new Response(JSON.stringify({ results }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const result = await syncBrandMetrics(brandId, campaignId);

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(JSON.stringify({ correlationId, event: 'analytics_error', error: message }));
        return new Response(JSON.stringify({ error: message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

// ── syncBrandMetrics — core logic ─────────────────────────────────────────────

async function syncBrandMetrics(
    brandId: string | null,
    campaignId: string | null,
): Promise<{ synced: number; learningsSaved: number }> {
    // Load platform_posts needing sync
    let query = supabase
        .from('platform_posts')
        .select('*')
        .order('published_at', { ascending: false })
        .limit(100);

    if (brandId) query = query.eq('brand_id', brandId);

    const cutoff = new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString();
    query = query.or(`last_synced_at.is.null,last_synced_at.lt.${cutoff}`);

    const { data: posts } = await query;
    if (!posts?.length) return { synced: 0, learningsSaved: 0 };

    let synced = 0;
    const postRecords: PostRecord[] = [];

    for (const post of posts) {
        try {
            // Load OAuth token for this brand + platform
            const { data: tokenRow } = await supabase
                .from('oauth_tokens')
                .select('access_token')
                .eq('brand_id', post.brand_id)
                .eq('platform', post.platform)
                .maybeSingle();

            let metrics = {
                reach: post.reach ?? 0,
                impressions: post.impressions ?? 0,
                likes: post.likes ?? 0,
                comments: post.comments ?? 0,
                saves: post.saves ?? 0,
                shares: post.shares ?? 0,
                profileVisits: post.profile_visits ?? 0,
            };

            if (tokenRow?.access_token && post.platform === 'instagram') {
                const fresh = await fetchInstagramMetrics({
                    accessToken: tokenRow.access_token,
                    platformPostId: post.platform_post_id,
                });
                metrics = fresh;
            }

            const totalInteractions = metrics.likes + metrics.comments + metrics.shares + metrics.saves;
            const engagementRate = metrics.reach > 0
                ? totalInteractions / metrics.reach
                : 0;
            const ctr = metrics.reach > 0 ? metrics.clicks / metrics.reach : 0;

            // Update platform_posts with fresh metrics
            await supabase.from('platform_posts').update({
                reach:            metrics.reach,
                impressions:      metrics.impressions,
                likes:            metrics.likes,
                comments:         metrics.comments,
                saves:            metrics.saves,
                shares:           metrics.shares,
                profile_visits:   metrics.profileVisits,
                engagement_rate:  engagementRate,
                click_through_rate: ctr,
                last_synced_at:   new Date().toISOString(),
            }).eq('id', post.id);

            // Write performance_record snapshot
            await supabase.from('performance_records').insert({
                brand_id:         post.brand_id,
                platform_post_id: post.id,
                campaign_id:      post.campaign_id ?? campaignId,
                snapshot_at:      new Date().toISOString(),
                period:           'daily',
                reach:            metrics.reach,
                impressions:      metrics.impressions,
                likes:            metrics.likes,
                comments:         metrics.comments,
                saves:            metrics.saves,
                shares:           metrics.shares,
                engagement_rate:  engagementRate,
            });

            // Load content_item to get content_type for pattern analysis
            const { data: item } = await supabase
                .from('content_items')
                .select('content_type')
                .eq('id', post.content_item_id)
                .maybeSingle();

            postRecords.push({
                contentType:    item?.content_type ?? 'post',
                platform:       post.platform,
                engagementRate,
                saves:          metrics.saves,
                reach:          metrics.reach,
            });

            synced++;
        } catch (err) {
            console.warn(`Failed to sync post ${post.id}: ${err}`);
        }
    }

    // Extract learning patterns and write to brand_memory
    let learningsSaved = 0;

    const brandIds = [...new Set(posts.map((p: Record<string, unknown>) => p.brand_id as string))];
    for (const bid of brandIds) {
        const brandPostRecords = postRecords.filter((_, i) => posts[i]?.brand_id === bid);
        const patterns = extractPatterns(brandPostRecords);

        if (patterns.length > 0) {
            const rows = patterns.map(l => ({
                brand_id:    bid,
                memory_type: l.type === 'success' ? 'high_performing_post'
                           : l.type === 'weakness' ? 'avoided_topic'
                           : 'audience_insight',
                content:     `${l.type === 'success' ? '✓' : l.type === 'weakness' ? '⚠' : '→'} ${l.text}`,
                context:     { source: 'analytics_learning_agent', timestamp: new Date().toISOString() },
                importance:  l.type === 'success' ? 8 : l.type === 'weakness' ? 7 : 6,
            }));

            const { error } = await supabase.from('brand_memory').insert(rows);
            if (!error) learningsSaved += rows.length;
        }
    }

    return { synced, learningsSaved };
}
