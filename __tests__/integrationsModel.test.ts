import { describe, expect, it } from 'vitest';
import { AccountStatus, SocialPlatform, type SocialAccount } from '../types';
import type { BrandConnection } from '../services/brandConnectionService';
import {
    countConnectionsNeedingAttention,
    countLiveOperationalConnections,
    countRecentlySyncedConnections,
    getConnectionSection,
    groupConnectionsBySection,
    hasLiveProviderConnection,
    isLiveOperationalConnection,
} from '../components/pages/integrationsModel';

const makeConnection = (overrides: Partial<BrandConnection>): BrandConnection => ({
    id: 'conn-1',
    brand_id: 'brand-1',
    provider: 'ga4',
    provider_version: 'v1',
    external_account_id: null,
    external_account_name: null,
    status: 'connected',
    sync_health: 'healthy',
    last_error: null,
    last_error_at: null,
    error_count: 0,
    last_sync_at: null,
    last_successful_sync_at: null,
    sync_frequency_minutes: 60,
    sync_history: true,
    sync_history_days: 90,
    scopes: [],
    metadata: {},
    created_at: '2026-04-01T00:00:00.000Z',
    updated_at: '2026-04-01T00:00:00.000Z',
    ...overrides,
});

const makeSocialAccount = (overrides: Partial<SocialAccount>): SocialAccount => ({
    id: 'social-1',
    platform: SocialPlatform.Instagram,
    username: 'brand',
    avatarUrl: 'https://example.com/avatar.png',
    followers: 1200,
    status: AccountStatus.Connected,
    ...overrides,
});

describe('integrationsModel', () => {
    it('maps providers into operational sections', () => {
        expect(getConnectionSection('google_ads')).toBe('ads');
        expect(getConnectionSection('ga4')).toBe('analytics');
        expect(getConnectionSection('shopify')).toBe('commerce');
    });

    it('groups connections by section', () => {
        const grouped = groupConnectionsBySection([
            makeConnection({ id: 'ads-1', provider: 'google_ads' }),
            makeConnection({ id: 'ga4-1', provider: 'ga4' }),
            makeConnection({ id: 'shop-1', provider: 'shopify' }),
        ]);

        expect(grouped.ads).toHaveLength(1);
        expect(grouped.analytics).toHaveLength(1);
        expect(grouped.commerce).toHaveLength(1);
    });

    it('counts live operational connections without disconnected rows', () => {
        const liveCount = countLiveOperationalConnections(
            [
                makeSocialAccount(),
                makeSocialAccount({ id: 'social-2', platform: SocialPlatform.Facebook }),
            ],
            [
                makeConnection({ id: 'conn-live', provider: 'ga4' }),
                makeConnection({ id: 'conn-off', provider: 'google_ads', status: 'disconnected' }),
            ],
        );

        expect(liveCount).toBe(3);
    });

    it('detects live provider connections from brand_connections only', () => {
        expect(hasLiveProviderConnection(
            [
                makeConnection({ id: 'conn-1', provider: 'google_ads' }),
                makeConnection({ id: 'conn-2', provider: 'ga4', status: 'disconnected' }),
            ],
            ['google_ads'],
        )).toBe(true);

        expect(hasLiveProviderConnection(
            [
                makeConnection({ id: 'conn-3', provider: 'google_ads', status: 'disconnected' }),
            ],
            ['google_ads'],
        )).toBe(false);
    });

    it('treats only disconnected rows as non-live operational connections', () => {
        expect(isLiveOperationalConnection(makeConnection({ status: 'connected' }))).toBe(true);
        expect(isLiveOperationalConnection(makeConnection({ status: 'needs_reauth' }))).toBe(true);
        expect(isLiveOperationalConnection(makeConnection({ status: 'disconnected' }))).toBe(false);
    });

    it('counts only actionable attention states', () => {
        const attentionCount = countConnectionsNeedingAttention(
            [makeSocialAccount({ status: AccountStatus.NeedsReauth })],
            [
                makeConnection({ id: 'conn-1', provider: 'ga4', sync_health: 'degraded' }),
                makeConnection({ id: 'conn-2', provider: 'google_ads', status: 'error' }),
                makeConnection({ id: 'conn-3', provider: 'shopify', status: 'disconnected' }),
            ],
        );

        expect(attentionCount).toBe(3);
    });

    it('counts recently synced live connections only', () => {
        const now = new Date('2026-04-01T12:00:00.000Z');
        const recentCount = countRecentlySyncedConnections(
            [
                makeConnection({ id: 'fresh', provider: 'ga4', last_sync_at: '2026-04-01T08:30:00.000Z' }),
                makeConnection({ id: 'stale', provider: 'google_ads', last_sync_at: '2026-03-30T08:30:00.000Z' }),
                makeConnection({ id: 'off', provider: 'shopify', status: 'disconnected', last_sync_at: '2026-04-01T10:30:00.000Z' }),
            ],
            now,
        );

        expect(recentCount).toBe(1);
    });
});
