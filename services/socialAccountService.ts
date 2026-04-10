import { AccountStatus, SocialAccount, SocialAsset, SocialPlatform } from '../types';
import { supabase } from './supabaseClient';

type PublicSocialAccountRow = {
    id: string;
    platform: string;
    username: string;
    avatar_url: string | null;
    followers_count: number | null;
    status: string;
};

function mapAccountRow(row: PublicSocialAccountRow): SocialAccount {
    return {
        id: row.id,
        platform: row.platform as SocialPlatform,
        username: row.username,
        avatarUrl: row.avatar_url || `https://picsum.photos/seed/${row.username}/100`,
        followers: row.followers_count ?? 0,
        status: row.status as AccountStatus,
    };
}

export async function getSocialAccounts(brandId: string): Promise<SocialAccount[]> {
    const { data, error } = await supabase.rpc('get_social_accounts_public', {
        p_brand_id: brandId,
    });

    if (error) {
        console.error('Error fetching social accounts:', error);
        return [];
    }

    return ((data || []) as PublicSocialAccountRow[]).map(mapAccountRow);
}

export async function getPlatformAssets(platform: SocialPlatform): Promise<SocialAsset[]> {
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (platform === SocialPlatform.Facebook) {
        return [
            { id: 'pg-1', name: 'Confort-Tex Official', category: 'Shopping', followers: 12500, avatarUrl: 'https://picsum.photos/seed/cto/100' },
            { id: 'pg-2', name: 'Confort-Tex Support', category: 'Service', followers: 1200, avatarUrl: 'https://picsum.photos/seed/cts/100' },
            { id: 'pg-3', name: 'Community Group', category: 'Community', followers: 5600, avatarUrl: 'https://picsum.photos/seed/ctc/100' },
        ];
    }

    if (platform === SocialPlatform.Instagram) {
        return [
            { id: 'ig-1', name: 'confort.tex', category: 'Business', followers: 45000, avatarUrl: 'https://picsum.photos/seed/ig1/100' },
            { id: 'ig-2', name: 'confort_lifestyle', category: 'Creator', followers: 8000, avatarUrl: 'https://picsum.photos/seed/ig2/100' },
        ];
    }

    return [
        { id: `asset-${Date.now()}`, name: `${platform} Page`, followers: 0, avatarUrl: `https://picsum.photos/seed/${platform}/100` },
    ];
}

export async function disconnectSocialAccount(accountId: string): Promise<void> {
    const { error } = await supabase.functions.invoke('manage-social-account', {
        body: { action: 'disconnect', account_id: accountId },
    });

    if (error) {
        console.error('Error disconnecting account:', error);
        throw error;
    }
}

export async function updateAccountStatus(accountId: string, status: AccountStatus): Promise<void> {
    const { error } = await supabase.functions.invoke('manage-social-account', {
        body: { action: 'update_status', account_id: accountId, status },
    });

    if (error) {
        console.error('Error updating account status:', error);
        throw error;
    }
}

export async function connectSocialAccount(brandId: string, platform: SocialPlatform, username: string): Promise<SocialAccount> {
    const mockAsset: SocialAsset = {
        id: `manual-${platform}-${Date.now()}`,
        name: username,
        followers: Math.floor(Math.random() * 10000),
        avatarUrl: `https://picsum.photos/seed/${username}/100`,
    };

    const { data, error } = await supabase.functions.invoke('connect-accounts', {
        body: {
            brand_id: brandId,
            platform,
            assets: [mockAsset],
        },
    });

    if (error) {
        console.error('Error connecting account:', error);
        throw error;
    }

    const account = data?.accounts?.[0] as PublicSocialAccountRow | undefined;
    if (!account) {
        throw new Error('No account returned from connect-accounts');
    }

    return mapAccountRow(account);
}
