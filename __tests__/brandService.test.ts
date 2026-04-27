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
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve({ data: null, error: null }).then(onFulfilled, onRejected),
    catch: (onRejected: any) =>
        Promise.resolve({ data: null, error: null }).catch(onRejected),
    finally: (onFinally: any) =>
        Promise.resolve({ data: null, error: null }).finally(onFinally),
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
            const tenantLookupChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });
            const insertChain = makeChain({
                single: vi.fn().mockResolvedValue({ data: mockRow, error: null }),
            });
            const tenantUpdateChain = makeChain();

            (supabase.from as any)
                .mockReturnValueOnce(tenantLookupChain)
                .mockReturnValueOnce(insertChain)
                .mockReturnValueOnce(tenantUpdateChain);

            const result = await addBrand('New Brand', 'E-commerce');

            expect(result.name).toBe('New Brand');
            expect(insertChain.insert).toHaveBeenCalledWith([{
                name: 'New Brand',
                user_id: 'user-1',
                industry: 'E-commerce',
            }]);
            expect(tenantUpdateChain.update).toHaveBeenCalledWith({ brands_count: 1 });
        });

        it('throws when the user is not authenticated', async () => {
            mockAuthUser(null);

            await expect(addBrand('Demo Brand')).rejects.toThrow(
                '\u064a\u062c\u0628 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0623\u0648\u0644\u0627\u064b \u0644\u0625\u0636\u0627\u0641\u0629 \u0628\u0631\u0627\u0646\u062f'
            );
        });

        it('throws when DB insert fails', async () => {
            const tenantLookupChain = makeChain({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            });
            const insertChain = makeChain({
                single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Constraint violation' } }),
            });

            (supabase.from as any)
                .mockReturnValueOnce(tenantLookupChain)
                .mockReturnValueOnce(insertChain);

            await expect(addBrand('Demo Brand')).rejects.toThrow(
                '\u0641\u0634\u0644 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0628\u0631\u0627\u0646\u062f: Constraint violation'
            );
        });
    });
});
