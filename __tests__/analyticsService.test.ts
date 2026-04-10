import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as supa from '../services/supabaseClient';
import * as socialAccounts from '../services/socialAccountService';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        rpc: vi.fn(),
        from: vi.fn(),
    },
}));

vi.mock('../services/socialAccountService', () => ({
    getSocialAccounts: vi.fn(),
}));

import { getAnalyticsData, getBriefPerformanceRollups, getWatchlistPerformanceRollups } from '../services/analyticsService';

const makeQuery = (resolvedValue: { data?: any; error?: any; count?: number | null }) => {
    const query: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        overlaps: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        then: (onFulfilled: any, onRejected: any) => Promise.resolve(resolvedValue).then(onFulfilled, onRejected),
        catch: (onRejected: any) => Promise.resolve(resolvedValue).catch(onRejected),
        finally: (onFinally: any) => Promise.resolve(resolvedValue).finally(onFinally),
    };

    return query;
};

describe('analyticsService rollups', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('builds analytics sentiment from analyzed inbox conversations', async () => {
        (socialAccounts.getSocialAccounts as any).mockResolvedValue([
            { id: 'acc-1', platform: 'Facebook', username: 'brand', followers: 1200, status: 'active' },
            { id: 'acc-2', platform: 'Instagram', username: 'brand.ig', followers: 800, status: 'active' },
        ]);

        const postAnalyticsQuery = makeQuery({
            data: [
                {
                    impressions: 400,
                    engagement: 80,
                    platform: 'Facebook',
                    post_id: 'post-1',
                    scheduled_posts: { content: 'Launch update' },
                },
                {
                    impressions: 200,
                    engagement: 20,
                    platform: 'Instagram',
                    post_id: 'post-2',
                    scheduled_posts: { content: 'Behind the scenes' },
                },
            ],
            error: null,
        });

        const publishedPostsQuery = makeQuery({
            count: 3,
            error: null,
        });

        const followerHistoryQuery = makeQuery({
            data: [
                { recorded_at: '2026-03-01T00:00:00.000Z', followers_count: 1000, platform: 'Facebook' },
                { recorded_at: '2026-03-08T00:00:00.000Z', followers_count: 1200, platform: 'Facebook' },
            ],
            error: null,
        });

        const sentimentQuery = makeQuery({
            data: [
                { sentiment: 'positive', platform: 'Instagram' },
                { sentiment: 'positive', platform: 'Facebook' },
                { sentiment: 'neutral', platform: 'Facebook' },
                { sentiment: 'negative', platform: 'Instagram' },
            ],
            error: null,
        });

        (supa.supabase.from as any)
            .mockReturnValueOnce(postAnalyticsQuery)
            .mockReturnValueOnce(publishedPostsQuery)
            .mockReturnValueOnce(followerHistoryQuery)
            .mockReturnValueOnce(sentimentQuery);

        const result = await getAnalyticsData('brand-1', { period: '30d', platforms: [] });

        expect(socialAccounts.getSocialAccounts).toHaveBeenCalledWith('brand-1');
        expect(result.overallStats.totalFollowers).toBe(2000);
        expect(result.overallStats.impressions).toBe(600);
        expect(result.overallStats.engagement).toBe(100);
        expect(result.overallStats.postsPublished).toBe(3);
        expect(result.overallStats.sentiment).toEqual({
            positive: 50,
            neutral: 25,
            negative: 25,
        });
        expect(result.topPosts).toEqual([
            { id: 'post-1', content: 'Launch update', engagement: 80 },
            { id: 'post-2', content: 'Behind the scenes', engagement: 20 },
        ]);
    });

    it('applies platform filtering to analytics queries', async () => {
        (socialAccounts.getSocialAccounts as any).mockResolvedValue([
            { id: 'acc-1', platform: 'Facebook', username: 'brand', followers: 1200, status: 'active' },
            { id: 'acc-2', platform: 'Instagram', username: 'brand.ig', followers: 800, status: 'active' },
        ]);

        const postAnalyticsQuery = makeQuery({ data: [], error: null });
        const publishedPostsQuery = makeQuery({ count: 0, error: null });
        const followerHistoryQuery = makeQuery({ data: [], error: null });
        const sentimentQuery = makeQuery({ data: [], error: null });

        (supa.supabase.from as any)
            .mockReturnValueOnce(postAnalyticsQuery)
            .mockReturnValueOnce(publishedPostsQuery)
            .mockReturnValueOnce(followerHistoryQuery)
            .mockReturnValueOnce(sentimentQuery);

        await getAnalyticsData('brand-1', { period: '30d', platforms: ['Facebook' as any] });

        expect(postAnalyticsQuery.in).toHaveBeenCalledWith('platform', ['Facebook']);
        expect(publishedPostsQuery.overlaps).toHaveBeenCalledWith('platforms', ['Facebook']);
        expect(followerHistoryQuery.in).toHaveBeenCalledWith('platform', ['Facebook']);
        expect(sentimentQuery.in).toHaveBeenCalledWith('platform', ['Facebook']);
    });

    it('maps brief performance rollups from RPC rows', async () => {
        (supa as any).supabase.rpc.mockResolvedValueOnce({
            data: [
                {
                    brief_id: 'brief-1',
                    watchlist_id: 'watch-1',
                    title: 'Launch angle',
                    objective: 'Drive awareness',
                    angle: 'Founder-led story',
                    linked_posts: 3,
                    published_posts: 2,
                    scheduled_posts: 1,
                    platform_spread: 2,
                    total_impressions: 1200,
                    total_reach: 950,
                    total_engagement: 210,
                    total_clicks: 45,
                    total_likes: 90,
                    total_comments: 20,
                    total_shares: 12,
                    total_saves: 8,
                    last_published_at: '2026-04-01T10:00:00.000Z',
                },
            ],
            error: null,
        });

        const result = await getBriefPerformanceRollups('brand-1');

        expect((supa as any).supabase.rpc).toHaveBeenCalledWith('get_brief_performance_rollups', {
            p_brand_id: 'brand-1',
            p_since: expect.any(String),
        });
        expect(result).toEqual([
            {
                briefId: 'brief-1',
                watchlistId: 'watch-1',
                title: 'Launch angle',
                objective: 'Drive awareness',
                angle: 'Founder-led story',
                linkedPosts: 3,
                publishedPosts: 2,
                scheduledPosts: 1,
                platformSpread: 2,
                totalImpressions: 1200,
                totalReach: 950,
                totalEngagement: 210,
                totalClicks: 45,
                totalLikes: 90,
                totalComments: 20,
                totalShares: 12,
                totalSaves: 8,
                lastPublishedAt: '2026-04-01T10:00:00.000Z',
            },
        ]);
    });

    it('maps watchlist performance rollups from RPC rows', async () => {
        (supa as any).supabase.rpc.mockResolvedValueOnce({
            data: [
                {
                    watchlist_id: 'watch-1',
                    name: 'Ramadan competitors',
                    query: 'ramadan offers saudi',
                    briefs_count: 4,
                    linked_posts: 6,
                    published_posts: 4,
                    scheduled_posts: 2,
                    platform_spread: 3,
                    total_impressions: 5400,
                    total_reach: 4100,
                    total_engagement: 660,
                    total_clicks: 120,
                    last_published_at: '2026-04-01T12:00:00.000Z',
                },
            ],
            error: null,
        });

        const result = await getWatchlistPerformanceRollups('brand-1');

        expect((supa as any).supabase.rpc).toHaveBeenCalledWith('get_watchlist_performance_rollups', {
            p_brand_id: 'brand-1',
            p_since: expect.any(String),
        });
        expect(result).toEqual([
            {
                watchlistId: 'watch-1',
                name: 'Ramadan competitors',
                query: 'ramadan offers saudi',
                briefsCount: 4,
                linkedPosts: 6,
                publishedPosts: 4,
                scheduledPosts: 2,
                platformSpread: 3,
                totalImpressions: 5400,
                totalReach: 4100,
                totalEngagement: 660,
                totalClicks: 120,
                lastPublishedAt: '2026-04-01T12:00:00.000Z',
            },
        ]);
    });

    it('returns empty arrays on RPC failure', async () => {
        (supa as any).supabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'boom' },
        });
        (supa as any).supabase.rpc.mockResolvedValueOnce({
            data: null,
            error: { message: 'boom' },
        });

        await expect(getBriefPerformanceRollups('brand-1')).resolves.toEqual([]);
        await expect(getWatchlistPerformanceRollups('brand-1')).resolves.toEqual([]);
    });
});
