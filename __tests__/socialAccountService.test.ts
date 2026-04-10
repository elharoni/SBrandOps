import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountStatus, SocialPlatform } from '../types';

vi.mock('../services/supabaseClient', () => ({
    supabase: {
        rpc: vi.fn(),
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

describe('socialAccountService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('reads public accounts via RPC', async () => {
        (supabase.rpc as any).mockResolvedValueOnce({
            data: [{
                id: 'acc-1',
                platform: 'Instagram',
                username: 'mypage',
                avatar_url: null,
                followers_count: 5000,
                status: 'Connected',
            }],
            error: null,
        });

        const result = await getSocialAccounts('brand-1');

        expect(supabase.rpc).toHaveBeenCalledWith('get_social_accounts_public', { p_brand_id: 'brand-1' });
        expect(result).toHaveLength(1);
        expect(result[0].platform).toBe(SocialPlatform.Instagram);
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
