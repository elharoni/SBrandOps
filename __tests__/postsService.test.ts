/**
 * Tests: postsService
 * اختبارات خدمة المنشورات المجدولة
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SocialPlatform } from '../types';

vi.mock('../services/supabaseClient', () => ({
    supabase: { from: vi.fn() },
}));

import { supabase } from '../services/supabaseClient';
import {
    createScheduledPost,
    getScheduledPosts,
    deleteScheduledPost,
} from '../services/postsService';

const makeChain = (overrides: Record<string, any> = {}) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
});

describe('postsService', () => {
    beforeEach(() => vi.clearAllMocks());

    // ── createScheduledPost ──────────────────────────────────────────────────
    describe('createScheduledPost', () => {
        it('inserts a post and returns mapped result', async () => {
            const now = new Date().toISOString();
            const mockRow = {
                id: 'post-1',
                brand_id: 'brand-1',
                content: 'Test post',
                platforms: ['Facebook'],
                media_urls: [],
                status: 'Draft',
                scheduled_at: null,
                instagram_first_comment: null,
                locations: null,
                created_at: now,
                updated_at: now,
            };
            const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: mockRow, error: null }) });
            (supabase.from as any).mockReturnValue(chain);

            const result = await createScheduledPost({
                brandId: 'brand-1',
                content: 'Test post',
                platforms: [SocialPlatform.Facebook],
                mediaUrls: [],
            });

            expect(supabase.from).toHaveBeenCalledWith('scheduled_posts');
            expect(result.id).toBe('post-1');
            expect(result.content).toBe('Test post');
        });

        it('returns null on Supabase error (graceful degradation)', async () => {
            const chain = makeChain({ single: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }) });
            (supabase.from as any).mockReturnValue(chain);

            const result = await createScheduledPost({
                brandId: 'brand-1',
                content: 'Test',
                platforms: [],
                mediaUrls: [],
            });
            expect(result).toBeNull();
        });
    });

    // ── getScheduledPosts ────────────────────────────────────────────────────
    describe('getScheduledPosts', () => {
        it('returns empty array when no posts', async () => {
            const chain = makeChain({ order: vi.fn().mockResolvedValue({ data: [], error: null }) });
            (supabase.from as any).mockReturnValue(chain);

            const result = await getScheduledPosts('brand-1');
            expect(result).toEqual([]);
        });

        it('maps DB rows to ScheduledPost type', async () => {
            const mockRows = [{
                id: 'p1',
                brand_id: 'b1',
                content: 'Post 1',
                platforms: ['Instagram', 'Facebook'],
                media_urls: ['https://example.com/img.jpg'],
                status: 'Scheduled',
                scheduled_at: '2026-04-01T10:00:00Z',
                instagram_first_comment: '#hashtag',
                locations: null,
                created_at: '2026-03-30T00:00:00Z',
                updated_at: '2026-03-30T00:00:00Z',
            }];
            const chain = makeChain({ order: vi.fn().mockResolvedValue({ data: mockRows, error: null }) });
            (supabase.from as any).mockReturnValue(chain);

            const result = await getScheduledPosts('b1');

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('p1');
            expect(result[0].platforms).toContain(SocialPlatform.Instagram);
            expect(result[0].media).toHaveLength(1);
        });

        it('returns empty array on error', async () => {
            const chain = makeChain({ order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }) });
            (supabase.from as any).mockReturnValue(chain);

            const result = await getScheduledPosts('b1');
            expect(result).toEqual([]);
        });
    });

    // ── deleteScheduledPost ──────────────────────────────────────────────────
    describe('deleteScheduledPost', () => {
        it('calls delete with correct id', async () => {
            const chain = makeChain({ eq: vi.fn().mockResolvedValue({ error: null }) });
            (supabase.from as any).mockReturnValue(chain);
            chain.delete.mockReturnValue(chain);

            await deleteScheduledPost('post-123');

            expect(supabase.from).toHaveBeenCalledWith('scheduled_posts');
            expect(chain.delete).toHaveBeenCalled();
        });

        it('returns false on delete error (graceful degradation)', async () => {
            const chain = makeChain({ eq: vi.fn().mockResolvedValue({ error: { message: 'Not found' } }) });
            (supabase.from as any).mockReturnValue(chain);
            chain.delete.mockReturnValue(chain);

            const result = await deleteScheduledPost('missing-id');
            expect(result).toBe(false);
        });
    });
});
