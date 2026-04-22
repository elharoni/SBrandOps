import {
    AccountStatus,
    AssetPurpose,
    AssetType,
    IntegrationHealth,
    SocialAccount,
    SocialAsset,
    SocialPlatform,
    SyncStatus,
} from '../types';
import { supabase } from './supabaseClient';

// Enum value helpers: map DB string → enum member
const toAssetType  = (v: string | null): AssetType  => (v as AssetType)  ?? AssetType.Page;
const toSyncStatus = (v: string | null): SyncStatus => (v as SyncStatus) ?? SyncStatus.Active;

// ─── DB row shapes ────────────────────────────────────────────────────────────

type PublicSocialAccountRow = {
    id: string;
    platform: string;
    username: string;
    avatar_url: string | null;
    followers_count: number | null;
    status: string;
    asset_type: string | null;
    purposes: string[] | null;
    market: string | null;
    is_primary: boolean | null;
    sync_status: string | null;
    last_synced_at: string | null;
    sync_error: string | null;
    webhook_active: boolean | null;
    scopes_granted: string[] | null;
};

type IntegrationHealthRow = {
    id: string;
    brand_id: string;
    platform: string;
    asset_type: string;
    asset_name: string;
    avatar_url: string | null;
    followers_count: number | null;
    purposes: string[];
    market: string | null;
    is_primary: boolean;
    sync_status: string;
    last_synced_at: string | null;
    sync_error: string | null;
    webhook_active: boolean;
    scopes_granted: string[];
    connection_status: string;
    token_expiring_soon: boolean;
    token_expires_at: string | null;
    token_is_valid: boolean | null;
    created_at: string;
    updated_at: string;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapAccountRow(row: PublicSocialAccountRow): SocialAccount {
    return {
        id: row.id,
        platform: row.platform as SocialPlatform,
        username: row.username,
        avatarUrl: row.avatar_url || `https://picsum.photos/seed/${row.username}/100`,
        followers: row.followers_count ?? 0,
        status: row.status as AccountStatus,
        assetType: toAssetType(row.asset_type),
        purposes: (row.purposes as AssetPurpose[]) ?? [],
        market: row.market ?? undefined,
        isPrimary: row.is_primary ?? false,
        syncStatus: toSyncStatus(row.sync_status),
        lastSyncedAt: row.last_synced_at ?? null,
        syncError: row.sync_error ?? null,
        webhookActive: row.webhook_active ?? false,
        scopesGranted: row.scopes_granted ?? [],
    };
}

function mapHealthRow(row: IntegrationHealthRow): IntegrationHealth {
    return {
        id: row.id,
        brandId: row.brand_id,
        platform: row.platform,
        assetType: toAssetType(row.asset_type),
        assetName: row.asset_name,
        avatarUrl: row.avatar_url,
        followersCount: row.followers_count,
        purposes: row.purposes as AssetPurpose[],
        market: row.market,
        isPrimary: row.is_primary,
        syncStatus: toSyncStatus(row.sync_status),
        lastSyncedAt: row.last_synced_at,
        syncError: row.sync_error,
        webhookActive: row.webhook_active,
        scopesGranted: row.scopes_granted,
        connectionStatus: row.connection_status as AccountStatus,
        tokenExpiringSoon: row.token_expiring_soon,
        tokenExpiresAt: row.token_expires_at,
        tokenIsValid: row.token_is_valid,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getSocialAccounts(brandId: string): Promise<SocialAccount[]> {
    const { data, error } = await supabase
        .from('social_accounts')
        .select(`
            id, platform, username, avatar_url, followers_count, status,
            asset_type, purposes, market, is_primary,
            sync_status, last_synced_at, sync_error, webhook_active, scopes_granted
        `)
        .eq('brand_id', brandId)
        .order('is_primary', { ascending: false });

    if (error) {
        console.error('Error fetching social accounts:', error);
        return [];
    }

    return ((data || []) as PublicSocialAccountRow[]).map(mapAccountRow);
}

export async function getIntegrationHealth(brandId: string): Promise<IntegrationHealth[]> {
    const { data, error } = await supabase
        .from('integration_health')
        .select('*')
        .eq('brand_id', brandId)
        .order('is_primary', { ascending: false });

    if (error) {
        console.error('Error fetching integration health:', error);
        return [];
    }

    return ((data || []) as IntegrationHealthRow[]).map(mapHealthRow);
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function updateAssetSyncStatus(
    assetId: string,
    status: SyncStatus,
    syncError?: string,
): Promise<void> {
    const { error } = await supabase.rpc('update_asset_sync_status', {
        p_asset_id: assetId,
        p_status: status,
        p_error: syncError ?? null,
    });

    if (error) {
        console.error('Error updating sync status:', error);
        throw error;
    }
}

export async function updateAssetMetadata(
    assetId: string,
    updates: {
        assetType?: AssetType;
        purposes?: AssetPurpose[];
        market?: string;
        isPrimary?: boolean;
        webhookActive?: boolean;
    },
): Promise<void> {
    const payload: Record<string, unknown> = {};
    if (updates.assetType !== undefined)    payload.asset_type     = updates.assetType;
    if (updates.purposes !== undefined)     payload.purposes       = updates.purposes;
    if (updates.market !== undefined)       payload.market         = updates.market;
    if (updates.isPrimary !== undefined)    payload.is_primary     = updates.isPrimary;
    if (updates.webhookActive !== undefined)payload.webhook_active = updates.webhookActive;

    const { error } = await supabase
        .from('social_accounts')
        .update(payload)
        .eq('id', assetId);

    if (error) {
        console.error('Error updating asset metadata:', error);
        throw error;
    }
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

export async function connectSocialAccount(
    brandId: string,
    platform: SocialPlatform,
    username: string,
): Promise<SocialAccount> {
    const mockAsset: SocialAsset = {
        id: `manual-${platform}-${Date.now()}`,
        name: username,
        followers: Math.floor(Math.random() * 10000),
        avatarUrl: `https://picsum.photos/seed/${username}/100`,
    };

    const { data, error } = await supabase.functions.invoke('connect-accounts', {
        body: { brand_id: brandId, platform, assets: [mockAsset] },
    });

    if (error) {
        console.error('Error connecting account:', error);
        throw error;
    }

    const account = data?.accounts?.[0] as PublicSocialAccountRow | undefined;
    if (!account) throw new Error('No account returned from connect-accounts');

    return mapAccountRow(account);
}

export async function getPlatformAssets(platform: SocialPlatform): Promise<SocialAsset[]> {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    if (platform === SocialPlatform.Facebook) {
        return [
            { id: 'pg-1', name: 'Confort-Tex Official',  category: 'Shopping',   followers: 12500, avatarUrl: 'https://picsum.photos/seed/cto/100' },
            { id: 'pg-2', name: 'Confort-Tex Support',   category: 'Service',    followers: 1200,  avatarUrl: 'https://picsum.photos/seed/cts/100' },
            { id: 'pg-3', name: 'Community Group',       category: 'Community',  followers: 5600,  avatarUrl: 'https://picsum.photos/seed/ctc/100' },
        ];
    }

    if (platform === SocialPlatform.Instagram) {
        return [
            { id: 'ig-1', name: 'confort.tex',        category: 'Business', followers: 45000, avatarUrl: 'https://picsum.photos/seed/ig1/100' },
            { id: 'ig-2', name: 'confort_lifestyle',  category: 'Creator',  followers: 8000,  avatarUrl: 'https://picsum.photos/seed/ig2/100' },
        ];
    }

    return [
        { id: `asset-${Date.now()}`, name: `${platform} Page`, followers: 0, avatarUrl: `https://picsum.photos/seed/${platform}/100` },
    ];
}
