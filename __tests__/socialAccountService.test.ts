import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountStatus, SocialPlatform } from '../types';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        from: vi.fn(),
        functions: {
            invoke: vi.fn(),
        },
    },
}));

import { supabase } from '../services/supabaseClient';
import {
    connectSocialAccount,
    disconnectSocialAccount,
    getSocialAccounts,
    updateAccountStatus,
} from '../services/socialAccountService';

const makeQuery = (resolvedValue: { data?: any; error?: any }) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(resolvedValue),
});

describe('socialAccountService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads public accounts from the social_accounts table', async () => {
        const query = makeQuery({
            data: [{
                id: 'acc-1',
                platform: 'Instagram',
                username: 'mypage',
                avatar_url: null,
                followers_count: 5000,
                status: 'Connected',
                asset_type: null,
                purposes: null,
                market: null,
                is_primary: true,
                sync_status: null,
                last_synced_at: null,
                sync_error: null,
                webhook_active: null,
                scopes_granted: null,
            }],
            error: null,
        });
        (supabase.from as any).mockReturnValueOnce(query);

        const result = await getSocialAccounts('brand-1');

        expect(supabase.from).toHaveBeenCalledWith('social_accounts');
        expect(query.eq).toHaveBeenCalledWith('brand_id', 'brand-1');
        expect(query.order).toHaveBeenCalledWith('is_primary', { ascending: false });
        expect(result).toHaveLength(1);
        expect(result[0].platform).toBe(SocialPlatform.Instagram);
        expect(result[0].followers).toBe(5000);
        expect(result[0].avatarUrl).toContain('https://picsum.photos/seed/mypage/100');
    });

    it('returns an empty array when the table query fails', async () => {
        const query = makeQuery({
            data: null,
            error: { message: 'boom' },
        });
        (supabase.from as any).mockReturnValueOnce(query);

        const result = await getSocialAccounts('brand-1');

        expect(result).toEqual([]);
    });

    it('disconnects through Edge', async () => {
        (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { ok: true }, error: null });

        await disconnectSocialAccount('acc-1');

        expect(supabase.functions.invoke).toHaveBeenCalledWith('manage-social-account', {
            body: { action: 'disconnect', account_id: 'acc-1' },
        });
    });

    it('updates status through Edge', async () => {
        (supabase.functions.invoke as any).mockResolvedValueOnce({ data: { ok: true }, error: null });

        await updateAccountStatus('acc-1', AccountStatus.Connected);

        expect(supabase.functions.invoke).toHaveBeenCalledWith('manage-social-account', {
            body: { action: 'update_status', account_id: 'acc-1', status: AccountStatus.Connected },
        });
    });

    it('connects account through Edge', async () => {
        (supabase.functions.invoke as any).mockResolvedValueOnce({
            data: {
                accounts: [{
                    id: 'acc-1',
                    platform: 'Facebook',
                    username: 'brand-page',
                    avatar_url: null,
                    followers_count: 120,
                    status: 'Connected',
                    asset_type: null,
                    purposes: null,
                    market: null,
                    is_primary: false,
                    sync_status: null,
                    last_synced_at: null,
                    sync_error: null,
                    webhook_active: null,
                    scopes_granted: null,
                }],
            },
            error: null,
        });

        const account = await connectSocialAccount('brand-1', SocialPlatform.Facebook, 'brand-page');

        expect(supabase.functions.invoke).toHaveBeenCalledWith('connect-accounts', expect.objectContaining({
            body: expect.objectContaining({
                brand_id: 'brand-1',
                platform: SocialPlatform.Facebook,
            }),
        }));
        expect(account.username).toBe('brand-page');
    });
});
