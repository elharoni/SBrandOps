import { describe, expect, it } from 'vitest';
import { SocialPlatform } from '../types';
import { buildPostAnalyticsInsertPayload } from '../services/postAnalyticsPayload';

describe('postAnalyticsPayload', () => {
    it('builds a normalized insert payload with explicit attribution fields', () => {
        const payload = buildPostAnalyticsInsertPayload({
            postId: 'post-1',
            brandId: 'brand-1',
            briefId: 'brief-1',
            watchlistId: 'watch-1',
            platform: SocialPlatform.LinkedIn,
            platformPostId: 'ln-1',
            impressions: 1000,
            reach: 800,
            engagement: 120,
            likes: 60,
            comments: 15,
            shares: 5,
            clicks: 30,
            saves: 10,
            videoViews: 400,
            fetchedAt: '2026-04-01T00:00:00.000Z',
        });

        expect(payload).toEqual({
            post_id: 'post-1',
            brand_id: 'brand-1',
            brief_id: 'brief-1',
            watchlist_id: 'watch-1',
            platform: SocialPlatform.LinkedIn,
            platform_post_id: 'ln-1',
            impressions: 1000,
            reach: 800,
            engagement: 120,
            likes: 60,
            comments: 15,
            shares: 5,
            clicks: 30,
            saves: 10,
            video_views: 400,
            fetched_at: '2026-04-01T00:00:00.000Z',
        });
    });
});
