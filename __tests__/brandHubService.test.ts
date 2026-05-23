import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
    },
}));

import { supabase } from '../services/supabaseClient';
import { getBrandHubProfile, updateBrandProfile, invalidateProfileCache } from '../services/brandHubService';

const makeChain = (overrides: Record<string, any> = {}) => {
    const chain: any = {
        select: vi.fn().mockImplementation(() => chain),
        insert: vi.fn().mockImplementation(() => chain),
        update: vi.fn().mockImplementation(() => chain),
        eq: vi.fn().mockImplementation(() => chain),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn().mockImplementation((onFulfilled: any) =>
            Promise.resolve({ data: null, error: null }).then(onFulfilled)
        ),
        ...overrides,
    };
    return chain;
};

describe('brandHubService Metric Conversions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        invalidateProfileCache('brand-1');
    });

    describe('getBrandHubProfile', () => {
        it('returns fallback empty profile with metrics set to 50 when DB row is missing', async () => {
            const profileChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });
            const brandChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            (supabase.from as any)
                .mockReturnValueOnce(profileChain)
                .mockReturnValueOnce(brandChain);

            const profile = await getBrandHubProfile('brand-1', 'Test Brand');

            expect(profile.brandName).toBe('Test Brand');
            expect(profile.brandVoice.toneStrength).toBe(50);
            expect(profile.brandVoice.toneSentiment).toBe(50);
        });

        it('multiplies DB decimal metrics (0-1) by 100 to frontend scale (0-100)', async () => {
            const mockDbProfile = {
                brand_id: 'brand-1',
                brand_name: 'Test Brand',
                tone_strength: 0.72,
                tone_sentiment: 0.45,
            };
            const profileChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfile, error: null }),
            });
            const brandChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: { website_url: 'https://example.com' }, error: null }),
            });

            (supabase.from as any)
                .mockReturnValueOnce(profileChain)
                .mockReturnValueOnce(brandChain);

            const profile = await getBrandHubProfile('brand-1', 'Test Brand');

            expect(profile.brandVoice.toneStrength).toBe(72);
            expect(profile.brandVoice.toneSentiment).toBe(45);
            expect(profile.website).toBe('https://example.com');
        });

        it('handles null/undefined values and rounds safely', async () => {
            const mockDbProfile = {
                brand_id: 'brand-1',
                tone_strength: null,
                tone_sentiment: undefined,
            };
            const profileChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfile, error: null }),
            });
            const brandChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });

            (supabase.from as any)
                .mockReturnValueOnce(profileChain)
                .mockReturnValueOnce(brandChain);

            const profile = await getBrandHubProfile('brand-1', 'Test Brand');

            expect(profile.brandVoice.toneStrength).toBe(50);
            expect(profile.brandVoice.toneSentiment).toBe(50);
        });
    });

    describe('updateBrandProfile', () => {
        it('divides frontend UI metrics (0-100) by 100 for DB upsert payload', async () => {
            const mockDbProfileResult = {
                brand_id: 'brand-1',
                tone_strength: 0.85,
                tone_sentiment: 0.2,
            };

            const updateChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfileResult, error: null }),
            });

            (supabase.from as any).mockReturnValue(updateChain);

            const updatedProfile = await updateBrandProfile('brand-1', {
                brandVoice: {
                    toneDescription: ['Friendly'],
                    keywords: [],
                    negativeKeywords: [],
                    toneStrength: 85,
                    toneSentiment: 20,
                    voiceGuidelines: { dos: [], donts: [] },
                },
            });

            expect(updateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    tone_strength: 0.85,
                    tone_sentiment: 0.2,
                })
            );
            expect(updatedProfile.brandVoice.toneStrength).toBe(85);
            expect(updatedProfile.brandVoice.toneSentiment).toBe(20);
        });

        it('clamps values and handles float rounding accurately', async () => {
            const mockDbProfileResult = {
                brand_id: 'brand-1',
                tone_strength: 0.33,
                tone_sentiment: 1.0,
            };

            const updateChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: mockDbProfileResult, error: null }),
            });

            (supabase.from as any).mockReturnValue(updateChain);

            await updateBrandProfile('brand-1', {
                brandVoice: {
                    toneDescription: [],
                    keywords: [],
                    negativeKeywords: [],
                    toneStrength: 33.333333333333336, // float precision
                    toneSentiment: 150, // out of bounds
                    voiceGuidelines: { dos: [], donts: [] },
                },
            });

            expect(updateChain.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    tone_strength: 0.33,
                    tone_sentiment: 1.0, // clamped to 1.0
                })
            );
        });
    });
});
