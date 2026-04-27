import {
    AnalyticsData,
    BriefPerformanceRollup,
    PlatformAnalyticsData,
    PostPerformance,
    SEOBreakdown,
    SocialPlatform,
    SyncJobStatus,
    WatchlistPerformanceRollup,
} from '../types';
import { supabase } from './supabaseClient';
import { getSocialAccounts } from './socialAccountService';
import type { BrandAsset, BrandConnection } from './brandConnectionService';
import {
    getReferencedAnalyticsProperty,
    getReferencedSearchConsoleProperty,
    getReferencedWebsite,
} from './providerConnectionService';

interface AnalyticsConnectionContext {
    brandConnections?: BrandConnection[];
    brandAssets?: BrandAsset | null;
}

// --- Helpers ---
function getPeriodDate(period: string): Date {
    const now = new Date();
    switch (period) {
        case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
}

function buildEmptyAnalytics(): AnalyticsData {
    return {
        overallStats: {
            totalFollowers: 0,
            reach: 0,
            impressions: 0,
            engagement: 0,
            postsPublished: 0,
            sentiment: { positive: 0, neutral: 0, negative: 0 },
        },
        connectedSources: {},
        topPosts: [],
        followerGrowth: [],
        engagementRate: []
    };
}

function getSinceDateIso(period?: string): string | null {
    if (!period) {
        return null;
    }

    return getPeriodDate(period).toISOString();
}

function buildSentimentBreakdown(rows: Array<{ sentiment?: string | null }>): AnalyticsData['overallStats']['sentiment'] {
    const counts = {
        positive: 0,
        neutral: 0,
        negative: 0,
    };

    for (const row of rows) {
        if (row.sentiment === 'positive' || row.sentiment === 'neutral' || row.sentiment === 'negative') {
            counts[row.sentiment] += 1;
        }
    }

    const total = counts.positive + counts.neutral + counts.negative;
    if (total === 0) {
        return { positive: 0, neutral: 0, negative: 0 };
    }

    const positive = Math.round((counts.positive / total) * 100);
    const neutral = Math.round((counts.neutral / total) * 100);
    const negative = Math.max(0, 100 - positive - neutral);

    return { positive, neutral, negative };
}

function mapBriefPerformanceRollup(row: any): BriefPerformanceRollup {
    return {
        briefId: row.brief_id,
        watchlistId: row.watchlist_id || undefined,
        title: row.title || '',
        objective: row.objective || '',
        angle: row.angle || '',
        linkedPosts: Number(row.linked_posts || 0),
        publishedPosts: Number(row.published_posts || 0),
        scheduledPosts: Number(row.scheduled_posts || 0),
        platformSpread: Number(row.platform_spread || 0),
        totalImpressions: Number(row.total_impressions || 0),
        totalReach: Number(row.total_reach || 0),
        totalEngagement: Number(row.total_engagement || 0),
        totalClicks: Number(row.total_clicks || 0),
        totalLikes: Number(row.total_likes || 0),
        totalComments: Number(row.total_comments || 0),
        totalShares: Number(row.total_shares || 0),
        totalSaves: Number(row.total_saves || 0),
        lastPublishedAt: row.last_published_at || undefined,
    };
}

function mapWatchlistPerformanceRollup(row: any): WatchlistPerformanceRollup {
    return {
        watchlistId: row.watchlist_id,
        name: row.name || '',
        query: row.query || '',
        briefsCount: Number(row.briefs_count || 0),
        linkedPosts: Number(row.linked_posts || 0),
        publishedPosts: Number(row.published_posts || 0),
        scheduledPosts: Number(row.scheduled_posts || 0),
        platformSpread: Number(row.platform_spread || 0),
        totalImpressions: Number(row.total_impressions || 0),
        totalReach: Number(row.total_reach || 0),
        totalEngagement: Number(row.total_engagement || 0),
        totalClicks: Number(row.total_clicks || 0),
        lastPublishedAt: row.last_published_at || undefined,
    };
}

function getActiveBrandConnection(
    brandConnections: BrandConnection[] | undefined,
    provider: BrandConnection['provider'],
): BrandConnection | null {
    return brandConnections?.find((connection) => connection.provider === provider && connection.status !== 'disconnected') ?? null;
}

/** Aggregate snapshot rows for a set of metric names → { impressions, reach, engagement, followers } */
function aggregateSnapshots(rows: Array<{ metric_name: string; metric_value: string | number }>) {
    let impressions = 0;
    let reach = 0;
    let engagement = 0;
    let followers = 0;

    for (const row of rows) {
        const val = Number(row.metric_value) || 0;
        if (row.metric_name === 'impressions' || row.metric_name === 'post_impressions') impressions += val;
        if (row.metric_name === 'reach') reach += val;
        if (row.metric_name === 'engaged_users') engagement += val;
        if ((row.metric_name === 'page_fans' || row.metric_name === 'follower_count') && val > followers) followers = val;
    }

    return { impressions, reach, engagement, followers };
}

async function getConnectedSourceSummaries(
    brandId: string,
    sinceDate: Date,
    context?: AnalyticsConnectionContext,
): Promise<AnalyticsData['connectedSources']> {
    const sourceSummaries: NonNullable<AnalyticsData['connectedSources']> = {};
    const ga4Connection = getActiveBrandConnection(context?.brandConnections, 'ga4');
    const searchConsoleConnection = getActiveBrandConnection(context?.brandConnections, 'search_console');
    const metaAdsConnection = getActiveBrandConnection(context?.brandConnections, 'meta_ads');
    const googleAdsConnection = getActiveBrandConnection(context?.brandConnections, 'google_ads');
    const ga4Property = getReferencedAnalyticsProperty(ga4Connection, context?.brandAssets ?? null);
    const searchConsoleProperty = getReferencedSearchConsoleProperty(searchConsoleConnection, context?.brandAssets ?? null);
    const ga4Website = getReferencedWebsite(ga4Connection, context?.brandAssets ?? null, 'ga4');
    const searchConsoleWebsite = getReferencedWebsite(searchConsoleConnection, context?.brandAssets ?? null, 'search_console');
    const sinceDateString = sinceDate.toISOString().split('T')[0];
    const hasAdsConnection = !!(metaAdsConnection || googleAdsConnection);

    const [ga4Result, searchResult, ga4SnapshotResult, gscSnapshotResult, adInsightsResult] = await Promise.all([
        // GA4 facts (primary — from legacy analytics_page_facts table)
        (ga4Connection || ga4Property) ? (async () => {
            let q: any = supabase
                .from('analytics_page_facts')
                .select('fact_date, sessions, engaged_sessions, bounced_sessions, key_events, transactions, revenue, avg_engagement_time_sec')
                .eq('brand_id', brandId)
                .gte('fact_date', sinceDateString);
            if (ga4Connection?.id) q = q.eq('connection_id', ga4Connection.id);
            if (ga4Property?.id) q = q.eq('analytics_property_id', ga4Property.id);
            return q;
        })() : Promise.resolve({ data: null, error: null }),

        // Search Console facts (primary — from legacy seo_page_facts table)
        (searchConsoleConnection || searchConsoleProperty) ? (async () => {
            let q: any = supabase
                .from('seo_page_facts')
                .select('fact_date, page_url, clicks, impressions, position')
                .eq('brand_id', brandId)
                .gte('fact_date', sinceDateString);
            if (searchConsoleConnection?.id) q = q.eq('connection_id', searchConsoleConnection.id);
            if (searchConsoleProperty?.id) q = q.eq('search_console_property_id', searchConsoleProperty.id);
            return q;
        })() : Promise.resolve({ data: null, error: null }),

        // GA4 fallback — sync-engine writes daily_summary rows to analytics_snapshots (source='ga4')
        supabase
            .from('analytics_snapshots')
            .select('date, metric_name, value, metadata')
            .eq('brand_id', brandId)
            .eq('source', 'ga4')
            .eq('metric_name', 'daily_summary')
            .gte('date', sinceDateString)
            .order('date', { ascending: false }),

        // GSC fallback — sync-engine writes daily_summary rows to analytics_snapshots (source='gsc')
        supabase
            .from('analytics_snapshots')
            .select('date, metric_name, value, metadata')
            .eq('brand_id', brandId)
            .eq('source', 'gsc')
            .eq('metric_name', 'daily_summary')
            .gte('date', sinceDateString)
            .order('date', { ascending: false }),

        // Ad campaign facts — data-sync writes to ad_campaign_facts (one row per campaign per day)
        hasAdsConnection ? supabase
            .from('ad_campaign_facts')
            .select('fact_date, provider, spend, impressions, reach, clicks, conversions, ctr, cpc, roas, campaign_id')
            .eq('brand_id', brandId)
            .gte('fact_date', sinceDateString)
            .order('fact_date', { ascending: false }) : Promise.resolve({ data: null, error: null }),
    ]);

    // ── GA4 ─────────────────────────────────────────────────────────────────────
    // Prefer analytics_page_facts; fall back to analytics_snapshots when empty
    const ga4Facts = (!ga4Result.error && ga4Result.data && ga4Result.data.length > 0)
        ? ga4Result.data
        : null;

    if (ga4Facts) {
        const sessions = ga4Facts.reduce((sum: number, r: any) => sum + Number(r.sessions ?? 0), 0);
        const engagedSessions = ga4Facts.reduce((sum: number, r: any) => sum + Number(r.engaged_sessions ?? 0), 0);
        const bouncedSessions = ga4Facts.reduce((sum: number, r: any) => sum + Number(r.bounced_sessions ?? 0), 0);
        const keyEvents = ga4Facts.reduce((sum: number, r: any) => sum + Number(r.key_events ?? 0), 0);
        const transactions = ga4Facts.reduce((sum: number, r: any) => sum + Number(r.transactions ?? 0), 0);
        const revenue = ga4Facts.reduce((sum: number, r: any) => sum + Number(r.revenue ?? 0), 0);
        const weightedEngagement = ga4Facts.reduce(
            (sum: number, r: any) => sum + (Number(r.avg_engagement_time_sec ?? 0) * Number(r.sessions ?? 0)),
            0,
        );
        sourceSummaries.ga4 = {
            propertyId: ga4Property?.property_id ?? ga4Connection?.external_account_id ?? 'ga4',
            propertyName: ga4Property?.property_name ?? ga4Connection?.external_account_name ?? 'Google Analytics 4',
            websiteUrl: ga4Website?.url ?? null,
            sessions,
            engagedSessions,
            keyEvents: transactions > 0 ? transactions : keyEvents,
            revenue,
            bounceRate: sessions > 0 ? bouncedSessions / sessions : 0,
            avgEngagementTimeSec: sessions > 0 ? weightedEngagement / sessions : 0,
            lastFactDate: ga4Facts.reduce((latest: string | null, r: any) => {
                const next = typeof r.fact_date === 'string' ? r.fact_date : null;
                if (!next) return latest;
                return latest && latest > next ? latest : next;
            }, null),
        };
    } else if (!ga4SnapshotResult.error && ga4SnapshotResult.data && ga4SnapshotResult.data.length > 0) {
        // Fallback: daily_summary rows from sync-engine in analytics_snapshots
        const snapRows = ga4SnapshotResult.data;
        let sessions = 0, bouncedSessions = 0, conversions = 0, weightedEngagementSec = 0;
        for (const r of snapRows) {
            const m = (r.metadata ?? {}) as Record<string, number>;
            const s = m.sessions ?? 0;
            sessions += s;
            bouncedSessions += (m.bounce_rate ?? 0) * s;
            conversions += m.conversions ?? 0;
            weightedEngagementSec += (m.avg_session_duration ?? 0) * s;
        }
        const latestMeta = (snapRows[0]?.metadata ?? {}) as Record<string, unknown>;
        const propertyId = String(latestMeta.property_id ?? ga4Connection?.external_account_id ?? 'ga4');
        sourceSummaries.ga4 = {
            propertyId,
            propertyName: ga4Connection?.external_account_name ?? 'Google Analytics 4',
            websiteUrl: ga4Website?.url ?? null,
            sessions,
            engagedSessions: 0,
            keyEvents: conversions,
            revenue: 0,
            bounceRate: sessions > 0 ? bouncedSessions / sessions : 0,
            avgEngagementTimeSec: sessions > 0 ? weightedEngagementSec / sessions : 0,
            lastFactDate: snapRows[0]?.date ?? null,
        };
    }

    // ── Search Console ────────────────────────────────────────────────────────────
    // Prefer seo_page_facts; fall back to analytics_snapshots when empty
    const gscFacts = (!searchResult.error && searchResult.data && searchResult.data.length > 0)
        ? searchResult.data
        : null;

    if (gscFacts) {
        const clicks = gscFacts.reduce((sum: number, r: any) => sum + Number(r.clicks ?? 0), 0);
        const impressions = gscFacts.reduce((sum: number, r: any) => sum + Number(r.impressions ?? 0), 0);
        const positions = gscFacts.map((r: any) => Number(r.position ?? 0)).filter((v: number) => v > 0);
        const indexedPages = new Set(gscFacts.map((r: any) => r.page_url as string).filter(Boolean)).size;
        sourceSummaries.searchConsole = {
            siteUrl: searchConsoleProperty?.site_url ?? searchConsoleWebsite?.url ?? searchConsoleConnection?.external_account_name ?? 'Search Console',
            clicks,
            impressions,
            ctr: impressions > 0 ? clicks / impressions : 0,
            avgPosition: positions.length > 0 ? positions.reduce((s: number, v: number) => s + v, 0) / positions.length : 0,
            indexedPages,
            lastFactDate: gscFacts.reduce((latest: string | null, r: any) => {
                const next = typeof r.fact_date === 'string' ? r.fact_date : null;
                if (!next) return latest;
                return latest && latest > next ? latest : next;
            }, null),
        };
    } else if (!gscSnapshotResult.error && gscSnapshotResult.data && gscSnapshotResult.data.length > 0) {
        const snapRows = gscSnapshotResult.data;
        let clicks = 0, impressions = 0;
        const positions: number[] = [];
        for (const r of snapRows) {
            const m = (r.metadata ?? {}) as Record<string, number>;
            clicks += m.clicks ?? 0;
            impressions += m.impressions ?? 0;
            if (m.position && m.position > 0) positions.push(m.position);
        }
        const latestMeta = (snapRows[0]?.metadata ?? {}) as Record<string, unknown>;
        const siteUrl = String(latestMeta.site_url ?? searchConsoleConnection?.external_account_name ?? 'Search Console');
        sourceSummaries.searchConsole = {
            siteUrl,
            clicks,
            impressions,
            ctr: impressions > 0 ? clicks / impressions : 0,
            avgPosition: positions.length > 0 ? positions.reduce((s, v) => s + v, 0) / positions.length : 0,
            indexedPages: 0,
            lastFactDate: snapRows[0]?.date ?? null,
        };
    }

    // ── Ads ───────────────────────────────────────────────────────────────────────
    if (!adInsightsResult.error && adInsightsResult.data && adInsightsResult.data.length > 0) {
        const rows = adInsightsResult.data;
        let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0;
        let weightedCtr = 0, weightedCpc = 0, weightedRoas = 0;
        const providerSet = new Set<string>();
        const campaignIds = new Set<string>();

        for (const r of rows) {
            const spend = Number(r.spend ?? 0);
            const impr = Number(r.impressions ?? 0);
            const clicks = Number(r.clicks ?? 0);
            totalSpend += spend;
            totalImpressions += impr;
            totalClicks += clicks;
            totalConversions += Number(r.conversions ?? 0);
            if (r.ctr != null) weightedCtr += Number(r.ctr) * impr;
            if (r.cpc != null) weightedCpc += Number(r.cpc) * clicks;
            if (r.roas != null) weightedRoas += Number(r.roas) * spend;
            if (r.provider) providerSet.add(String(r.provider));
            if (r.campaign_id) campaignIds.add(String(r.campaign_id));
        }

        const lastInsightDate = rows[0]?.fact_date ?? null;
        sourceSummaries.ads = {
            totalSpend,
            totalImpressions,
            totalClicks,
            totalConversions,
            totalConversionValue: 0,
            avgCtr: totalImpressions > 0 ? weightedCtr / totalImpressions : 0,
            avgCpc: totalClicks > 0 ? weightedCpc / totalClicks : 0,
            avgRoas: totalSpend > 0 ? weightedRoas / totalSpend : 0,
            providers: Array.from(providerSet),
            campaignCount: campaignIds.size,
            lastInsightDate: typeof lastInsightDate === 'string' ? lastInsightDate : null,
        };
    }

    return sourceSummaries;
}

// --- Main Service Functions ---

export async function syncAnalytics(brandId: string): Promise<void> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const { data: session } = await supabase.auth.getSession();
    const jwt = session?.session?.access_token;
    if (!jwt) return;

    await fetch(`${supabaseUrl}/functions/v1/analytics-aggregator`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
            'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ brand_id: brandId }),
    });
}

const SNAPSHOT_METRICS = ['impressions', 'reach', 'post_impressions', 'page_fans', 'engaged_users', 'follower_count'] as const;

export async function getAnalyticsData(
    brandId: string,
    filters: { period: string, platforms: SocialPlatform[] },
    context?: AnalyticsConnectionContext,
): Promise<AnalyticsData> {
    try {
        const sinceDate = getPeriodDate(filters.period);
        const sinceDateIso = sinceDate.toISOString();
        const selectedPlatforms = filters.platforms ?? [];
        const hasPlatformFilter = selectedPlatforms.length > 0;

        // Previous period dates for trend comparison
        const periodMs = Date.now() - sinceDate.getTime();
        const prevSinceDate = new Date(sinceDate.getTime() - periodMs);
        const prevSinceDateIso = prevSinceDate.toISOString();

        // Build current period queries
        let postAnalyticsQuery = supabase
            .from('post_analytics')
            .select('impressions, reach, engagement, platform, post_id, scheduled_posts!inner(brand_id, content, status, published_at)')
            .eq('scheduled_posts.brand_id', brandId)
            .gte('created_at', sinceDateIso);
        if (hasPlatformFilter) postAnalyticsQuery = postAnalyticsQuery.in('platform', selectedPlatforms);

        let postsPublishedQuery = supabase
            .from('scheduled_posts')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('status', 'published')
            .gte('published_at', sinceDateIso);
        if (hasPlatformFilter) postsPublishedQuery = postsPublishedQuery.overlaps('platforms', selectedPlatforms);

        let followerHistoryQuery = supabase
            .from('follower_history')
            .select('recorded_at, followers_count, platform')
            .eq('brand_id', brandId)
            .gte('recorded_at', sinceDateIso)
            .order('recorded_at', { ascending: true });
        if (hasPlatformFilter) followerHistoryQuery = followerHistoryQuery.in('platform', selectedPlatforms);

        let sentimentQuery = supabase
            .from('inbox_conversations')
            .select('sentiment, platform')
            .eq('brand_id', brandId)
            .gte('last_message_at', sinceDateIso)
            .not('sentiment', 'is', null);
        if (hasPlatformFilter) sentimentQuery = sentimentQuery.in('platform', selectedPlatforms);

        let snapshotsQuery = supabase
            .from('analytics_snapshots')
            .select('platform, metric_name, metric_value, period_start')
            .eq('brand_id', brandId)
            .gte('period_start', sinceDateIso)
            .in('metric_name', SNAPSHOT_METRICS);
        if (hasPlatformFilter) snapshotsQuery = snapshotsQuery.in('platform', selectedPlatforms);

        // Previous period (lightweight — just for trend arrows)
        let prevPostQuery = supabase
            .from('post_analytics')
            .select('impressions, reach, engagement, scheduled_posts!inner(brand_id)')
            .eq('scheduled_posts.brand_id', brandId)
            .gte('created_at', prevSinceDateIso)
            .lt('created_at', sinceDateIso);
        if (hasPlatformFilter) prevPostQuery = prevPostQuery.in('platform', selectedPlatforms);

        let prevSnapshotsQuery = supabase
            .from('analytics_snapshots')
            .select('metric_name, metric_value')
            .eq('brand_id', brandId)
            .gte('period_start', prevSinceDateIso)
            .lt('period_start', sinceDateIso)
            .in('metric_name', SNAPSHOT_METRICS);
        if (hasPlatformFilter) prevSnapshotsQuery = prevSnapshotsQuery.in('platform', selectedPlatforms);

        let prevPublishedQuery = supabase
            .from('scheduled_posts')
            .select('*', { count: 'exact', head: true })
            .eq('brand_id', brandId)
            .eq('status', 'published')
            .gte('published_at', prevSinceDateIso)
            .lt('published_at', sinceDateIso);

        // Run ALL queries in parallel
        const [
            accounts,
            { data: postAnalytics, error: analyticsError },
            { count: postsPublished },
            { data: followerHistory, error: historyError },
            { data: sentimentRows, error: sentimentError },
            { data: snapshots },
            { data: prevPostAnalytics },
            { data: prevSnapshots },
            { count: prevPostsPublished },
            connectedSources,
        ] = await Promise.all([
            getSocialAccounts(brandId).then(accs =>
                accs.filter(a => !hasPlatformFilter || selectedPlatforms.includes(a.platform))
            ),
            postAnalyticsQuery,
            postsPublishedQuery,
            followerHistoryQuery,
            sentimentQuery,
            snapshotsQuery,
            prevPostQuery,
            prevSnapshotsQuery,
            prevPublishedQuery,
            getConnectedSourceSummaries(brandId, sinceDate, context),
        ]);

        if (analyticsError) throw analyticsError;
        if (sentimentError) throw sentimentError;

        // --- Aggregate current period ---
        const curr = aggregateSnapshots(snapshots ?? []);

        const dbFollowers = accounts.reduce((sum, a) => sum + (a.followers || 0), 0);
        const totalFollowers = dbFollowers > 0 ? dbFollowers : curr.followers;

        const postImpressions = (postAnalytics || []).reduce((sum, p: any) => sum + (p.impressions || 0), 0);
        const postEngagement = (postAnalytics || []).reduce((sum, p: any) => sum + (p.engagement || 0), 0);
        const postReach = (postAnalytics || []).reduce((sum, p: any) => sum + (p.reach || 0), 0);

        const totalImpressions = postImpressions + curr.impressions;
        const totalEngagement = postEngagement + curr.engagement;
        const totalReach = postReach + curr.reach;

        // --- Aggregate previous period ---
        const prev = aggregateSnapshots(prevSnapshots ?? []);
        const prevPostImpressions = (prevPostAnalytics || []).reduce((sum, p: any) => sum + (p.impressions || 0), 0);
        const prevPostEngagement = (prevPostAnalytics || []).reduce((sum, p: any) => sum + (p.engagement || 0), 0);
        const prevPostReach = (prevPostAnalytics || []).reduce((sum, p: any) => sum + (p.reach || 0), 0);
        const prevTotalImpressions = prevPostImpressions + prev.impressions;
        const prevTotalEngagement = prevPostEngagement + prev.engagement;
        const prevTotalReach = prevPostReach + prev.reach;
        const hasPrevData = prevTotalImpressions > 0 || prevTotalEngagement > 0 || prev.followers > 0;

        // --- Top posts by engagement ---
        const postEngagementMap: Record<string, { content: string; engagement: number }> = {};
        (postAnalytics || []).forEach((p: any) => {
            const postId = p.post_id;
            if (!postEngagementMap[postId]) {
                postEngagementMap[postId] = { content: p.scheduled_posts?.content || '', engagement: 0 };
            }
            postEngagementMap[postId].engagement += p.engagement || 0;
        });

        const topPosts: PostPerformance[] = Object.entries(postEngagementMap)
            .map(([id, d]) => ({ id, content: d.content, engagement: d.engagement }))
            .sort((a, b) => b.engagement - a.engagement)
            .slice(0, 5);

        // --- Engagement rate per platform ---
        const platformEngMap: Record<string, { engagement: number; impressions: number }> = {};
        (postAnalytics || []).forEach((p: any) => {
            const plat = p.platform;
            if (!platformEngMap[plat]) platformEngMap[plat] = { engagement: 0, impressions: 0 };
            platformEngMap[plat].engagement += p.engagement || 0;
            platformEngMap[plat].impressions += p.impressions || 0;
        });

        const engagementRate = Object.entries(platformEngMap).map(([platform, d]) => ({
            platform: platform as SocialPlatform,
            rate: d.impressions > 0 ? parseFloat(((d.engagement / d.impressions) * 100).toFixed(2)) : 0,
        }));

        const platformBreakdown: Record<string, { impressions: number; engagement: number }> = {};
        Object.entries(platformEngMap).forEach(([platform, d]) => {
            platformBreakdown[platform] = { impressions: d.impressions, engagement: d.engagement };
        });

        // --- Follower growth timeline ---
        const growthMap: Record<string, Record<string, number>> = {};
        if (!historyError && followerHistory) {
            followerHistory.forEach((h: any) => {
                const date = h.recorded_at.split('T')[0];
                if (!growthMap[date]) growthMap[date] = {};
                growthMap[date][h.platform] = h.followers_count;
            });
        }
        const followerGrowth = Object.entries(growthMap).map(([date, platforms]) => ({ date, ...platforms }));

        return {
            overallStats: {
                totalFollowers,
                reach: totalReach,
                impressions: totalImpressions,
                engagement: totalEngagement,
                postsPublished: postsPublished || 0,
                sentiment: buildSentimentBreakdown(sentimentRows || []),
            },
            previousPeriodStats: hasPrevData ? {
                totalFollowers: prev.followers,
                reach: prevTotalReach,
                impressions: prevTotalImpressions,
                engagement: prevTotalEngagement,
                postsPublished: prevPostsPublished || 0,
            } : undefined,
            connectedSources,
            topPosts,
            followerGrowth,
            engagementRate,
            platformBreakdown,
        };

    } catch (error) {
        console.warn('⚠️ Analytics fetch failed, returning empty state:', error);
        return buildEmptyAnalytics();
    }
}

export async function getBriefPerformanceRollups(
    brandId: string,
    period: string = '30d',
): Promise<BriefPerformanceRollup[]> {
    try {
        const { data, error } = await supabase.rpc('get_brief_performance_rollups', {
            p_brand_id: brandId,
            p_since: getSinceDateIso(period),
        });

        if (error) {
            throw error;
        }

        return (data || []).map(mapBriefPerformanceRollup);
    } catch (error) {
        console.warn('Failed to fetch brief performance rollups:', error);
        return [];
    }
}

export async function getWatchlistPerformanceRollups(
    brandId: string,
    period: string = '30d',
): Promise<WatchlistPerformanceRollup[]> {
    try {
        const { data, error } = await supabase.rpc('get_watchlist_performance_rollups', {
            p_brand_id: brandId,
            p_since: getSinceDateIso(period),
        });

        if (error) {
            throw error;
        }

        return (data || []).map(mapWatchlistPerformanceRollup);
    } catch (error) {
        console.warn('Failed to fetch watchlist performance rollups:', error);
        return [];
    }
}

export async function getPlatformAnalyticsData(brandId: string, platform: SocialPlatform): Promise<PlatformAnalyticsData> {
    try {
        const sinceDate = getPeriodDate('30d');

        const { data, error } = await supabase
            .from('post_analytics')
            .select(`
                impressions,
                reach,
                engagement,
                post_id,
                scheduled_posts!inner(brand_id, content)
            `)
            .eq('scheduled_posts.brand_id', brandId)
            .eq('platform', platform)
            .gte('created_at', sinceDate.toISOString());

        if (error) throw error;

        const totalReach = (data || []).reduce((sum: number, p: any) => sum + (p.reach || 0), 0);
        const totalEngagement = (data || []).reduce((sum: number, p: any) => sum + (p.engagement || 0), 0);
        const totalImpressions = (data || []).reduce((sum: number, p: any) => sum + (p.impressions || 0), 0);

        const topPosts: PostPerformance[] = (data || [])
            .map((p: any) => ({ id: p.post_id, content: p.scheduled_posts?.content || '', engagement: p.engagement || 0 }))
            .sort((a: PostPerformance, b: PostPerformance) => b.engagement - a.engagement)
            .slice(0, 5);

        return {
            platform,
            metrics: {
                reach: totalReach,
                engagementRate: totalImpressions > 0 ? parseFloat(((totalEngagement / totalImpressions) * 100).toFixed(2)) : 0,
                posts: (data || []).length,
            },
            topPosts,
            aiSummary: `تحليل أداء ${platform} خلال آخر 30 يوم بناءً على ${(data || []).length} منشور.`
        };

    } catch (error) {
        console.warn(`⚠️ Platform analytics fetch failed for ${platform}:`, error);
        return {
            platform,
            metrics: { reach: 0, engagementRate: 0, posts: 0 },
            topPosts: [],
            aiSummary: 'لا تتوفر بيانات كافية بعد. ابدأ بنشر محتوى لترى التحليلات هنا.'
        };
    }
}

export async function getSEOBreakdown(brandId: string, period: string = '30d'): Promise<SEOBreakdown> {
    try {
        const sinceDateString = getPeriodDate(period).toISOString().split('T')[0];
        const { data, error } = await supabase
            .from('seo_page_facts')
            .select('page_url, query, clicks, impressions, position')
            .eq('brand_id', brandId)
            .gte('fact_date', sinceDateString);

        if (error || !data || data.length === 0) return { topQueries: [], topPages: [] };

        const queryMap = new Map<string, { clicks: number; impressions: number; positionSum: number; count: number }>();
        const pageMap = new Map<string, { clicks: number; impressions: number; positionSum: number; count: number }>();

        for (const row of data) {
            const clicks = Number(row.clicks ?? 0);
            const impressions = Number(row.impressions ?? 0);
            const position = Number(row.position ?? 0);

            if (row.query) {
                const e = queryMap.get(row.query) ?? { clicks: 0, impressions: 0, positionSum: 0, count: 0 };
                queryMap.set(row.query, { clicks: e.clicks + clicks, impressions: e.impressions + impressions, positionSum: e.positionSum + position, count: e.count + 1 });
            }
            if (row.page_url) {
                const e = pageMap.get(row.page_url) ?? { clicks: 0, impressions: 0, positionSum: 0, count: 0 };
                pageMap.set(row.page_url, { clicks: e.clicks + clicks, impressions: e.impressions + impressions, positionSum: e.positionSum + position, count: e.count + 1 });
            }
        }

        const topQueries = Array.from(queryMap.entries())
            .map(([query, d]) => ({
                query,
                clicks: d.clicks,
                impressions: d.impressions,
                ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
                avgPosition: d.count > 0 ? d.positionSum / d.count : 0,
            }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10);

        const topPages = Array.from(pageMap.entries())
            .map(([pageUrl, d]) => ({
                pageUrl,
                clicks: d.clicks,
                impressions: d.impressions,
                ctr: d.impressions > 0 ? d.clicks / d.impressions : 0,
                avgPosition: d.count > 0 ? d.positionSum / d.count : 0,
            }))
            .sort((a, b) => b.clicks - a.clicks)
            .slice(0, 10);

        return { topQueries, topPages };
    } catch (error) {
        console.warn('getSEOBreakdown failed:', error);
        return { topQueries: [], topPages: [] };
    }
}

export async function getLastSyncJobs(brandId: string): Promise<SyncJobStatus[]> {
    try {
        const { data, error } = await supabase
            .from('analytics_sync_jobs')
            .select('provider, status, started_at, finished_at, records_synced, error_message')
            .eq('brand_id', brandId)
            .order('started_at', { ascending: false })
            .limit(20);

        if (error || !data) return [];

        const seen = new Set<string>();
        const result: SyncJobStatus[] = [];
        for (const row of data) {
            if (!seen.has(row.provider)) {
                seen.add(row.provider);
                result.push({
                    provider: row.provider,
                    status: row.status as 'running' | 'success' | 'failed',
                    startedAt: row.started_at,
                    finishedAt: row.finished_at ?? null,
                    recordsSynced: Number(row.records_synced ?? 0),
                    errorMessage: row.error_message ?? null,
                });
            }
        }
        return result;
    } catch (error) {
        console.warn('getLastSyncJobs failed:', error);
        return [];
    }
}

export async function recordFollowerSnapshot(brandId: string, platform: SocialPlatform, followersCount: number): Promise<void> {
    try {
        await supabase.from('follower_history').insert({
            brand_id: brandId,
            platform,
            followers_count: followersCount,
            recorded_at: new Date().toISOString(),
        });
    } catch (error) {
        console.warn('Failed to record follower snapshot:', error);
    }
}
