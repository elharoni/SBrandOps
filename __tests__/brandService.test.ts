import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
        auth: { getUser: vi.fn() },
    },
}));

import { supabase } from '../services/supabaseClient';
import { addBrand, getBrands } from '../services/brandService';

const mockAuthUser = (userId: string | null = 'user-1') => {
    (supabase.auth.getUser as any).mockResolvedValue({
        data: { user: userId ? { id: userId } : null },
        error: null,
    });
};

const makeChain = (overrides: Record<string, any> = {}) => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
});

describe('brandService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuthUser();
    });

    describe('getBrands', () => {
        it('returns mapped brands from DB', async () => {
            const mockRows = [{
                id: 'brand-1',
                name: 'Test Brand',
                logo_url: 'https://example.com/logo.png',
            }];
            const chain = makeChain({
                order: vi.fn().mockResolvedValue({ data: mockRows, error: null }),
            });
            (supabase.from as any).mockReturnValue(chain);

            const result = await getBrands();

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('brand-1');
            expect(result[0].name).toBe('Test Brand');
            expect(result[0].logoUrl).toBe('https://example.com/logo.png');
        });

        it('returns an empty array when DB returns empty', async () => {
            const chain = makeChain({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
            });
            (supabase.from as any).mockReturnValue(chain);

            const result = await getBrands();

            expect(result).toEqual([]);
        });

        it('returns an empty array on DB error', async () => {
            const chain = makeChain({
                order: vi.fn().mockResolvedValue({ data: null, error: { message: 'Network error' } }),
            });
            (supabase.from as any).mockReturnValue(chain);

            const result = await getBrands();

            expect(result).toEqual([]);
        });
    });

    describe('addBrand', () => {
        it('inserts and returns new brand', async () => {
            const mockRow = {
                id: 'new-brand',
                name: 'New Brand',
                logo_url: null,
            };
            const chain = makeChain({
                single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
            });
            (supabase.from as any).mockReturnValue(chain);

            const result = await addBrand('New Brand', 'E-commerce');

            expect(result.name).toBe('New Brand');
            expect(chain.insert).toHaveBeenCalledWith([{
                name: 'New Brand',
                user_id: 'user-1',
                industry: 'E-commerce',
            }]);
        });

        it('throws when the user is not authenticated', async () => {
            mockAuthUser(null);

            await expect(addBrand('Demo Brand')).rejects.toThrow('يجب تسجيل الدخول أولاً لإضافة براند');
        });

        it('throws when DB insert fails', async () => {
            const chain = makeChain({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Constraint violation' } }),
            });
            (supabase.from as any).mockReturnValue(chain);

            await expect(addBrand('Demo Brand')).rejects.toThrow('فشل إنشاء البراند: Constraint violation');
        });
    });
});
