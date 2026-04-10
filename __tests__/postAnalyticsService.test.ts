import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SocialPlatform } from '../types';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import { supabase } from '../services/supabaseClient';
import { getPostAnalytics, savePostAnalytics } from '../services/postAnalyticsService';

const makeChain = (overrides: Record<string, any> = {}) => ({
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    ...overrides,
});

describe('postAnalyticsService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('writes brief_id and watchlist_id explicitly when saving analytics', async () => {
        const chain = makeChain({
            insert: vi.fn().mockResolvedValue({ error: null }),
        });
        (supabase.from as any).mockReturnValue(chain);

        const result = await savePostAnalytics({
            postId: 'post-1',
            briefId: 'brief-1',
            watchlistId: 'watch-1',
            platform: SocialPlatform.Facebook,
            platformPostId: 'fb-post-1',
            impressions: 120,
            reach: 100,
            engagement: 30,
            likes: 10,
            comments: 5,
            shares: 2,
            clicks: 8,
            saves: 1,
            fetchedAt: new Date('2026-04-01T00:00:00.000Z'),
        });

        expect(result).toBe(true);
        expect(supabase.from).toHaveBeenCalledWith('post_analytics');
        expect(chain.insert).toHaveBeenCalledWith([
            expect.objectContaining({
                post_id: 'post-1',
                brief_id: 'brief-1',
                watchlist_id: 'watch-1',
                platform: SocialPlatform.Facebook,
                platform_post_id: 'fb-post-1',
            }),
        ]);
    });

    it('maps brief_id and watchlist_id when reading analytics', async () => {
        const chain = makeChain({
            order: vi.fn().mockResolvedValue({
                data: [
                    {
                        post_id: 'post-1',
                        brief_id: 'brief-1',
                        watchlist_id: 'watch-1',
                        platform: SocialPlatform.Instagram,
                        platform_post_id: 'ig-post-1',
                        impressions: 500,
                        reach: 430,
                        engagement: 70,
                        likes: 40,
                        comments: 10,
                        shares: 5,
                        clicks: 12,
                        saves: 9,
                        fetched_at: '2026-04-01T10:00:00.000Z',
                    },
                ],
                error: null,
            }),
        });
        (supabase.from as any).mockReturnValue(chain);

        const result = await getPostAnalytics('post-1');

        expect(result).toEqual([
            expect.objectContaining({
                postId: 'post-1',
                briefId: 'brief-1',
                watchlistId: 'watch-1',
                platform: SocialPlatform.Instagram,
            }),
        ]);
    });
});
